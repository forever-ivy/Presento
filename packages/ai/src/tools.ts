import type { SkillToolCallRecord, SkillToolName } from "@shared/domain";
import { createKnowledgeMapRepository } from "../../db/src/repositories/knowledge-map.ts";
import {
  readFileKnowledgeChunks,
  readProjectKnowledgeChunks,
  retrieveRelevantFileKnowledgeChunks,
  retrieveRelevantKnowledgeChunks,
} from "../../../src/lib/knowledge-db.ts";
import type { KnowledgeChunkRecord } from "../../../src/lib/knowledge-chunks.ts";

type ToolCallRecorder = (call: SkillToolCallRecord) => void;

type ToolLayerContext = {
  projectId: string;
  allowedTools: SkillToolName[];
  recordToolCall: ToolCallRecorder;
};

export function createSkillToolLayer(context: ToolLayerContext) {
  return {
    async call<TInput, TOutput>(tool: SkillToolName, input: TInput): Promise<TOutput> {
      if (!context.allowedTools.includes(tool)) {
        throw new Error(`Skill tool not allowed: ${tool}`);
      }

      const startedAt = Date.now();

      try {
        const output = await runTool(context.projectId, tool, input);
        context.recordToolCall({
          tool,
          status: "success",
          durationMs: Date.now() - startedAt,
          summary: summarizeToolOutput(output),
        });
        return output as TOutput;
      } catch (error) {
        context.recordToolCall({
          tool,
          status: "failed",
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "Tool failed.",
        });
        throw error;
      }
    },
  };
}

async function runTool(projectId: string, tool: SkillToolName, input: unknown) {
  switch (tool) {
    case "retrieveProjectContext":
      return retrieveProjectContext(projectId, input);
    case "retrieveSlideContext":
      return retrieveSlideContext(projectId, input);
    case "retrieveKnowledgeNodeContext":
      return retrieveKnowledgeNodeContext(projectId, input);
    case "retrieveFileContext":
      return retrieveFileContext(projectId, input);
    case "retrieveCodeContext":
      return retrieveCodeContext(projectId, input);
    case "retrieveRiskQuestions":
      return retrieveRiskQuestions(projectId, input);
    case "writeArtifact":
    case "writeReview":
    case "createWeakness":
    case "createDeepDive":
    case "writeContentExport":
      return {
        accepted: true,
        tool,
        projectId,
        payload: input,
      };
  }
}

async function retrieveProjectContext(projectId: string, input: unknown) {
  const query = readString(input, "query");
  const limit = readNumber(input, "limit") ?? 8;
  const chunks = query
    ? await retrieveRelevantKnowledgeChunks({ projectId, query, limit })
    : await readProjectKnowledgeChunks(projectId);
  return { chunks };
}

async function retrieveSlideContext(projectId: string, input: unknown) {
  const query = readString(input, "query") ?? "";
  const fileId = readString(input, "fileId") ?? undefined;
  const sourceId = readString(input, "sourceId") ?? undefined;
  const slideId = readString(input, "slideId") ?? undefined;
  const limit = readNumber(input, "limit") ?? 6;
  const chunks = await retrieveRelevantKnowledgeChunks({
    projectId,
    query,
    limit,
    fileId,
    sourceId,
    slideId,
  });
  return { chunks };
}

async function retrieveKnowledgeNodeContext(projectId: string, input: unknown) {
  const nodeId = readString(input, "nodeId");
  if (!nodeId) return { node: null, chunks: [] as KnowledgeChunkRecord[] };

  const node = await createKnowledgeMapRepository().readNode(projectId, nodeId);
  if (!node) return { node: null, chunks: [] as KnowledgeChunkRecord[] };

  const fileId = typeof node.metadata?.fileId === "string" ? node.metadata.fileId : undefined;
  const sourceId = typeof node.metadata?.sourceId === "string"
    ? node.metadata.sourceId
    : node.sourceId ?? undefined;
  const query = readString(input, "query") ?? node.title;
  const chunks = await retrieveRelevantKnowledgeChunks({
    projectId,
    query,
    limit: readNumber(input, "limit") ?? 6,
    fileId,
    sourceId,
  });
  return { node, chunks };
}

async function retrieveFileContext(projectId: string, input: unknown) {
  const fileId = readString(input, "fileId");
  if (!fileId) return { chunks: [] as KnowledgeChunkRecord[] };

  const query = readString(input, "query");
  const limit = readNumber(input, "limit") ?? 6;
  const chunks = query
    ? await retrieveRelevantFileKnowledgeChunks({ projectId, fileId, query, limit })
    : await readFileKnowledgeChunks({ projectId, fileId, limit });
  return { chunks };
}

async function retrieveCodeContext(projectId: string, input: unknown) {
  const fileId = readString(input, "fileId");
  const query = readString(input, "query") ?? readString(input, "title") ?? "代码实现";
  const limit = readNumber(input, "limit") ?? 6;

  const baseChunks = fileId
    ? await retrieveRelevantFileKnowledgeChunks({ projectId, fileId, query, limit })
    : await retrieveRelevantKnowledgeChunks({ projectId, query, limit });
  const chunks = baseChunks.filter((chunk) =>
    typeof chunk.metadata?.codePath === "string" || chunk.source.toLowerCase().includes(".ts")
  );

  return { chunks: chunks.length ? chunks : baseChunks };
}

async function retrieveRiskQuestions(projectId: string, input: unknown) {
  return retrieveProjectContext(projectId, {
    query: readString(input, "query") ?? "高危问题 技术路线 数据库 个人贡献",
    limit: readNumber(input, "limit") ?? 8,
  });
}

function summarizeToolOutput(output: unknown) {
  if (isRecord(output) && Array.isArray(output.chunks)) {
    return { chunkCount: output.chunks.length };
  }
  if (isRecord(output) && typeof output.accepted === "boolean") {
    return { accepted: output.accepted, tool: output.tool };
  }
  return null;
}

function readString(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const item = value[key];
  return typeof item === "string" && item.trim() ? item : null;
}

function readNumber(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const item = value[key];
  return typeof item === "number" ? item : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
