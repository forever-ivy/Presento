import { createUIMessageStreamResponse } from "ai";
import { createFileExplanationRepository } from "@db/repositories/file-explanations";
import { createFileRepository, type FileRecord } from "@db/repositories/files";
import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import {
  createNotebookRagClient,
  type ExplainFileResponse,
  type ExplainFileStreamEvent,
} from "@ingest/notebook-rag-client";
import type {
  FileExplanationSessionRecord,
  FileExplanationTurnRecord,
  KnowledgeNodeRecord,
  NotebookExplanationMode,
} from "@shared/domain";
import type { KnowledgeChunkRecord } from "./knowledge-chunks";
import {
  readFileKnowledgeChunks,
  retrieveRelevantFileKnowledgeChunks,
} from "./knowledge-db";
import { createFileExplanationUIMessageStream } from "./file-explanation-stream";

type FocusNodeContext = {
  node: KnowledgeNodeRecord;
  question: string;
};

export async function getFileNodePreview(
  projectId: string,
  nodeId: string,
  options: {
    focusNodeId?: string;
  } = {},
) {
  const node = await readExplainableFileNode(projectId, nodeId);
  const focus = await readFocusNodeContext(projectId, options.focusNodeId);
  const fileId = String(node.metadata.fileId);
  const sourceFile = await createFileRepository().read(projectId, fileId);
  const sourceFileName = sourceFile?.name
    ?? metadataString(node.metadata.sourcePath)
    ?? metadataString(node.metadata.fileName)
    ?? node.title;
  const fileKind = sourceFile?.kind ?? metadataString(node.metadata.fileKind);
  const mimeType = sourceFile?.mimeType ?? metadataString(node.metadata.mimeType);
  const chunks = await readOrderedFileChunks(projectId, fileId, 8);
  return {
    node,
    focusNode: focus
      ? {
        id: focus.node.id,
        title: focus.node.title,
        question: focus.question,
      }
      : undefined,
    viewer: node.metadata.viewer,
    explainable: node.metadata.explainable,
    file: {
      id: fileId,
      sourceId: node.metadata.sourceId ?? node.sourceId,
      kind: fileKind,
      mimeType,
      fileName: sourceFileName,
      sourcePath: sourceFileName,
    },
    preview: previewWithSourceFileName(node.metadata.preview, sourceFileName) ?? {
      fileName: sourceFileName,
      text: chunks.slice(0, 3).map((chunk) => chunk.content).join("\n\n"),
      outline: chunks.slice(0, 5).map((chunk) => firstLine(chunk.content)),
    },
    citations: chunks.slice(0, 5).map((chunk) => citationFromChunk(chunk)),
    chunks: chunks.slice(0, 8),
  };
}

export async function createFileExplanationSession({
  focusNodeId,
  projectId,
  nodeId,
  mode,
}: {
  focusNodeId?: string;
  projectId: string;
  nodeId: string;
  mode: NotebookExplanationMode;
}) {
  const node = await readExplainableFileNode(projectId, nodeId);
  const focus = await readFocusNodeContext(projectId, focusNodeId);
  const fileId = String(node.metadata.fileId);
  const repository = createFileExplanationRepository();
  const reusableSession = await repository.readReusableSession({
    projectId,
    nodeId,
    fileId,
    mode,
    focusNodeId: focus?.node.id,
  });
  if (reusableSession) return reusableSession;

  const chunks = await readExplanationCandidateChunks({
    projectId,
    fileId,
    fileName: node.title,
    mode,
    question: focus?.question,
  });
  const now = new Date().toISOString();
  const explanation = await explainWithSidecarOrFallback({
    node,
    chunks,
    mode,
    question: focus?.question,
  });
  const session: FileExplanationSessionRecord = {
    id: `file-session-${crypto.randomUUID()}`,
    projectId,
    nodeId,
    fileId,
    sourceId: typeof node.sourceId === "string" ? node.sourceId : undefined,
    mode,
    status: deriveSessionStatus(explanation),
    summary: explanation.summary,
    outline: explanation.outline,
    citations: explanation.citations,
    metadata: {
      ...buildSessionMetadata(explanation, chunks.length),
      ...focusMetadata(focus),
    },
    createdAt: now,
    updatedAt: now,
  };
  const assistantTurn: FileExplanationTurnRecord = {
    id: `file-turn-${crypto.randomUUID()}`,
    sessionId: session.id,
    projectId,
    role: "assistant",
    content: explanation.answer ?? explanation.summary,
    citations: explanation.citations,
    metadata: buildTurnMetadata({
      mode,
      explanation,
      focus,
      retrievalFallbackCount: chunks.length,
      initial: true,
    }),
    createdAt: now,
  };

  await repository.createSession(session);
  await repository.addTurn(assistantTurn);
  return repository.readSession(projectId, session.id);
}

