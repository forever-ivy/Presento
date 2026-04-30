import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createFileRepository } from "@db/repositories/files";
import { buildPersistedFileBatch } from "../projects/helpers";
import { assertSupportedUploadFiles } from "@/lib/project-workspace";
import { readObjectStorageConfig, uploadObjectToStorage } from "@/lib/object-storage";
import {
  buildStoredFileRecord,
  uploadDateFolder,
} from "@/lib/upload-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const projectIdValue = formData.get("projectId");
  const projectId = typeof projectIdValue === "string" && projectIdValue.trim() ? projectIdValue.trim() : null;
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (!files.length) {
    return NextResponse.json(
      { error: "No files were uploaded." },
      { status: 400 },
    );
  }

  try {
    assertSupportedUploadFiles(files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    })));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unsupported upload." },
      { status: 400 },
    );
  }

  const uploadedAt = new Date().toISOString();
  const dateFolder = uploadDateFolder(uploadedAt);
  const objectStorageConfig = readObjectStorageConfig();
  const uploadDirectory = path.join(process.cwd(), ".data", "uploads", dateFolder);

  if (!objectStorageConfig) {
    await mkdir(uploadDirectory, { recursive: true });
  }

  const uploadedFiles = await Promise.all(
    files.map(async (file) => {
      const nonce = crypto.randomUUID().slice(0, 8);
      const bytes = Buffer.from(await file.arrayBuffer());
      const record = buildStoredFileRecord(
        {
          name: file.name,
          size: file.size,
          type: file.type,
        },
        {
          nonce,
          uploadedAt,
          storageMode: objectStorageConfig ? "object" : "local",
          bucket: objectStorageConfig?.bucket,
        },
      );

      if (record.storageKey) {
        await uploadObjectToStorage({
          key: record.storageKey,
          body: bytes,
          contentType: file.type,
          config: objectStorageConfig,
        });
      } else {
        await writeFile(path.join(uploadDirectory, record.storedName), bytes);
      }

      return record;
    }),
  );

  if (projectId) {
    const batch = buildPersistedFileBatch(projectId, uploadedFiles);
    await createFileRepository().createBatch(batch);
    return NextResponse.json({ uploadedFiles, ...batch });
  }

  return NextResponse.json({ uploadedFiles });
}
