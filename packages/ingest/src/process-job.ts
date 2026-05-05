import type { PsqlRunner } from "../../db/src/runner.ts";
import { createCodeRepositoryRepository } from "../../db/src/repositories/code-repositories.ts";
import { createFileRepository } from "../../db/src/repositories/files.ts";
import { createJobRunRepository } from "../../db/src/repositories/job-runs.ts";
import type { FileRecord, ProcessingTaskRecord } from "../../db/src/repositories/files.ts";
import type { JobRunRecord } from "../../shared/src/domain.ts";
import type { ParsedFileResult, ProjectSourceRecord } from "../../shared/src/domain.ts";
import type { DefenseFileRecord, DefenseProcessingTask } from "../../../src/lib/project-workspace.ts";
import { prepareRetrievalChunks } from "../../../src/lib/knowledge-db.ts";
import {
  generateExpressionKnowledgeMapForProject,
} from "../../../src/lib/expression-knowledge-map.ts";
import type { KnowledgeChunkRecord } from "../../../src/lib/knowledge-chunks.ts";
import { createConfiguredLlmProvider } from "../../../src/lib/llm-provider.ts";
import type { LlmProvider } from "../../../src/lib/llm-provider.ts";
import { runKnowledgeMapGraph } from "../../../src/lib/skill-graph.ts";
import { readStoredFileBuffer, resolveSidecarFileSource } from "../../../src/lib/stored-file-access.ts";
import { ingestLocalFile, mergeAiKnowledgeGraph } from "./pipeline.ts";
import { persistIngestedFile } from "./persist.ts";
import { renderPresentationSlides } from "./presentation-render.ts";
import { buildPresentationSlideRecords } from "./slides.ts";
import { createNotebookRagClient } from "./notebook-rag-client.ts";
import type { CodeRepositorySourceRecord } from "../../../src/lib/github-repository-source.ts";

