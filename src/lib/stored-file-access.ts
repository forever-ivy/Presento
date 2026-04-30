import { readFile } from "node:fs/promises";
import { createSignedReadUrl, readObjectFromStorage } from "./object-storage.ts";
import { resolveLocalStoragePath } from "./local-processing.ts";
import type { DefenseFileRecord } from "./project-workspace.ts";

export async function readStoredFileBuffer(
  file: { storageKey?: string | null; storagePath?: string | null },
  cwd = process.cwd(),
) {
  if (file.storageKey) {
    return readObjectFromStorage({ key: file.storageKey });
  }

  if (file.storagePath) {
    const absolutePath = resolveLocalStoragePath(file.storagePath, cwd);
    return readFile(absolutePath);
  }

  throw new Error("File storage location is missing.");
}

export async function resolveSidecarFileSource(
  file: Pick<DefenseFileRecord, "storageKey" | "storagePath">,
) {
  if (file.storageKey) {
    return {
      storageKey: file.storageKey,
      storagePath: file.storagePath,
      signedUrl: await createSignedReadUrl({ key: file.storageKey }),
    };
  }

  return {
    storageKey: file.storageKey,
    storagePath: file.storagePath,
    signedUrl: undefined,
  };
}
