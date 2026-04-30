import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createFileRepository } from "../../packages/db/src/repositories/files.ts";
import { resolveLocalStoragePath } from "./local-processing.ts";
import { getDemoMockFileFixture } from "./mock-file-fixtures.ts";

type FileRepository = Pick<ReturnType<typeof createFileRepository>, "read">;

export class FileContentError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    code: string,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function readProjectFileContent({
  cwd = process.cwd(),
  fileId,
  mockRoot = "/Users/Code/mock",
  projectId,
  repository = createFileRepository(),
}: {
  cwd?: string;
  fileId: string;
  mockRoot?: string;
  projectId: string;
  repository?: FileRepository;
}) {
  let file;
  try {
    file = await repository.read(projectId, fileId);
  } catch (error) {
    const mockContent = await readDemoMockFileContent({ fileId, mockRoot, projectId });
    if (mockContent) return mockContent;
    throw error;
  }
  if (!file) {
    const mockContent = await readDemoMockFileContent({ fileId, mockRoot, projectId });
    if (mockContent) return mockContent;
    throw new FileContentError("File not found.", 404, "file_not_found");
  }
  if (!file.storagePath) {
    throw new FileContentError("File content is not available.", 404, "file_content_unavailable");
  }

  const absolutePath = resolveLocalStoragePath(file.storagePath, cwd);
  const body = await readFile(absolutePath);

  return {
    body,
    contentType: file.mimeType || inferContentType(file.name),
    fileName: file.name,
  };
}

async function readDemoMockFileContent({
  fileId,
  mockRoot,
  projectId,
}: {
  fileId: string;
  mockRoot: string;
  projectId: string;
}) {
  if (projectId !== "demo") return null;

  const mockFile = getDemoMockFileFixture(fileId);
  if (!mockFile) return null;

  const root = resolve(mockRoot);
  const absolutePath = resolve(root, mockFile.relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    throw new FileContentError("Mock file path is outside the allowed directory.", 403, "mock_file_path_forbidden");
  }

  try {
    const body = await readFile(absolutePath);
    return {
      body,
      contentType: mockFile.mimeType || inferContentType(mockFile.fileName),
      fileName: mockFile.fileName,
    };
  } catch (error) {
    throw new FileContentError(
      error instanceof Error ? error.message : "Mock file content is not available.",
      404,
      "file_content_unavailable",
    );
  }
}

export function inferContentType(fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "pdf") return "application/pdf";
  if (extension === "md" || extension === "markdown") return "text/markdown; charset=utf-8";
  if (extension === "txt") return "text/plain; charset=utf-8";
  if (extension === "csv") return "text/csv; charset=utf-8";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (extension === "xls") return "application/vnd.ms-excel";
  if (extension === "json") return "application/json; charset=utf-8";
  if (extension === "sql") return "application/sql; charset=utf-8";
  if (extension === "ts" || extension === "tsx") return "text/typescript; charset=utf-8";
  if (extension === "js" || extension === "jsx") return "text/javascript; charset=utf-8";
  if (extension === "html") return "text/html; charset=utf-8";
  return "application/octet-stream";
}

export function contentDispositionHeader(fileName: string, disposition: "attachment" | "inline" = "inline") {
  return `${disposition}; filename="${contentDispositionFileName(fileName)}"; filename*=UTF-8''${encodeContentDispositionFileName(fileName)}`;
}

export function contentDispositionFileName(fileName: string) {
  const sanitized = fileName
    .replace(/["\\/\r\n]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\x00-\x1F\x7F]/g, "_")
    .replace(/_+/g, "_")
    .trim();
  const extension = fileName.match(/(\.[A-Za-z0-9]{1,10})$/)?.[1] ?? "";
  const readableStem = sanitized.replace(/(\.[A-Za-z0-9]{1,10})$/, "").replace(/[_\-. ]/g, "");
  return readableStem ? sanitized : `file${extension}`;
}

function encodeContentDispositionFileName(fileName: string) {
  return encodeURIComponent(fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}
