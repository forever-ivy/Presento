import type { DefenseFileInput } from "./project-workspace";

export type StoredFileInput = Required<Pick<DefenseFileInput, "name" | "size">> &
  Pick<DefenseFileInput, "type">;

export type StoredFileRecord = DefenseFileInput & {
  storedName: string;
  storagePath: string;
  uploadedAt: string;
  uploadStatus: "stored";
};

export function sanitizeFileName(fileName: string) {
  const baseName = fileName
    .split(/[\\/]/)
    .pop()
    ?.trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "")
    .replace(/[-_.]+$/g, "");

  return baseName || "untitled";
}

export function uploadDateFolder(uploadedAt: string) {
  return uploadedAt.slice(0, 10);
}

export function buildStoredFileRecord(
  file: StoredFileInput,
  options: {
    nonce: string;
    uploadedAt: string;
  },
): StoredFileRecord {
  const storedName = `${options.nonce}-${sanitizeFileName(file.name)}`;
  const storagePath = `.data/uploads/${uploadDateFolder(options.uploadedAt)}/${storedName}`;

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    storedName,
    storagePath,
    uploadedAt: options.uploadedAt,
    uploadStatus: "stored",
  };
}
