import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { createFileRepository } from "@db/repositories/files";
import { buildPersistedFileBatch } from "../projects/helpers";
import { assertSupportedUploadFiles, isUnsupportedCodeArchive } from "@/lib/project-workspace";
import { readObjectStorageConfig, uploadObjectToStorage } from "@/lib/object-storage";
import {
  buildStoredFileRecord,
  isIgnoredUploadPath,
  normalizeUploadPath,
  uploadDateFolder,
} from "@/lib/upload-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const formData = await request.formData();
  const projectIdValue = formData.get("projectId") ?? requestUrl.searchParams.get("projectId");
  const projectId = typeof projectIdValue === "string" && projectIdValue.trim() ? projectIdValue.trim() : null;
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const relativePaths = formData.getAll("relativePaths");
  const preparedUploadItems = files.map((file, index) => {
    const relativePath = relativePaths[index];
    const displayName = normalizeUploadPath(
      typeof relativePath === "string" ? relativePath : undefined,
      file.name,
    );

    return { file, displayName };
  });
  const ignoredUploadItems = preparedUploadItems.filter(({ displayName }) =>
    isIgnoredUploadPath(displayName)
    || (displayName.includes("/") && isUnsupportedCodeArchive(displayName)),
  );
  const uploadItems = preparedUploadItems.filter(({ displayName }) =>
    !isIgnoredUploadPath(displayName)
    && !(displayName.includes("/") && isUnsupportedCodeArchive(displayName)),
  );

  if (!uploadItems.length) {
    return NextResponse.json(
      { error: "No supported files were uploaded." },
      { status: 400 },
    );
  }

  try {
    assertSupportedUploadFiles(uploadItems.map(({ file, displayName }) => ({
      name: displayName,
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
    uploadItems.map(async ({ file, displayName }) => {
      const nonce = crypto.randomUUID().slice(0, 8);
      const bytes = Buffer.from(await file.arrayBuffer());
      const record = buildStoredFileRecord(
        {
          name: displayName,
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
    return NextResponse.json({
      ignoredFileCount: ignoredUploadItems.length,
      ignoredFilesPreview: ignoredUploadItems.slice(0, 12).map((item) => item.displayName),
      uploadedFiles,
      ...batch,
    });
  }

  return NextResponse.json({
    ignoredFileCount: ignoredUploadItems.length,
    ignoredFilesPreview: ignoredUploadItems.slice(0, 12).map((item) => item.displayName),
    uploadedFiles,
  });
}