export async function addFileExplanationTurn({
  projectId,
  sessionId,
  question,
}: {
  projectId: string;
  sessionId: string;
  question: string;
}) {
  const repository = createFileExplanationRepository();
  const session = await repository.readSession(projectId, sessionId);
  if (!session) return null;

  const chunks = await readExplanationCandidateChunks({
    projectId,
    fileId: session.fileId,
    fileName: readFileNameFromSession(session),
    mode: session.mode,
    question,
  });
  const now = new Date().toISOString();
  const userTurn: FileExplanationTurnRecord = {
    id: `file-turn-${crypto.randomUUID()}`,
    sessionId,
    projectId,
    role: "user",
    content: question,
    citations: [],
    metadata: {},
    createdAt: now,
  };
  const answer = await chatWithSidecarOrFallback({
    fileId: session.fileId,
    fileName: readFileNameFromSession(session),
    mode: session.mode,
    chunks,
    question,
    conversationContext: session.turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  });
  const assistantTurn: FileExplanationTurnRecord = {
    id: `file-turn-${crypto.randomUUID()}`,
    sessionId,
    projectId,
    role: "assistant",
    content: answer.answer ?? answer.summary,
    citations: answer.citations,
    metadata: buildTurnMetadata({
      mode: session.mode,
      explanation: answer,
      retrievalFallbackCount: chunks.length,
    }),
    createdAt: new Date().toISOString(),
  };

  await repository.addTurn(userTurn);
  await repository.addTurn(assistantTurn);
  await repository.createSession({
    ...session,
    status: deriveSessionStatus(answer),
    summary: answer.summary,
    outline: answer.outline,
    citations: answer.citations,
    metadata: {
      ...session.metadata,
      ...buildSessionMetadata(answer, chunks.length),
    },
    updatedAt: assistantTurn.createdAt,
  });
  return repository.readSession(projectId, sessionId);
}

export async function createFileExplanationSessionStream({
  focusNodeId,
  projectId,
  nodeId,
  mode,
}: {
  focusNodeId?: string;
  projectId: string;
  nodeId: string;
  mode: NotebookExplanationMode;
}) {
  const repository = createFileExplanationRepository();
  const node = await readExplainableFileNode(projectId, nodeId);
  const focus = await readFocusNodeContext(projectId, focusNodeId);
  const fileId = String(node.metadata.fileId);
  const chunks = await readExplanationCandidateChunks({
    projectId,
    fileId,
    fileName: node.title,
    mode,
    question: focus?.question,
  });
  const now = new Date().toISOString();
  const session: FileExplanationSessionRecord = {
    id: `file-session-${crypto.randomUUID()}`,
    projectId,
    nodeId,
    fileId,
    sourceId: typeof node.sourceId === "string" ? node.sourceId : undefined,
    mode,
    status: "streaming",
    summary: "",
    outline: [],
    citations: [],
    metadata: {
      followUps: [],
      quiz: [],
      weaknessCandidates: [],
      grounded: false,
      insufficientEvidence: false,
      retrievalCount: chunks.length,
      fallbackUsed: false,
      engine: "stream-pending",
      ...focusMetadata(focus),
    },
    createdAt: now,
    updatedAt: now,
  };
  await repository.createSession(session);

  const turnId = `file-turn-${crypto.randomUUID()}`;
  const stream = createFileExplanationUIMessageStream({
    sessionId: session.id,
    turnId,
    mode,
    events: captureStreamFailures(
      await explainWithSidecarStreamOrFallback({
        fileId,
        fileName: node.title,
        mode,
        chunks,
        question: focus?.question,
      }),
      async (error) => {
        await repository.createSession(markSessionFailed(session, error));
      },
    ),
    onComplete: async (result) => {
      const createdAt = new Date().toISOString();
      await repository.createSession({
        ...session,
        status: deriveSessionStatus(result),
        summary: result.summary,
        outline: result.outline,
        citations: result.citations,
        metadata: {
          ...buildSessionMetadata(result, chunks.length),
          ...focusMetadata(focus),
        },
        updatedAt: createdAt,
      });
      await repository.addTurn({
        id: turnId,
        sessionId: session.id,
        projectId,
        role: "assistant",
        content: result.answer ?? result.summary,
        citations: result.citations,
        metadata: buildTurnMetadata({
          mode,
          explanation: result,
          focus,
          retrievalFallbackCount: chunks.length,
          initial: true,
        }),
        createdAt,
      });
    },
  });

  return createUIMessageStreamResponse({
    status: 201,
    stream,
  });
}

