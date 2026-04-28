import { createFileExplanationRepository } from "@db/repositories/file-explanations";
import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import { createNotebookRagClient, type ExplainFileResponse } from "@ingest/notebook-rag-client";
import type {
  FileExplanationSessionRecord,
  FileExplanationTurnRecord,
  KnowledgeNodeRecord,
  NotebookExplanationMode,
} from "@shared/domain";
import type { KnowledgeChunkRecord } from "./knowledge-chunks";
import { readProjectKnowledgeChunks } from "./knowledge-db";

export async function getFileNodePreview(projectId: string, nodeId: string) {
  const node = await readExplainableFileNode(projectId, nodeId);
  const chunks = await readFileChunks(projectId, String(node.metadata.fileId));
  return {
    node,
    viewer: node.metadata.viewer,
    explainable: node.metadata.explainable,
    file: {
      id: node.metadata.fileId,
      sourceId: node.metadata.sourceId ?? node.sourceId,
      kind: node.metadata.fileKind,
      mimeType: node.metadata.mimeType,
      sourcePath: node.metadata.sourcePath,
    },
    preview: node.metadata.preview ?? {
      text: chunks.slice(0, 3).map((chunk) => chunk.content).join("\n\n"),
      outline: chunks.slice(0, 5).map((chunk) => firstLine(chunk.content)),
    },
    chunks: chunks.slice(0, 8),
  };
}

export async function createFileExplanationSession({
  projectId,
  nodeId,
  mode,
}: {
  projectId: string;
  nodeId: string;
  mode: NotebookExplanationMode;
}) {
  const node = await readExplainableFileNode(projectId, nodeId);
  const fileId = String(node.metadata.fileId);
  const chunks = await readFileChunks(projectId, fileId);
  const now = new Date().toISOString();
  const explanation = await explainWithSidecarOrFallback({
    node,
    chunks,
    mode,
  });
  const session: FileExplanationSessionRecord = {
    id: `file-session-${crypto.randomUUID()}`,
    projectId,
    nodeId,
    fileId,
    sourceId: typeof node.sourceId === "string" ? node.sourceId : undefined,
    mode,
    status: "ready",
    summary: explanation.summary,
    outline: explanation.outline,
    citations: explanation.citations,
    metadata: {
      followUps: explanation.followUps ?? [],
      quiz: explanation.quiz ?? [],
      weaknessCandidates: explanation.weaknessCandidates ?? [],
      ...(explanation.metadata ?? {}),
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
    metadata: { mode, initial: true },
    createdAt: now,
  };

  const repository = createFileExplanationRepository();
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

  const chunks = await readFileChunks(projectId, session.fileId);
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
    fileName: session.summary || session.fileId,
    mode: session.mode,
    chunks,
    question,
  });
  const assistantTurn: FileExplanationTurnRecord = {
    id: `file-turn-${crypto.randomUUID()}`,
    sessionId,
    projectId,
    role: "assistant",
    content: answer.answer ?? answer.summary,
    citations: answer.citations,
    metadata: {
      followUps: answer.followUps ?? [],
      weaknessCandidates: answer.weaknessCandidates ?? [],
    },
    createdAt: new Date().toISOString(),
  };

  await repository.addTurn(userTurn);
  await repository.addTurn(assistantTurn);
  return repository.readSession(projectId, sessionId);
}

async function readExplainableFileNode(projectId: string, nodeId: string) {
  const node = await createKnowledgeMapRepository().readNode(projectId, nodeId);
  if (!node || node.kind !== "file") {
    throw new Error("Knowledge node is not a file leaf node.");
  }
  if (!node.metadata.fileId) {
    throw new Error("File leaf node is missing file metadata.");
  }
  return node;
}

async function readFileChunks(projectId: string, fileId: string) {
  const chunks = await readProjectKnowledgeChunks(projectId);
  return chunks.filter((chunk) => chunk.fileId === fileId);
}

async function explainWithSidecarOrFallback({
  node,
  chunks,
  mode,
}: {
  node: KnowledgeNodeRecord;
  chunks: KnowledgeChunkRecord[];
  mode: NotebookExplanationMode;
}): Promise<ExplainFileResponse> {
  const client = createNotebookRagClient();
  if (client) {
    return client.explainFile({
      fileId: String(node.metadata.fileId),
      fileName: node.title,
      mode,
      chunks: chunks.map((chunk) => ({
        content: chunk.content,
        metadata: chunk.metadata,
      })),
    });
  }

  return fallbackExplain(node.title, chunks, mode);
}

async function chatWithSidecarOrFallback({
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
  question: string;
}): Promise<ExplainFileResponse> {
  const client = createNotebookRagClient();
  if (client) {
    return client.chatFile({
      fileId,
      fileName,
      mode,
      chunks: chunks.map((chunk) => ({
        content: chunk.content,
        metadata: chunk.metadata,
      })),
      question,
    });
  }

  return fallbackChat(fileName, chunks, question);
}

function fallbackExplain(
  fileName: string,
  chunks: KnowledgeChunkRecord[],
  mode: NotebookExplanationMode,
): ExplainFileResponse {
  if (chunks.length === 0) {
    return {
      summary: "依据不足：当前文件还没有可检索的解析片段。",
      outline: [],
      answer: "依据不足：当前文件还没有可检索的解析片段，请先确认文件解析任务已完成。",
      citations: [],
    };
  }

  const topChunks = chunks.slice(0, mode === "quick" ? 4 : 8);
  const outline = topChunks.map((chunk) => firstLine(chunk.content)).filter(Boolean);
  const citations = topChunks.map((chunk) => citationFromChunk(chunk));
  const summary = `${fileName} 主要围绕 ${outline.slice(0, 3).join("、")}。`;
  const answer = mode === "quick"
    ? [
        `一句话：${summary}`,
        `关键点：${outline.slice(0, 5).join("；")}`,
        "高危追问：老师可能会问你的职责边界、技术选择依据和数据/代码证据。",
        "30 秒回答框架：先讲目标，再讲方法，最后讲结果和你负责的部分。",
      ].join("\n")
    : [
        summary,
        "分段讲解：",
        ...outline.map((item, index) => `${index + 1}. ${item}`),
        "自测题：请用自己的话说明这个文件的核心目标、关键证据和可能被追问的风险点。",
      ].join("\n");

  return {
    summary,
    outline,
    answer,
    citations,
    followUps: ["这个文件最容易被老师追问哪里？", "我如何用 30 秒讲清楚它？"],
    quiz: mode === "mastery" ? ["这份资料的核心证据是什么？", "你的个人贡献如何落到资料中？"] : [],
    weaknessCandidates: ["文件证据讲不清", "职责边界表达不稳"],
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
    };
  }

  return {
    summary: `${fileName} 的追问回答`,
    outline: evidence.map((chunk) => firstLine(chunk.content)),
    answer: `基于当前文件片段，可以这样答：${evidence.map((chunk) => firstLine(chunk.content)).join("；")}。`,
    citations: evidence.map((chunk) => citationFromChunk(chunk)),
    followUps: ["需要我把这个回答压缩成 30 秒版本吗？"],
  };
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
