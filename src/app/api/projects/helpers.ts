import { z } from "zod";
import type { JobRunRecord } from "@shared/domain";
import type { PersistedFileRecord, PersistedTaskRecord } from "@db/repositories/files";
import {
  assertSupportedUploadFiles,
  createFileRecord,
  createProcessingTasks,
  stableId,
  type DefenseFileInput,
  type DefenseFileRecord,
} from "@/lib/project-workspace";

export const projectPayloadSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  ownerScope: z.string().default(""),
  teammateScope: z.string().default(""),
});

export const uploadedFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().nonnegative(),
  type: z.string().optional(),
  storedName: z.string().optional(),
  storagePath: z.string().optional(),
  storageKey: z.string().optional(),
  uploadedAt: z.string().optional(),
  uploadStatus: z.literal("stored").optional(),
});

export function createProjectRecord(input: z.infer<typeof projectPayloadSchema>) {
  const now = new Date().toISOString();
  return {
    id: `project-${stableId(input.name, now, crypto.randomUUID())}`,
    name: input.name,
    category: input.category,
    ownerScope: input.ownerScope,
    teammateScope: input.teammateScope,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildPersistedFileBatch(projectId: string, uploadedFiles: DefenseFileInput[]) {
  assertSupportedUploadFiles(uploadedFiles);
  const addedAt = new Date().toISOString();
  const fileRecords = uploadedFiles.map((file) => createFileRecord(file, addedAt));
  const taskRecords = createProcessingTasks(fileRecords, addedAt);

  const files: PersistedFileRecord[] = fileRecords.map((file) => ({
    ...file,
    projectId,
  }));
  const processingTasks: PersistedTaskRecord[] = taskRecords.map((task) => ({
    ...task,
    projectId,
  }));
  const jobRuns: JobRunRecord[] = taskRecords.map((task) => ({
    id: `job-${task.id}`,
    projectId,
    kind: "file_ingest",
    status: "queued",
    payload: {
      fileId: task.fileId,
      taskId: task.id,
      title: task.title,
      kind: task.kind,
      fileName: task.fileName,
    },
    createdAt: addedAt,
    updatedAt: addedAt,
  }));

  return {
    files,
    processingTasks,
    jobRuns,
  };
}

export function asDefenseFileRecord(file: PersistedFileRecord): DefenseFileRecord {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    type: file.mimeType ?? undefined,
    storedName: file.storedName ?? undefined,
    storagePath: file.storagePath ?? undefined,
    storageKey: file.storageKey ?? undefined,
    uploadedAt: file.uploadedAt ?? undefined,
    uploadStatus: file.uploadStatus === "stored" ? "stored" : undefined,
    kind: file.kind as DefenseFileRecord["kind"],
    status: file.status,
    source: file.source,
    addedAt: file.addedAt,
  };
}
