import { readApiErrorMessage } from "./api-error.ts";
import {
  isUnsupportedCodeArchive,
  type DefenseFileInput,
} from "./project-workspace.ts";
import { isIgnoredUploadPath, normalizeUploadPath } from "./upload-storage.ts";

type UploadFileSystemEntry = {
  isDirectory: boolean;
  isFile: boolean;
  name: string;
};

type UploadFileSystemFileEntry = UploadFileSystemEntry & {
  file(successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void): void;
};

type UploadFileSystemDirectoryEntry = UploadFileSystemEntry & {
  createReader(): UploadFileSystemDirectoryReader;
};

type UploadFileSystemDirectoryReader = {
  readEntries(
    successCallback: (entries: UploadFileSystemEntry[]) => void,
    errorCallback?: (error: DOMException) => void,
  ): void;
};

type DataTransferItemWithEntry = {
  webkitGetAsEntry?: () => UploadFileSystemEntry | null;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandleLike>;
};

type FileSystemDirectoryHandleLike = {
  kind: "directory";
  name: string;
  entries(): AsyncIterable<[string, FileSystemHandleLike]>;
};

type FileSystemFileHandleLike = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
};

type FileSystemHandleLike = FileSystemDirectoryHandleLike | FileSystemFileHandleLike;

export async function uploadDefenseFiles(files: File[], options?: { projectId?: string }): Promise<DefenseFileInput[]> {
  const uploadableFiles = getUploadableFiles(files);
  if (!uploadableFiles.length) return [];

  const formData = new FormData();
  for (const file of uploadableFiles) {
    const displayName = getUploadDisplayName(file);
    formData.append("files", file);
    formData.append("relativePaths", displayName);
  }
  if (options?.projectId) {
    formData.append("projectId", options.projectId);
  }

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message || "文件上传失败");
  }

  const payload = (await response.json()) as {
    uploadedFiles?: DefenseFileInput[];
  };

  return payload.uploadedFiles ?? [];
}

export type BrowserUploadFile = File & {
  webkitRelativePath?: string;
};

export async function getUploadableFilesFromDataTransfer(dataTransfer: DataTransfer) {
  const filesFromItems = await readDataTransferItemFiles(dataTransfer.items);
  const files = filesFromItems.length ? filesFromItems : Array.from(dataTransfer.files);

  return getUploadableFiles(files);
}

export async function pickUploadDirectory() {
  const directoryPicker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (directoryPicker) {
    try {
      const directoryHandle = await directoryPicker({ mode: "read" });
      const files = await readDirectoryHandleFiles(directoryHandle, directoryHandle.name);
      return getUploadableFiles(files);
    } catch (error) {
      if (isUserCancelledDirectoryPick(error)) return [];
      throw error;
    }
  }

  return pickUploadDirectoryWithInput();
}

export function getUploadDisplayName(file: Pick<File, "name"> & { webkitRelativePath?: string }) {
  return normalizeUploadPath(file.webkitRelativePath, file.name);
}

export function getUploadableFiles<T extends BrowserUploadFile>(files: FileList | T[]) {
  return Array.from(files).filter((file): file is T => {
    const displayName = getUploadDisplayName(file);
    return !isIgnoredUploadPath(displayName)
      && !(displayName.includes("/") && isUnsupportedCodeArchive(displayName));
  });
}

export function withUploadPath<T extends File>(file: T, relativePath: string) {
  Object.defineProperty(file, "webkitRelativePath", {
    configurable: true,
    value: normalizeUploadPath(relativePath, file.name),
  });

  return file as T & BrowserUploadFile;
}

async function readDataTransferItemFiles(items: DataTransferItemList) {
  const entries = Array.from(items)
    .map((item) => (item as unknown as DataTransferItemWithEntry).webkitGetAsEntry?.())
    .filter((entry): entry is UploadFileSystemEntry => Boolean(entry));

  if (!entries.length) return [];

  const files = await Promise.all(entries.map((entry) => readEntryFiles(entry)));
  return files.flat();
}

async function pickUploadDirectoryWithInput() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.setAttribute("directory", "");
  input.setAttribute("webkitdirectory", "");

  return new Promise<BrowserUploadFile[]>((resolve) => {
    input.addEventListener("change", () => {
      resolve(getUploadableFiles(input.files ?? []));
      input.remove();
    }, { once: true });

    input.style.display = "none";
    document.body.append(input);
    input.click();
  });
}

async function readDirectoryHandleFiles(
  directoryHandle: FileSystemDirectoryHandleLike,
  parentPath: string,
): Promise<BrowserUploadFile[]> {
  const files: BrowserUploadFile[] = [];

  for await (const [name, handle] of directoryHandle.entries()) {
    const relativePath = `${parentPath}/${name}`;
    if (handle.kind === "file") {
      files.push(withUploadPath(await handle.getFile(), relativePath));
      continue;
    }

    files.push(...await readDirectoryHandleFiles(handle, relativePath));
  }

  return files;
}

async function readEntryFiles(entry: UploadFileSystemEntry, parentPath = ""): Promise<BrowserUploadFile[]> {
  const relativePath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await readFileEntry(entry as UploadFileSystemFileEntry);
    return [withUploadPath(file, relativePath)];
  }

  if (entry.isDirectory) {
    const childEntries = await readDirectoryEntries(entry as UploadFileSystemDirectoryEntry);
    const nestedFiles = await Promise.all(
      childEntries.map((childEntry) => readEntryFiles(childEntry, relativePath)),
    );
    return nestedFiles.flat();
  }

  return [];
}

function readFileEntry(entry: UploadFileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function readDirectoryEntries(entry: UploadFileSystemDirectoryEntry) {
  const reader = entry.createReader();
  const entries: UploadFileSystemEntry[] = [];

  while (true) {
    const batch = await new Promise<UploadFileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch.length) break;
    entries.push(...batch);
  }

  return entries;
}

function isUserCancelledDirectoryPick(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