export async function addFileExplanationTurnStream({
  projectId,
  sessionId,
  question,
}: {
  projectId: string;
  sessionId: string;
  question: string;
}) {
  const repository = createFileExplanationRepository();
  const session = await repository.readSession(projectId, sessionId);
  if (!session) return null;

  const now = new Date().toISOString();
  const userTurn: FileExplanationTurnRecord = {
    id: `file-turn-${crypto.randomUUID()}`,
    sessionId,
    projectId,
    role: "user",
    content: question,
    citations: [],
    metadata: {},
    createdAt: now,
  };
  await repository.addTurn(userTurn);
  await repository.createSession({
    ...session,
    status: "streaming",
    updatedAt: now,
  });

  const chunks = await readExplanationCandidateChunks({
    projectId,
    fileId: session.fileId,
    fileName: readFileNameFromSession(session),
    mode: session.mode,
    question,
  });
  const turnId = `file-turn-${crypto.randomUUID()}`;
  const stream = createFileExplanationUIMessageStream({
    sessionId,
    turnId,
    mode: session.mode,
    events: captureStreamFailures(
      await chatWithSidecarStreamOrFallback({
        fileId: session.fileId,
        fileName: readFileNameFromSession(session),
        mode: session.mode,
        chunks,
        question,
        conversationContext: session.turns.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
      }),
      async (error) => {
        await repository.createSession(markSessionFailed(session, error));
      },
    ),
    onComplete: async (result) => {
      const createdAt = new Date().toISOString();
      await repository.addTurn({
        id: turnId,
        sessionId,
        projectId,
        role: "assistant",
        content: result.answer ?? result.summary,
        citations: result.citations,
        metadata: buildTurnMetadata({
          mode: session.mode,
          explanation: result,
          retrievalFallbackCount: chunks.length,
        }),
        createdAt,
      });
      await repository.createSession({
        ...session,
        status: deriveSessionStatus(result),
        summary: result.summary,
        outline: result.outline,
        citations: result.citations,
        metadata: {
          ...session.metadata,
          ...buildSessionMetadata(result, chunks.length),
        },
        updatedAt: createdAt,
      });
    },
  });

  return createUIMessageStreamResponse({
    status: 201,
    stream,
  });
}

async function readExplainableFileNode(projectId: string, nodeId: string) {
  const node = await createKnowledgeMapRepository().readNode(projectId, nodeId);
  if (!node) {
    return readWorkspaceFileNode(projectId, nodeId);
  }
  if (node.kind !== "file") {
    throw new Error("Knowledge node is not a file leaf node.");
  }
  if (!node.metadata.fileId) {
    throw new Error("File leaf node is missing file metadata.");
  }
  return node;
}

async function readWorkspaceFileNode(projectId: string, nodeId: string): Promise<KnowledgeNodeRecord> {
  const fileId = nodeId.startsWith("workspace-file-")
    ? nodeId.slice("workspace-file-".length)
    : undefined;
  if (!fileId) {
    throw new Error("Knowledge node is not a file leaf node.");
  }

  const file = await createFileRepository().read(projectId, fileId);
  if (!file) {
    throw new Error("Knowledge node is not a file leaf node.");
  }

  return buildWorkspaceFileNode(projectId, nodeId, file);
}

