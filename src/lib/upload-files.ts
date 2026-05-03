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
    const message = await readUploadError(response);
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
    const complete = (files: FileList | BrowserUploadFile[]) => {
      resolve(getUploadableFiles(files));
      input.remove();
    };

    input.addEventListener("change", () => complete(input.files ?? []), { once: true });
    input.addEventListener("cancel", () => complete([]), { once: true });

    input.style.display = "none";
    document.body.append(input);
    input.click();
  });
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

async function readUploadError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error;
  } catch {
    return response.text();
  }
}
