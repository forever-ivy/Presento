import type { DefenseFileInput } from "./project-workspace";

export type StoredFileInput = Required<Pick<DefenseFileInput, "name" | "size">> &
  Pick<DefenseFileInput, "type">;

export type StoredFileRecord = DefenseFileInput & {
  storedName: string;
  storagePath: string;
  storageKey?: string;
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
    storageMode?: "local" | "object";
    bucket?: string;
  },
): StoredFileRecord {
  const storedName = `${options.nonce}-${sanitizeFileName(file.name)}`;
  const storageKey = `${uploadDateFolder(options.uploadedAt)}/${storedName}`;
  const storagePath = options.storageMode === "object"
    ? buildObjectStoragePath(options.bucket, storageKey)
    : `.data/uploads/${storageKey}`;

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    storedName,
    storagePath,
    ...(options.storageMode === "object" ? { storageKey } : {}),
    uploadedAt: options.uploadedAt,
    uploadStatus: "stored",
  };
}

function buildObjectStoragePath(bucket: string | undefined, storageKey: string) {
  if (!bucket) {
    throw new Error("Object storage bucket is required when building object storage metadata.");
  }
  return `s3://${bucket}/${storageKey}`;
}