function buildWorkspaceFileNode(projectId: string, nodeId: string, file: FileRecord): KnowledgeNodeRecord {
  const title = basenameFromPath(file.name);
  return {
    id: nodeId,
    projectId,
    kind: "file",
    title,
    summary: file.status || "文件已接入。",
    tone: toneForFileKind(file.kind),
    sourceId: file.source,
    metadata: {
      explainable: true,
      fileId: file.id,
      fileKind: file.kind,
      mimeType: file.mimeType,
      preview: {
        fileName: file.name,
        text: file.status || "文件已接入。",
      },
      sourceId: file.source,
      sourcePath: file.name,
      viewer: viewerForFileKind(file.kind),
    },
    createdAt: file.addedAt,
  };
}

function basenameFromPath(path: string) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) || path || "未命名资料";
}

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function previewWithSourceFileName(preview: unknown, fileName: string) {
  if (!isRecord(preview)) return undefined;
  return {
    ...preview,
    fileName: metadataString(preview.fileName) ?? fileName,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function viewerForFileKind(kind: FileRecord["kind"]) {
  if (kind === "presentation") return "presentation";
  if (kind === "document") return "docx";
  if (kind === "code") return "code";
  if (kind === "database") return "sql";
  if (kind === "dataset") return "table";
  return "details";
}

function toneForFileKind(kind: FileRecord["kind"]): KnowledgeNodeRecord["tone"] {
  if (kind === "presentation") return "purple";
  if (kind === "document") return "cyan";
  if (kind === "code") return "green";
  if (kind === "database") return "orange";
  if (kind === "dataset") return "blue";
  if (kind === "asset") return "cyan";
  return "cyan";
}

async function readFocusNodeContext(projectId: string, focusNodeId: string | undefined): Promise<FocusNodeContext | undefined> {
  if (!focusNodeId) return undefined;
  const node = await createKnowledgeMapRepository().readNode(projectId, focusNodeId);
  if (!node) {
    throw new Error("Focus knowledge node was not found.");
  }
  return {
    node,
    question: `这份资料如何支撑「${node.title}」这个答辩讲点？`,
  };
}

async function readOrderedFileChunks(projectId: string, fileId: string, limit = 24) {
  return readFileKnowledgeChunks({
    projectId,
    fileId,
    limit,
  });
}

async function readExplanationCandidateChunks({
  projectId,
  fileId,
  fileName,
  mode,
  question,
}: {
  projectId: string;
  fileId: string;
  fileName: string;
  mode: NotebookExplanationMode;
  question?: string;
}) {
  const candidateLimit = candidateLimitForMode(mode);
  if (question?.trim()) {
    const retrieved = await retrieveRelevantFileKnowledgeChunks({
      projectId,
      fileId,
      query: question,
      limit: candidateLimit,
    });
    if (retrieved.length > 0) return retrieved;
  }

  const fallbackChunks = await readOrderedFileChunks(projectId, fileId, candidateLimit);
  if (fallbackChunks.length > 0) return fallbackChunks;

  if (!question?.trim()) {
    return retrieveRelevantFileKnowledgeChunks({
      projectId,
      fileId,
      query: fileName,
      limit: candidateLimit,
    });
  }

  return [];
}

async function explainWithSidecarOrFallback({
  node,
  chunks,
  mode,
  question,
}: {
  node: KnowledgeNodeRecord;
  chunks: KnowledgeChunkRecord[];
  mode: NotebookExplanationMode;
  question?: string;
}): Promise<ExplainFileResponse> {
  const client = createNotebookRagClient();
  if (client) {
    try {
      return await client.explainFile({
        fileId: String(node.metadata.fileId),
        fileName: node.title,
        mode,
        retrievalMode: mode,
        topK: topKForMode(mode),
        question,
        chunks: chunks.map((chunk) => ({
          content: chunk.content,
          metadata: chunk.metadata,
        })),
      });
    } catch {
      // A sidecar outage should not make the evidence reader unusable.
    }
  }

  return fallbackExplain(node.title, chunks, mode, question);
}

async function explainWithSidecarStreamOrFallback({
  fileId,
  fileName,
  mode,
  chunks,
  question,
}: {
  fileId: string;
  fileName: string;
  mode: NotebookExplanationMode;
  chunks: KnowledgeChunkRecord[];
  question?: string;
}) {
  const client = createNotebookRagClient();
  if (client) {
    try {
      return await client.explainFileStream({
        fileId,
        fileName,
        mode,
        retrievalMode: mode,
        topK: topKForMode(mode),
        question,
        chunks: chunks.map((chunk) => ({
          content: chunk.content,
          metadata: chunk.metadata,
        })),
      });
    } catch {
      // Fall back to local deterministic streaming below.
    }
  }

  return streamFallbackExplanation(fileName, chunks, mode, question);
}

async function chatWithSidecarOrFallback({
  fileId,
  fileName,
  mode,
  chunks,
  question,
  conversationContext,
}: {
  fileId: string;
  fileName: string;
  mode: NotebookExplanationMode;
  chunks: KnowledgeChunkRecord[];
  question: string;
  conversationContext: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<ExplainFileResponse> {
  const client = createNotebookRagClient();
  if (client) {
    try {
      return await client.chatFile({
        fileId,
        fileName,
        mode,
        retrievalMode: mode,
        topK: topKForMode(mode),
        conversationContext,
        chunks: chunks.map((chunk) => ({
          content: chunk.content,
          metadata: chunk.metadata,
        })),
        question,
      });
    } catch {
      // Keep follow-up Q&A available even when Notebook RAG is down.
    }
  }

  return fallbackChat(fileName, chunks, question);
}

async function chatWithSidecarStreamOrFallback({
  fileId,
  fileName,
  mode,
  chunks,
  question,
  conversationContext,
}: {
  fileId: string;
  fileName: string;
  mode: NotebookExplanationMode;
  chunks: KnowledgeChunkRecord[];
  question: string;
  conversationContext: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const client = createNotebookRagClient();
  if (client) {
    try {
      return await client.chatFileStream({
        fileId,
        fileName,
        mode,
        retrievalMode: mode,
        topK: topKForMode(mode),
        conversationContext,
        chunks: chunks.map((chunk) => ({
          content: chunk.content,
          metadata: chunk.metadata,
        })),
        question,
      });
    } catch {
      // Fall back to local deterministic streaming below.
    }
  }

  return streamFallbackChat(fileName, chunks, question);
}

function fallbackExplain(
  fileName: string,
  chunks: KnowledgeChunkRecord[],
  mode: NotebookExplanationMode,
  question?: string,
): ExplainFileResponse {
  if (chunks.length === 0) {
    const focusPrefix = question ? `围绕“${question}”，` : "";
    return {
      summary: "依据不足：当前文件还没有可检索的解析片段。",
      outline: [],
      answer: `${focusPrefix}依据不足：当前文件还没有可检索的解析片段，请先确认文件解析任务已完成。`,
      citations: [],
      grounded: false,
      insufficientEvidence: true,
      metadata: {
        engine: "deterministic-fallback",
        retrievalCount: 0,
        fallbackUsed: true,
      },
    };
  }

  const topChunks = chunks.slice(0, mode === "quick" ? 4 : 8);
  const outline = topChunks.map((chunk) => firstLine(chunk.content)).filter(Boolean);
  const citations = topChunks.map((chunk) => citationFromChunk(chunk));
  const summary = `${fileName} 主要围绕 ${outline.slice(0, 3).join("、")}。`;
  const focusLine = question ? `围绕“${question}”，这份资料可以作为当前讲点的证据。` : "";
  const answer = mode === "quick"
    ? [
        focusLine,
        `一句话：${summary}`,
        `关键点：${outline.slice(0, 5).join("；")}`,
        "高危追问：老师可能会问你的职责边界、技术选择依据和数据/代码证据。",
        "30 秒回答框架：先讲目标，再讲方法，最后讲结果和你负责的部分。",
      ].filter(Boolean).join("\n")
    : [
        focusLine,
        summary,
        "分段讲解：",
        ...outline.map((item, index) => `${index + 1}. ${item}`),
        "自测题：请用自己的话说明这个文件的核心目标、关键证据和可能被追问的风险点。",
      ].filter(Boolean).join("\n");

  return {
    summary,
    outline,
    answer,
    citations,
    grounded: true,
    insufficientEvidence: false,
    followUps: ["这个文件最容易被老师追问哪里？", "我如何用 30 秒讲清楚它？"],
    quiz: mode === "mastery" ? ["这份资料的核心证据是什么？", "你的个人贡献如何落到资料中？"] : [],
    weaknessCandidates: ["文件证据讲不清", "职责边界表达不稳"],
    metadata: {
      engine: "deterministic-fallback",
      retrievalCount: topChunks.length,
      fallbackUsed: true,
    },
  };
}

function fallbackChat(
  fileName: string,
  chunks: KnowledgeChunkRecord[],
  question: string,
): ExplainFileResponse {
  const matched = chunks
    .filter((chunk) => chunk.content.includes(question.slice(0, 12)) || question.length < 8)
    .slice(0, 4);
  const evidence = matched.length ? matched : chunks.slice(0, 3);
  if (evidence.length === 0) {
    return {
      summary: "依据不足",
      outline: [],
      answer: "依据不足：当前文件没有可引用片段，我不能编造答案。",
      citations: [],
      grounded: false,
      insufficientEvidence: true,
      metadata: {
        engine: "deterministic-fallback",
        retrievalCount: 0,
        fallbackUsed: true,
      },
    };
  }

  return {
    summary: `${fileName} 的追问回答`,
    outline: evidence.map((chunk) => firstLine(chunk.content)),
    answer: `基于当前文件片段，可以这样答：${evidence.map((chunk) => firstLine(chunk.content)).join("；")}。`,
    citations: evidence.map((chunk) => citationFromChunk(chunk)),
    grounded: true,
    insufficientEvidence: false,
    followUps: ["需要我把这个回答压缩成 30 秒版本吗？"],
    metadata: {
      engine: "deterministic-fallback",
      retrievalCount: evidence.length,
      fallbackUsed: true,
    },
  };
}

async function* streamFallbackExplanation(
  fileName: string,
  chunks: KnowledgeChunkRecord[],
  mode: NotebookExplanationMode,
  question?: string,
) {
  const result = fallbackExplain(fileName, chunks, mode, question);
  yield {
    type: "retrieval",
    retrievalCount: readRetrievalCount(result.metadata, chunks.length),
    retrievalMode: mode,
  } satisfies ExplainFileStreamEvent;
  yield {
    type: "fallback",
    engine: typeof result.metadata?.engine === "string" ? result.metadata.engine : "deterministic-fallback",
    reason: "local_fallback",
  } satisfies ExplainFileStreamEvent;
  yield* emitTextDeltas(result.answer ?? result.summary);
  yield {
    type: "citations",
    citations: result.citations,
  } satisfies ExplainFileStreamEvent;
  yield {
    type: "completed",
    response: result,
  } satisfies ExplainFileStreamEvent;
}

async function* streamFallbackChat(
  fileName: string,
  chunks: KnowledgeChunkRecord[],
  question: string,
) {
  const result = fallbackChat(fileName, chunks, question);
  yield {
    type: "retrieval",
    retrievalCount: readRetrievalCount(result.metadata, chunks.length),
    retrievalMode: "auto",
  } satisfies ExplainFileStreamEvent;
  yield {
    type: "fallback",
    engine: typeof result.metadata?.engine === "string" ? result.metadata.engine : "deterministic-fallback",
    reason: "local_fallback",
  } satisfies ExplainFileStreamEvent;
  yield* emitTextDeltas(result.answer ?? result.summary);
  yield {
    type: "citations",
    citations: result.citations,
  } satisfies ExplainFileStreamEvent;
  yield {
    type: "completed",
    response: result,
  } satisfies ExplainFileStreamEvent;
}

function firstLine(content: string) {
  return content.split(/\r?\n/u).map((line) => line.trim()).find(Boolean) ?? "";
}

function citationFromChunk(chunk: KnowledgeChunkRecord) {
  return {
    fileName: chunk.metadata.fileName,
    fileId: chunk.fileId,
    page: typeof chunk.metadata.page === "number" ? chunk.metadata.page : undefined,
    sheet: typeof chunk.metadata.sheet === "string" ? chunk.metadata.sheet : undefined,
    cellRange: typeof chunk.metadata.cellRange === "string" ? chunk.metadata.cellRange : undefined,
    codePath: typeof chunk.metadata.codePath === "string" ? chunk.metadata.codePath : undefined,
    lineStart: typeof chunk.metadata.lineStart === "number" ? chunk.metadata.lineStart : undefined,
    lineEnd: typeof chunk.metadata.lineEnd === "number" ? chunk.metadata.lineEnd : undefined,
    text: firstLine(chunk.content),
  };
}

function readRetrievalCount(metadata: Record<string, unknown> | undefined, fallback: number) {
  const value = metadata?.retrievalCount;
  return typeof value === "number" ? value : fallback;
}

function readFallbackUsed(metadata: Record<string, unknown> | undefined) {
  return metadata?.fallbackUsed === true
    || (typeof metadata?.engine === "string" && metadata.engine.includes("fallback"));
}

function topKForMode(mode: NotebookExplanationMode) {
  return mode === "quick" ? 4 : 8;
}

function candidateLimitForMode(mode: NotebookExplanationMode) {
  return mode === "quick" ? 12 : 20;
}

function buildSessionMetadata(explanation: ExplainFileResponse, retrievalFallbackCount: number) {
  return {
    followUps: explanation.followUps ?? [],
    quiz: explanation.quiz ?? [],
    weaknessCandidates: explanation.weaknessCandidates ?? [],
    engine: explanation.metadata?.engine ?? "deterministic-fallback",
    grounded: explanation.grounded,
    insufficientEvidence: explanation.insufficientEvidence,
    fallbackUsed: readFallbackUsed(explanation.metadata),
    retrievalCount: readRetrievalCount(explanation.metadata, retrievalFallbackCount),
    ...(explanation.metadata ?? {}),
  };
}

function buildTurnMetadata({
  mode,
  explanation,
  focus,
  retrievalFallbackCount,
  initial = false,
}: {
  mode: NotebookExplanationMode;
  explanation: ExplainFileResponse;
  focus?: FocusNodeContext;
  retrievalFallbackCount: number;
  initial?: boolean;
}) {
  return {
    mode,
    ...(initial ? { initial: true } : {}),
    ...focusMetadata(focus),
    grounded: explanation.grounded,
    insufficientEvidence: explanation.insufficientEvidence,
    retrievalCount: readRetrievalCount(explanation.metadata, retrievalFallbackCount),
    engine: explanation.metadata?.engine ?? "deterministic-fallback",
    fallbackUsed: readFallbackUsed(explanation.metadata),
    followUps: explanation.followUps ?? [],
    weaknessCandidates: explanation.weaknessCandidates ?? [],
  };
}

function focusMetadata(focus: FocusNodeContext | undefined) {
  if (!focus) return {};
  return {
    focusNodeId: focus.node.id,
    focusNodeTitle: focus.node.title,
    focusQuestion: focus.question,
  };
}

function deriveSessionStatus(explanation: ExplainFileResponse): FileExplanationSessionRecord["status"] {
  return readFallbackUsed(explanation.metadata) ? "fallback" : "completed";
}

function readFileNameFromSession(
  session: Pick<FileExplanationSessionRecord, "fileId" | "metadata"> & { turns?: Array<Pick<FileExplanationTurnRecord, "citations">> },
) {
  const metadataFileName = session.metadata.fileName;
  if (typeof metadataFileName === "string" && metadataFileName.trim()) {
    return metadataFileName;
  }
  const citationFileName = session.turns?.flatMap((turn) => turn.citations)
    .find((citation) => typeof citation.fileName === "string" && citation.fileName.trim())?.fileName;
  return citationFileName ?? session.fileId;
}

function markSessionFailed(session: FileExplanationSessionRecord, error: unknown): FileExplanationSessionRecord {
  return {
    ...session,
    status: "failed",
    metadata: {
      ...session.metadata,
      error: error instanceof Error ? error.message : String(error),
    },
    updatedAt: new Date().toISOString(),
  };
}

async function* captureStreamFailures(
  events: AsyncIterable<ExplainFileStreamEvent>,
  onFailure: (error: unknown) => Promise<void>,
) {
  try {
    for await (const event of events) {
      if (event.type === "error") {
        const error = new Error(event.error);
        await onFailure(error);
        throw error;
      }
      yield event;
    }
  } catch (error) {
    await onFailure(error);
    throw error;
  }
}

async function* emitTextDeltas(text: string) {
  for (let index = 0; index < text.length; index += 48) {
    const delta = text.slice(index, index + 48);
    yield {
      type: "delta",
      delta,
    } satisfies ExplainFileStreamEvent;
  }
}
