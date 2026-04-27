import { readFile } from "node:fs/promises";
import type { PsqlRunner } from "../../db/src/runner.ts";
import { createFileRepository } from "../../db/src/repositories/files.ts";
import { createJobRunRepository } from "../../db/src/repositories/job-runs.ts";
import type { FileRecord, ProcessingTaskRecord } from "../../db/src/repositories/files.ts";
import type { JobRunRecord } from "../../shared/src/domain.ts";
import { resolveLocalStoragePath } from "../../../src/lib/local-processing.ts";
import type { DefenseFileRecord, DefenseProcessingTask } from "../../../src/lib/project-workspace.ts";
import { extractIngestContent } from "./extract.ts";
import { ingestLocalFile } from "./pipeline.ts";
import { persistIngestedFile } from "./persist.ts";
import { buildPresentationSlideRecords } from "./slides.ts";

export async function processFileIngestJob({
  projectId,
  file,
  task,
  jobId = `job-${task.id}`,
  runSql,
}: {
  projectId: string;
  file: DefenseFileRecord;
  task: DefenseProcessingTask;
  jobId?: string;
  runSql?: PsqlRunner;
}) {
  const fileRepository = createFileRepository(runSql);
  const jobRepository = createJobRunRepository(runSql);
  const startedAt = new Date().toISOString();

  try {
    if (!file.storagePath) {
      throw new Error("File storage path is missing.");
    }

    const absolutePath = resolveLocalStoragePath(file.storagePath, process.cwd());
    const buffer = await readFile(absolutePath);
    const extracted = extractIngestContent(file, buffer);

    await fileRepository.updateTask(task.id, {
      status: "processing",
      progress: 25,
      startedAt,
      error: undefined,
    });
    await jobRepository.markRunning(jobId, startedAt).catch(() => undefined);

    const ingestResult = ingestLocalFile({
      projectId,
      file,
      task,
      content: extracted.content,
      createdAt: startedAt,
    });
    const slideArtifacts = buildPresentationSlideRecords({
      projectId,
      file,
      source: ingestResult.source,
      content: extracted.content,
      createdAt: startedAt,
      synthetic: extracted.synthetic,
    });

    await persistIngestedFile({
      projectId,
      task,
      ...ingestResult,
      ...slideArtifacts,
      runSql,
    });

    await jobRepository.markSucceeded(jobId, ingestResult.artifact.createdAt, {
      artifactId: ingestResult.artifact.id,
      knowledgeChunkCount: ingestResult.chunks.length,
      slideCount: slideArtifacts.slides.length,
      contentType: extracted.contentType,
    }).catch(() => undefined);

    return {
      artifact: ingestResult.artifact,
      knowledgeChunkCount: ingestResult.chunks.length,
      slideCount: slideArtifacts.slides.length,
      contentType: extracted.contentType,
      synthetic: extracted.synthetic,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "File ingest failed.";
    await fileRepository.updateTask(task.id, {
      status: "failed",
      progress: 100,
      error: message,
      completedAt: failedAt,
    }).catch(() => undefined);
    await jobRepository.markFailed(jobId, failedAt, message).catch(() => undefined);
    throw error;
  }
}

export async function processClaimedIngestJob(job: JobRunRecord, runSql?: PsqlRunner) {
  const fileRepository = createFileRepository(runSql);
  const fileId = String(job.payload?.fileId ?? "");
  const taskId = String(job.payload?.taskId ?? "");

  if (!job.projectId || !fileId || !taskId) {
    throw new Error("Job payload missing projectId, fileId, or taskId.");
  }

  const [file, task] = await Promise.all([
    fileRepository.read(job.projectId, fileId),
    fileRepository.readTask(taskId),
  ]);

  if (!file) {
    throw new Error(`File ${fileId} not found for project ${job.projectId}.`);
  }
  if (!task) {
    throw new Error(`Processing task ${taskId} not found.`);
  }

  return processFileIngestJob({
    projectId: job.projectId,
    file: normalizeFileRecord(file),
    task: normalizeTaskRecord(task),
    jobId: job.id,
    runSql,
  });
}

function normalizeFileRecord(file: FileRecord): DefenseFileRecord {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    type: file.mimeType ?? undefined,
    storedName: file.storedName ?? undefined,
    storagePath: file.storagePath ?? undefined,
    uploadedAt: file.uploadedAt ?? undefined,
    uploadStatus: file.uploadStatus === "stored" ? "stored" : undefined,
    kind: file.kind as DefenseFileRecord["kind"],
    status: file.status,
    source: file.source,
    addedAt: file.addedAt,
  };
}

function normalizeTaskRecord(task: ProcessingTaskRecord): DefenseProcessingTask {
  return {
    id: task.id,
    fileId: task.fileId,
    fileName: task.fileName,
    kind: task.kind as DefenseProcessingTask["kind"],
    title: task.title,
    engine: task.engine,
    status: task.status as DefenseProcessingTask["status"],
    progress: task.progress,
    createdAt: task.createdAt,
    startedAt: task.startedAt ?? undefined,
    completedAt: task.completedAt ?? undefined,
    error: task.error ?? undefined,
    artifactId: task.artifactId ?? undefined,
  };
}
