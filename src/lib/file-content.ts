import { createFileRepository } from "../../packages/db/src/repositories/files.ts";
import { readStoredFileBuffer } from "./stored-file-access.ts";

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
  projectId,
  repository = createFileRepository(),
}: {
  cwd?: string;
  fileId: string;
  projectId: string;
  repository?: FileRepository;
}) {
  const file = await repository.read(projectId, fileId);
  if (!file) {
    throw new FileContentError("File not found.", 404, "file_not_found");
  }
  if (!file.storagePath && !file.storageKey) {
    throw new FileContentError("File content is not available.", 404, "file_content_unavailable");
  }

  const body = await readStoredFileBuffer(file, cwd);

  return {
    body,
    contentType: file.mimeType || inferContentType(file.name),
    fileName: file.name,
  };
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
