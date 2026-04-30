import type { PsqlRunner } from "../../db/src/runner.ts";
import { createCodeRepositoryRepository } from "../../db/src/repositories/code-repositories.ts";
import { createFileRepository } from "../../db/src/repositories/files.ts";
import { createJobRunRepository } from "../../db/src/repositories/job-runs.ts";
import type { FileRecord, ProcessingTaskRecord } from "../../db/src/repositories/files.ts";
import type { JobRunRecord } from "../../shared/src/domain.ts";
import type { DefenseFileRecord, DefenseProcessingTask } from "../../../src/lib/project-workspace.ts";
import { prepareRetrievalChunks } from "../../../src/lib/knowledge-db.ts";
import { readStoredFileBuffer, resolveSidecarFileSource } from "../../../src/lib/stored-file-access.ts";
import { ingestLocalFile } from "./pipeline.ts";
import { persistIngestedFile } from "./persist.ts";
import { buildPresentationSlideRecords } from "./slides.ts";
import { createNotebookRagClient } from "./notebook-rag-client.ts";
import type { CodeRepositorySourceRecord } from "../../../src/lib/github-repository-source.ts";

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
    if (!file.storagePath && !file.storageKey) {
      throw new Error("File storage location is missing.");
    }

    await fileRepository.updateTask(task.id, {
      status: "processing",
      progress: 25,
      startedAt,
      error: undefined,
    });
    await jobRepository.markRunning(jobId, startedAt).catch(() => undefined);

    const buffer = await readStoredFileBuffer(file, process.cwd());
    const parsed = await parseWithSidecar(file, buffer);
    const extracted = {
      content: contentFromParsedFile(parsed),
      contentType: "sidecar",
      synthetic: false,
    };

    const ingestResult = ingestLocalFile({
      projectId,
      file,
      task,
      content: extracted.content,
      parsed: parsed ?? undefined,
      createdAt: startedAt,
    });
    ingestResult.chunks = await prepareRetrievalChunks(ingestResult.chunks);
    const slideArtifacts = buildPresentationSlideRecords({
      projectId,
      file,
      source: ingestResult.source,
      content: extracted.content,
      parsedSlides: parsed.slides ?? [],
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
      parser: readParserName(parsed),
    }).catch(() => undefined);

    return {
      artifact: ingestResult.artifact,
      knowledgeChunkCount: ingestResult.chunks.length,
      slideCount: slideArtifacts.slides.length,
      contentType: extracted.contentType,
      synthetic: extracted.synthetic,
      parser: readParserName(parsed),
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

export async function processRepositoryIngestJob({
  projectId,
  file,
  task,
  repository,
  jobId = `job-${task.id}`,
  runSql,
}: {
  projectId: string;
  file: DefenseFileRecord;
  task: DefenseProcessingTask;
  repository: CodeRepositorySourceRecord;
  jobId?: string;
  runSql?: PsqlRunner;
}) {
  const fileRepository = createFileRepository(runSql);
  const jobRepository = createJobRunRepository(runSql);
  const repositoryRepository = createCodeRepositoryRepository(runSql);
  const startedAt = new Date().toISOString();

  try {
    await fileRepository.updateTask(task.id, {
      status: "processing",
      progress: 25,
      startedAt,
      error: undefined,
    });
    await jobRepository.markRunning(jobId, startedAt).catch(() => undefined);
    await repositoryRepository.update(repository.id, {
      status: "processing",
      metadata: {
        ...repository.metadata,
        parser: "repomix",
      },
    }).catch(() => undefined);

    const parsed = await parseRepositoryWithSidecar(file, repository.url);
    const ingestResult = ingestLocalFile({
      projectId,
      file,
      task,
      content: contentFromParsedFile(parsed),
      parsed,
      createdAt: startedAt,
    });
    ingestResult.chunks = await prepareRetrievalChunks(ingestResult.chunks);

    await persistIngestedFile({
      projectId,
      task,
      ...ingestResult,
      runSql,
    });

    await repositoryRepository.update(repository.id, {
      status: "ready",
      parser: "repomix",
      defaultBranch: readStringMetadata(parsed.source.metadata, "defaultBranch") ?? repository.defaultBranch,
      latestCommitSha: readStringMetadata(parsed.source.metadata, "latestCommitSha") ?? repository.latestCommitSha,
      metadata: {
        ...repository.metadata,
        ...(parsed.source.metadata ?? {}),
        parser: "repomix",
      },
    }).catch(() => undefined);

    await jobRepository.markSucceeded(jobId, ingestResult.artifact.createdAt, {
      artifactId: ingestResult.artifact.id,
      knowledgeChunkCount: ingestResult.chunks.length,
      slideCount: 0,
      contentType: "sidecar",
      parser: readParserName(parsed),
    }).catch(() => undefined);

    return {
      artifact: ingestResult.artifact,
      knowledgeChunkCount: ingestResult.chunks.length,
      slideCount: 0,
      contentType: "sidecar",
      synthetic: false,
      parser: readParserName(parsed),
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Repository ingest failed.";
    await fileRepository.updateTask(task.id, {
      status: "failed",
      progress: 100,
      error: message,
      completedAt: failedAt,
    }).catch(() => undefined);
    await repositoryRepository.update(repository.id, {
      status: "failed",
      metadata: {
        ...repository.metadata,
        error: message,
      },
    }).catch(() => undefined);
    await jobRepository.markFailed(jobId, failedAt, message).catch(() => undefined);
    throw error;
  }
}

async function parseWithSidecar(file: DefenseFileRecord, buffer: Buffer) {
  const client = createNotebookRagClient();
  if (!client) {
    throw new Error("Notebook RAG sidecar is not configured.");
  }
  const fileSource = await resolveSidecarFileSource(file);

  return client.parseFile({
    fileId: file.id,
    fileName: file.name,
    fileKind: file.kind,
    mimeType: file.type,
    storagePath: fileSource.storagePath,
    storageKey: fileSource.storageKey,
    signedUrl: fileSource.signedUrl,
    contentBase64: fileSource.signedUrl ? undefined : buffer.toString("base64"),
  });
}

async function parseRepositoryWithSidecar(file: DefenseFileRecord, repositoryUrl: string) {
  const client = createNotebookRagClient();
  if (!client) {
    throw new Error("Notebook RAG sidecar is not configured.");
  }

  return client.parseFile({
    fileId: file.id,
    fileName: file.name,
    fileKind: file.kind,
    mimeType: file.type,
    repositoryUrl,
  });
}

function contentFromParsedFile(parsed: Awaited<ReturnType<NonNullable<ReturnType<typeof createNotebookRagClient>>["parseFile"]>>) {
  const chunkContent = parsed.chunks.map((chunk) => chunk.content.trim()).filter(Boolean);
  if (chunkContent.length) return chunkContent.join("\n\n");

  const previewText = parsed.preview.text?.trim();
  if (previewText) return previewText;

  return [
    parsed.source.title,
    parsed.source.summary,
    ...(parsed.preview.outline ?? []),
  ].filter(Boolean).join("\n");
}

export async function processClaimedIngestJob(job: JobRunRecord, runSql?: PsqlRunner) {
  const fileRepository = createFileRepository(runSql);
  const repositoryRepository = createCodeRepositoryRepository(runSql);
  const fileId = String(job.payload?.fileId ?? "");
  const taskId = String(job.payload?.taskId ?? "");
  const repositoryId = String(job.payload?.repositoryId ?? "");

  if (!job.projectId || !fileId || !taskId) {
    throw new Error("Job payload missing projectId, fileId, or taskId.");
  }

  const [file, task, repository] = await Promise.all([
    fileRepository.read(job.projectId, fileId),
    fileRepository.readTask(taskId),
    job.kind === "repository_ingest" && repositoryId
      ? repositoryRepository.read(repositoryId)
      : Promise.resolve(null),
  ]);

  if (!file) {
    throw new Error(`File ${fileId} not found for project ${job.projectId}.`);
  }
  if (!task) {
    throw new Error(`Processing task ${taskId} not found.`);
  }
  if (job.kind === "repository_ingest") {
    if (!repository) {
      throw new Error(`Code repository ${repositoryId} not found.`);
    }
    return processRepositoryIngestJob({
      projectId: job.projectId,
      file: normalizeFileRecord(file),
      task: normalizeTaskRecord(task),
      repository,
      jobId: job.id,
      runSql,
    });
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
    storageKey: file.storageKey ?? undefined,
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

function readParserName(parsed: Awaited<ReturnType<NonNullable<ReturnType<typeof createNotebookRagClient>>["parseFile"]>>) {
  return readStringMetadata(parsed.metadata, "parser")
    ?? readStringMetadata(parsed.source.metadata, "parser")
    ?? "notebook-rag-sidecar";
}

function readStringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}