type ProcessIngestJobOptions = {
  llmProvider?: LlmProvider | null;
};

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
    const knowledgeMapMetadata = await enhanceIngestKnowledgeMap({
      projectId,
      file,
      source: ingestResult.source,
      parsedSummary: parsed?.source.summary,
      chunks: ingestResult.chunks,
      ingestResult,
      provider: createConfiguredLlmProvider(),
      createdAt: startedAt,
    });
    const renderedSlides = await renderPresentationSlides({
      buffer,
      file,
      projectId,
    });
    const slideArtifacts = buildPresentationSlideRecords({
      projectId,
      file,
      source: ingestResult.source,
      content: extracted.content,
      parsedSlides: mergeRenderedSlides(parsed.slides ?? [], renderedSlides),
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
      ...knowledgeMapMetadata,
    }).catch(() => undefined);
    await triggerKnowledgeMapGenerationAfterIngest({
      fileId: file.id,
      projectId,
      runSql,
      sourceJobId: jobId,
      taskId: task.id,
    }).catch(() => undefined);

    return {
      artifact: ingestResult.artifact,
      knowledgeChunkCount: ingestResult.chunks.length,
      slideCount: slideArtifacts.slides.length,
      contentType: extracted.contentType,
      synthetic: extracted.synthetic,
      parser: readParserName(parsed),
      ...knowledgeMapMetadata,
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
    const knowledgeMapMetadata = await enhanceIngestKnowledgeMap({
      projectId,
      file,
      source: ingestResult.source,
      parsedSummary: parsed.source.summary,
      chunks: ingestResult.chunks,
      ingestResult,
      provider: createConfiguredLlmProvider(),
      createdAt: startedAt,
    });

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
      ...knowledgeMapMetadata,
    }).catch(() => undefined);
    await triggerKnowledgeMapGenerationAfterIngest({
      fileId: file.id,
      projectId,
      runSql,
      sourceJobId: jobId,
      taskId: task.id,
    }).catch(() => undefined);

    return {
      artifact: ingestResult.artifact,
      knowledgeChunkCount: ingestResult.chunks.length,
      slideCount: 0,
      contentType: "sidecar",
      synthetic: false,
      parser: readParserName(parsed),
      ...knowledgeMapMetadata,
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

type IngestLocalFileResult = ReturnType<typeof ingestLocalFile>;

export type KnowledgeMapIngestMetadata = {
  knowledgeMapMode: "ai" | "starter";
  knowledgeMapError?: string;
  knowledgeNodeCount: number;
  knowledgeEdgeCount: number;
};

export async function enhanceIngestKnowledgeMap({
  projectId,
  file,
  source,
  parsedSummary,
  chunks,
  ingestResult,
  provider,
  createdAt,
}: {
  projectId: string;
  file: DefenseFileRecord;
  source: ProjectSourceRecord;
  parsedSummary?: string;
  chunks: KnowledgeChunkRecord[];
  ingestResult: IngestLocalFileResult;
  provider: LlmProvider | null;
  createdAt: string;
}): Promise<KnowledgeMapIngestMetadata> {
  try {
    const graphOutput = await runKnowledgeMapGraph({
      provider,
      projectName: projectId,
      fileName: file.name,
      fileKind: file.kind,
      parsedSummary,
      chunks,
      generatedAt: createdAt,
    });
    const merged = mergeAiKnowledgeGraph({
      projectId,
      source,
      file,
      starterNodes: ingestResult.knowledgeNodes,
      starterEdges: ingestResult.knowledgeEdges,
      output: graphOutput,
      createdAt,
    });
    ingestResult.knowledgeNodes = merged.knowledgeNodes;
    ingestResult.knowledgeEdges = merged.knowledgeEdges;
    return {
      knowledgeMapMode: "ai",
      knowledgeNodeCount: ingestResult.knowledgeNodes.length,
      knowledgeEdgeCount: ingestResult.knowledgeEdges.length,
    };
  } catch (error) {
    return {
      knowledgeMapMode: "starter",
      knowledgeMapError: error instanceof Error ? error.message : "AI knowledge map generation failed.",
      knowledgeNodeCount: ingestResult.knowledgeNodes.length,
      knowledgeEdgeCount: ingestResult.knowledgeEdges.length,
    };
  }
}

async function parseWithSidecar(file: DefenseFileRecord, buffer: Buffer) {
  if (file.kind === "code") {
    return createLocalParsedFileResult(file, buffer);
  }

  const client = createNotebookRagClient();
  if (!client) {
    throw new Error("Notebook RAG sidecar is not configured.");
  }
  const fileSource = await resolveSidecarFileSource(file);

  try {
    return await client.parseFile({
      fileId: file.id,
      fileName: file.name,
      fileKind: file.kind,
      mimeType: file.type,
      storagePath: fileSource.storagePath,
      storageKey: fileSource.storageKey,
      signedUrl: fileSource.signedUrl,
      contentBase64: fileSource.signedUrl ? undefined : buffer.toString("base64"),
    });
  } catch (error) {
    if (canUseLocalTextFallback(file)) {
      return createLocalParsedFileResult(file, buffer);
    }
    throw error;
  }
}

function canUseLocalTextFallback(file: DefenseFileRecord) {
  if (["code", "database", "dataset", "other"].includes(file.kind)) return true;
  return /\.(?:txt|md|markdown|json|csv|ts|tsx|js|jsx|mjs|cjs|css|html|xml|yaml|yml|toml|ini|cmake)$/iu.test(file.name)
    || /(?:^|\/)(?:cmakelists\.txt|makefile|dockerfile)$/iu.test(file.name);
}

export function createLocalParsedFileResult(
  file: DefenseFileRecord,
  buffer: Buffer,
): ParsedFileResult {
  const content = decodeTextBuffer(buffer);
  const lineCount = content ? content.split(/\r?\n/u).length : 0;

  return {
    source: {
      title: file.name,
      summary: content
        ? `本地源码解析：${file.name}，约 ${lineCount} 行。`
        : `本地源码解析：${file.name}，文件内容为空。`,
      fileKind: file.kind,
      metadata: {
        parser: "local-code-fallback",
        storagePath: file.storagePath,
        storageKey: file.storageKey,
      },
    },
    metadata: {
      parser: "local-code-fallback",
    },
    chunks: content
      ? [{
        content,
        source: `${file.name} · ${file.kind}`,
        metadata: {
          codePath: file.name,
          language: languageFromPath(file.name),
          lineEnd: lineCount,
          lineStart: 1,
          parser: "local-code-fallback",
        },
      }]
      : [],
    preview: {
      text: content,
      outline: content ? [file.name] : [],
      metadata: {
        parser: "local-code-fallback",
      },
    },
    codeTree: [{
      path: file.name,
      language: languageFromPath(file.name),
      summary: content ? `约 ${lineCount} 行源码` : "空源码文件",
      lineCount,
    }],
  };
}

function decodeTextBuffer(buffer: Buffer) {
  return buffer.toString("utf8").replace(/\u0000/g, "").trimEnd();
}

function languageFromPath(fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "ts" || extension === "tsx") return "typescript";
  if (extension === "js" || extension === "jsx" || extension === "mjs" || extension === "cjs") return "javascript";
  if (extension === "py") return "python";
  if (extension === "sql") return "sql";
  if (extension === "json") return "json";
  if (extension === "md") return "markdown";
  if (extension === "css" || extension === "scss" || extension === "sass" || extension === "less") return "css";
  if (extension === "html" || extension === "vue" || extension === "svelte") return "html";
  if (extension === "java") return "java";
  if (extension === "go") return "go";
  if (extension === "rs") return "rust";
  if (extension === "php") return "php";
  if (extension === "rb") return "ruby";
  if (extension === "swift") return "swift";
  if (extension === "kt" || extension === "kts") return "kotlin";
  if (extension === "cs") return "csharp";
  if (extension === "c" || extension === "h") return "c";
  if (extension === "cpp" || extension === "cc" || extension === "cxx" || extension === "hpp") return "cpp";
  return undefined;
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

export function createKnowledgeMapJobRecord({
  createdAt = new Date().toISOString(),
  projectId,
  trigger,
}: {
  createdAt?: string;
  projectId: string;
  trigger?: {
    fileId?: string;
    sourceJobId?: string;
    taskId?: string;
  };
}): JobRunRecord {
  return {
    id: `job-knowledge-map-${projectId}`,
    projectId,
    kind: "knowledge_map",
    status: "queued",
    payload: {
      reason: "file_ingest_succeeded",
      ...(trigger?.fileId ? { fileId: trigger.fileId } : {}),
      ...(trigger?.sourceJobId ? { sourceJobId: trigger.sourceJobId } : {}),
      ...(trigger?.taskId ? { taskId: trigger.taskId } : {}),
    },
    createdAt,
    updatedAt: createdAt,
  };
}

export async function processKnowledgeMapJob({
  jobId,
  llmProvider,
  projectId,
  runSql,
}: {
  jobId: string;
  llmProvider?: LlmProvider | null;
  projectId: string;
  runSql?: PsqlRunner;
}) {
  const jobRepository = createJobRunRepository(runSql);
  const startedAt = new Date().toISOString();
  await jobRepository.markRunning(jobId, startedAt).catch(() => undefined);

  try {
    const result = await generateExpressionKnowledgeMapForProject({
      llmProvider,
      projectId,
      runSql,
    });
    const completedAt = new Date().toISOString();
    await jobRepository.markSucceeded(jobId, completedAt, {
      edgeCount: result.edges.length,
      nodeCount: result.nodes.length,
      nodeRole: "expression_map",
    }).catch(() => undefined);
    return {
      edgeCount: result.edges.length,
      nodeCount: result.nodes.length,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Knowledge map generation failed.";
    await jobRepository.markFailed(jobId, failedAt, message).catch(() => undefined);
    throw error;
  }
}

export async function triggerKnowledgeMapGenerationAfterIngest({
  fileId,
  projectId,
  runSql,
  sourceJobId,
  taskId,
}: {
  fileId: string;
  projectId: string;
  runSql?: PsqlRunner;
  sourceJobId: string;
  taskId: string;
}) {
  const job = createKnowledgeMapJobRecord({
    projectId,
    trigger: {
      fileId,
      sourceJobId,
      taskId,
    },
  });
  const jobRepository = createJobRunRepository(runSql);
  await jobRepository.create(job);
  return processKnowledgeMapJob({
    jobId: job.id,
    projectId,
    runSql,
  });
}

export async function processClaimedIngestJob(
  job: JobRunRecord,
  runSql?: PsqlRunner,
  options: ProcessIngestJobOptions = {},
) {
  if (job.kind === "knowledge_map") {
    if (!job.projectId) {
      throw new Error("Knowledge map job payload missing projectId.");
    }
    return processKnowledgeMapJob({
      jobId: job.id,
      llmProvider: options.llmProvider,
      projectId: job.projectId,
      runSql,
    });
  }

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

function mergeRenderedSlides<T extends { page: number; metadata?: Record<string, unknown> }>(
  parsedSlides: T[],
  renderedSlides: Array<{ page: number; imagePath: string; thumbnailPath: string }>,
) {
  if (!renderedSlides.length) return parsedSlides;
  const renderedByPage = new Map(renderedSlides.map((slide) => [slide.page, slide]));
  return parsedSlides.map((slide) => {
    const rendered = renderedByPage.get(slide.page);
    if (!rendered) return slide;
    return {
      ...slide,
      metadata: {
        ...slide.metadata,
        imagePath: rendered.imagePath,
        thumbnailPath: rendered.thumbnailPath,
      },
    };
  });
}
