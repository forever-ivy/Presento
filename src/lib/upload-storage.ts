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

const ignoredUploadDirectories = new Set([
  ".cache",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".venv",
  ".vercel",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "venv",
]);

const ignoredUploadFileNames = new Set([
  ".ds_store",
  ".env",
  ".env.development",
  ".env.local",
  ".env.production",
  ".env.test",
]);

const ignoredUploadExtensions = [".key", ".p12", ".pem", ".pfx"];

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

export function normalizeUploadPath(relativePath: string | null | undefined, fallbackName: string) {
  const rawPath = `${relativePath ?? ""}`.trim() || fallbackName;
  const segments = rawPath
    .replace(/\\/g, "/")
    .replace(/^\/+/u, "")
    .split("/")
    .map(sanitizeUploadPathSegment)
    .filter((segment) => segment && segment !== "." && segment !== "..");

  return segments.length ? segments.join("/") : sanitizeFileName(fallbackName);
}

export function isIgnoredUploadPath(filePath: string) {
  const normalized = normalizeUploadPath(filePath, filePath);
  const segments = normalized.split("/");
  const fileName = segments.at(-1)?.toLowerCase() ?? "";

  if (segments.slice(0, -1).some((segment) => ignoredUploadDirectories.has(segment.toLowerCase()))) {
    return true;
  }

  return ignoredUploadFileNames.has(fileName)
    || ignoredUploadExtensions.some((extension) => fileName.endsWith(extension));
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
  const displayName = normalizeUploadPath(file.name, file.name);
  const storedName = `${options.nonce}-${sanitizeFileName(displayName)}`;
  const storageKey = `${uploadDateFolder(options.uploadedAt)}/${storedName}`;
  const storagePath = options.storageMode === "object"
    ? buildObjectStoragePath(options.bucket, storageKey)
    : `.data/uploads/${storageKey}`;

  return {
    name: displayName,
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

function sanitizeUploadPathSegment(segment: string) {
  return segment
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]+/g, "");
}
