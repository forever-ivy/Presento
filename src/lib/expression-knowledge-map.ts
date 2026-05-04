import { z } from "zod";
import { createKnowledgeMapRepository } from "../../packages/db/src/repositories/knowledge-map.ts";
import { createProjectRepository } from "../../packages/db/src/repositories/projects.ts";
import type { PsqlRunner } from "../../packages/db/src/runner.ts";
import type {
  KnowledgeEdgeRecord,
  KnowledgeNodeRecord,
  ProjectWorkspaceDto,
} from "../../packages/shared/src/domain.ts";
import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";
import { createKnowledgeDatabase } from "./knowledge-db.ts";
import { createConfiguredLlmProvider, type LlmProvider } from "./llm-provider.ts";

export type ExpressionNodeRole = "mainline" | "expression" | "evidence" | "risk";
export type ExpressionNodeLayer = 0 | 1 | 2 | 3 | "risk";

export type ExpressionEvidenceRef = {
  nodeId: string;
  fileId: string;
  label: string;
  reason: string;
  citation?: Record<string, unknown>;
};

export type ExpressionMetadata = {
  oneSentence: string;
  talkTrack: string;
  topQuestion: string;
  riskLevel: "low" | "medium" | "high";
  evidenceRefs: ExpressionEvidenceRef[];
  actions: string[];
};

const evidenceRefDraftSchema = z.object({
  fileId: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  citation: z.record(z.string(), z.unknown()).optional(),
});

const expressionNodeDraftSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  oneSentence: z.string().trim().min(1),
  talkTrack: z.string().trim().min(1),
  topQuestion: z.string().trim().min(1),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  evidenceRefs: z.array(evidenceRefDraftSchema).min(1),
  riskQuestions: z.array(z.string().trim().min(1)).optional(),
});

const mainlineDraftSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1).optional(),
  expressionNodes: z.array(expressionNodeDraftSchema).min(1),
});

const expressionKnowledgeMapDraftSchema = z.object({
  projectCenter: z.object({
    title: z.string().trim().min(1),
    oneSentence: z.string().trim().min(1).optional(),
    talkTrack: z.string().trim().min(1).optional(),
  }),
  mainlines: z.array(mainlineDraftSchema).min(1),
});

export type ExpressionKnowledgeMapDraft = z.infer<typeof expressionKnowledgeMapDraftSchema>;

export function normalizeExpressionKnowledgeMapDraft(payload: unknown): ExpressionKnowledgeMapDraft {
  const result = expressionKnowledgeMapDraftSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid expression knowledge map: ${result.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return result.data;
}

export async function generateExpressionKnowledgeMapForProject({
  projectId,
  runSql,
  llmProvider = createConfiguredLlmProvider(),
  createdAt = new Date().toISOString(),
}: {
  projectId: string;
  runSql?: PsqlRunner;
  llmProvider?: LlmProvider | null;
  createdAt?: string;
}) {
  if (!llmProvider) {
    throw new Error("LLM provider is not configured.");
  }

  const [workspace, chunks] = await Promise.all([
    createProjectRepository(runSql).readWorkspace(projectId),
    createKnowledgeDatabase(runSql).readProjectKnowledgeChunks(projectId),
  ]);
  if (!workspace) {
    throw new Error(`Project ${projectId} was not found.`);
  }

  const draft = await generateExpressionKnowledgeMapDraft({
    chunks,
    llmProvider,
    workspace,
  });
  const map = buildExpressionKnowledgeMapRecords({
    chunks,
    createdAt,
    draft,
    workspace,
  });
  await createKnowledgeMapRepository(runSql).replaceProjectMap(projectId, map.nodes, map.edges);
  return {
    ...map,
    draft,
  };
}

export async function generateExpressionKnowledgeMapDraft({
  chunks,
  llmProvider,
  workspace,
}: {
  chunks: KnowledgeChunkRecord[];
  llmProvider: LlmProvider;
  workspace: ProjectWorkspaceDto;
}) {
  const payload = await llmProvider.generateJson<unknown>({
    schemaName: "presento_expression_knowledge_map_v1",
    messages: [
      {
        role: "system",
        content: [
          "你是 Presento 的校园答辩表达地图生成器。",
          "知识地图节点必须是答辩讲点，而不是文件目录、代码目录或数据库表。",
          "只输出合法 JSON，不要输出 Markdown。",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "生成 4 层表达型知识地图：项目中心、答辩主线、核心表达节点、证据资料。风险问题放在表达节点 topQuestion / riskQuestions 中。",
          schema: {
            projectCenter: {
              title: "项目名或核心主张",
              oneSentence: "一句话讲清项目",
              talkTrack: "项目中心的建议讲法",
            },
            mainlines: [{
              title: "答辩主线名称",
              summary: "主线说明",
              expressionNodes: [{
                title: "能独立讲 30 秒的答辩讲点",
                oneSentence: "一句话讲清楚",
                talkTrack: "建议这样讲",
                topQuestion: "最高危追问",
                riskLevel: "low | medium | high",
                riskQuestions: ["其他可能追问"],
                evidenceRefs: [{
                  fileId: "必须引用输入 files 中的 id",
                  label: "PPT 第 3 页 / README.md / pipeline.ts 等",
                  reason: "这份证据如何支撑该讲点",
                }],
              }],
            }],
          },
          project: workspace.project,
          files: workspace.files.map((file) => ({
            id: file.id,
            name: file.name,
            kind: file.kind,
            mimeType: file.mimeType,
            source: file.source,
          })),
          chunks: chunks.slice(0, 36).map((chunk) => ({
            fileId: chunk.fileId,
            source: chunk.source,
            content: chunk.content.slice(0, 900),
            metadata: chunk.metadata,
          })),
          constraints: [
            "mainlines 至少包含 项目价值主线、产品功能主线、技术实现主线、答辩风险主线 中最匹配的 2 到 4 条。",
            "expressionNodes 必须能被讲清楚、被追问、被训练。",
            "evidenceRefs 必须绑定到输入 files 的 fileId。",
            "不要输出 source-category、training、file catalog 结构。",
          ],
        }),
      },
    ],
  });

  return normalizeExpressionKnowledgeMapDraft(payload);
}

export function buildExpressionKnowledgeMapRecords({
  chunks,
  createdAt = new Date().toISOString(),
  draft,
  workspace,
}: {
  chunks: KnowledgeChunkRecord[];
  createdAt?: string;
  draft: ExpressionKnowledgeMapDraft;
  workspace: ProjectWorkspaceDto;
}) {
  const projectId = workspace.project.id;
  const fileById = new Map(workspace.files.map((file) => [file.id, file] as const));
  const chunksByFileId = groupChunksByFileId(chunks);
  const nodes: KnowledgeNodeRecord[] = [];
  const edges: KnowledgeEdgeRecord[] = [];
  const evidenceNodes = new Map<string, KnowledgeNodeRecord>();
  const edgeIds = new Set<string>();

  const projectNode: KnowledgeNodeRecord = {
    id: `node-project-${projectId}`,
    projectId,
    kind: "project",
    title: draft.projectCenter.title || workspace.project.name || "项目中心",
    summary: draft.projectCenter.oneSentence ?? workspace.project.category ?? "",
    tone: "blue",
    metadata: {
      nodeRole: "mainline",
      layer: 0,
      expression: {
        oneSentence: draft.projectCenter.oneSentence ?? workspace.project.category ?? "项目中心。",
        talkTrack: draft.projectCenter.talkTrack ?? "先讲项目定位，再讲产品路径、技术实现和答辩风险。",
        topQuestion: "这个项目的核心价值是什么？",
        riskLevel: "medium",
        evidenceRefs: [],
        actions: ["围绕项目中心讲练"],
      } satisfies ExpressionMetadata,
      layout: { ring: 0 },
    },
    createdAt,
  };
  nodes.push(projectNode);

  draft.mainlines.forEach((mainline, mainlineIndex) => {
    const mainlineNode: KnowledgeNodeRecord = {
      id: `node-mainline-${projectId}-${readStableSegment(mainline.id, mainline.title, mainlineIndex)}`,
      projectId,
      kind: "module",
      title: mainline.title,
      summary: mainline.summary ?? `${mainline.expressionNodes.length} 个答辩讲点。`,
      tone: toneForMainline(mainlineIndex),
      metadata: {
        nodeRole: "mainline",
        layer: 1,
        actions: ["展开表达节点"],
        evidence: mainline.expressionNodes.slice(0, 3).map((node) => node.title),
        layout: { ring: 1 },
      },
      createdAt,
    };
    nodes.push(mainlineNode);
    pushEdge(edges, edgeIds, {
      id: `edge-${projectNode.id}-${mainlineNode.id}`,
      projectId,
      fromNodeId: projectNode.id,
      toNodeId: mainlineNode.id,
      kind: "contains",
      label: "答辩主线",
      createdAt,
    });

    mainline.expressionNodes.forEach((expression, expressionIndex) => {
      const resolvedEvidenceRefs = expression.evidenceRefs
        .flatMap((ref) => resolveEvidenceRef({
          chunksByFileId,
          fileById,
          projectId,
          ref,
        }));
      const expressionNode: KnowledgeNodeRecord = {
        id: `node-expression-${projectId}-${readStableSegment(expression.id, expression.title, expressionIndex)}`,
        projectId,
        kind: "module",
        title: expression.title,
        summary: expression.oneSentence,
        tone: "purple",
        metadata: {
          nodeRole: "expression",
          layer: 2,
          riskLevel: expression.riskLevel,
          evidence: resolvedEvidenceRefs.map((ref) => `${ref.label}：${ref.reason}`),
          relatedFiles: resolvedEvidenceRefs.map((ref) => ref.label),
          riskQuestions: uniqueStrings([expression.topQuestion, ...(expression.riskQuestions ?? [])]),
          actions: ["围绕此节点讲练", "查看证据资料"],
          expression: {
            oneSentence: expression.oneSentence,
            talkTrack: expression.talkTrack,
            topQuestion: expression.topQuestion,
            riskLevel: expression.riskLevel,
            evidenceRefs: resolvedEvidenceRefs,
            actions: ["围绕此节点讲练", "查看证据资料"],
          } satisfies ExpressionMetadata,
          layout: { ring: 2 },
        },
        createdAt,
      };
      nodes.push(expressionNode);
      pushEdge(edges, edgeIds, {
        id: `edge-${mainlineNode.id}-${expressionNode.id}`,
        projectId,
        fromNodeId: mainlineNode.id,
        toNodeId: expressionNode.id,
        kind: "contains",
        label: "表达节点",
        createdAt,
      });

      for (const evidenceRef of resolvedEvidenceRefs) {
        const evidenceNode = evidenceNodes.get(evidenceRef.nodeId)
          ?? createEvidenceNode({
            chunks: chunksByFileId.get(evidenceRef.fileId) ?? [],
            createdAt,
            file: fileById.get(evidenceRef.fileId),
            projectId,
            ref: evidenceRef,
          });
        if (!evidenceNodes.has(evidenceNode.id)) {
          evidenceNodes.set(evidenceNode.id, evidenceNode);
          nodes.push(evidenceNode);
        }
        pushEdge(edges, edgeIds, {
          id: `edge-${expressionNode.id}-${evidenceNode.id}`,
          projectId,
          fromNodeId: expressionNode.id,
          toNodeId: evidenceNode.id,
          kind: "evidence",
          label: "证据",
          createdAt,
        });
      }

      const riskQuestions = uniqueStrings([expression.topQuestion, ...(expression.riskQuestions ?? [])]);
      if (riskQuestions.length) {
        const riskNode: KnowledgeNodeRecord = {
          id: `node-risk-${projectId}-${readStableSegment(undefined, expression.title, expressionIndex)}`,
          projectId,
          kind: "risk",
          title: riskQuestions[0],
          summary: `围绕「${expression.title}」的高危追问。`,
          tone: "red",
          metadata: {
            nodeRole: "risk",
            layer: "risk",
            riskLevel: expression.riskLevel,
            riskQuestions,
            actions: ["生成回答框架", "进入模拟追问"],
            expressionNodeId: expressionNode.id,
            layout: { ring: 3 },
          },
          createdAt,
        };
        nodes.push(riskNode);
        pushEdge(edges, edgeIds, {
          id: `edge-${expressionNode.id}-${riskNode.id}`,
          projectId,
          fromNodeId: expressionNode.id,
          toNodeId: riskNode.id,
          kind: "risk",
          label: "高危追问",
          createdAt,
        });
      }
    });
  });

  return { nodes, edges };
}

function resolveEvidenceRef({
  chunksByFileId,
  fileById,
  projectId,
  ref,
}: {
  chunksByFileId: Map<string, KnowledgeChunkRecord[]>;
  fileById: Map<string, ProjectWorkspaceDto["files"][number]>;
  projectId: string;
  ref: z.infer<typeof evidenceRefDraftSchema>;
}): ExpressionEvidenceRef[] {
  const fileId = ref.fileId?.trim();
  if (!fileId || !fileById.has(fileId)) return [];
  const citation = ref.citation ?? citationFromChunk(chunksByFileId.get(fileId)?.[0]);
  return [{
    nodeId: `node-evidence-${projectId}-${fileId}`,
    fileId,
    label: ref.label,
    reason: ref.reason,
    ...(citation ? { citation } : {}),
  }];
}

function createEvidenceNode({
  chunks,
  createdAt,
  file,
  projectId,
  ref,
}: {
  chunks: KnowledgeChunkRecord[];
  createdAt: string;
  file: ProjectWorkspaceDto["files"][number] | undefined;
  projectId: string;
  ref: ExpressionEvidenceRef;
}): KnowledgeNodeRecord {
  const firstChunk = chunks[0];
  const fileKind = file?.kind ?? firstChunk?.metadata.kind ?? "document";
  return {
    id: ref.nodeId,
    projectId,
    kind: "file",
    title: ref.label,
    summary: ref.reason,
    tone: toneForFileKind(String(fileKind)),
    sourceId: `source-${ref.fileId}`,
    metadata: {
      nodeRole: "evidence",
      layer: 3,
      evidence: [ref.reason],
      fileId: ref.fileId,
      sourceId: `source-${ref.fileId}`,
      fileKind,
      mimeType: file?.mimeType,
      sourcePath: file?.storagePath,
      viewer: viewerForFileKind(String(fileKind)),
      explainable: true,
      preview: {
        text: firstChunk?.content ?? ref.reason,
        outline: chunks.slice(0, 5).map((chunk) => firstLine(chunk.content)).filter(Boolean),
      },
      citation: ref.citation,
      layout: { ring: 3 },
    },
    createdAt,
  };
}

function groupChunksByFileId(chunks: KnowledgeChunkRecord[]) {
  const groups = new Map<string, KnowledgeChunkRecord[]>();
  for (const chunk of chunks) {
    if (!chunk.fileId) continue;
    const group = groups.get(chunk.fileId) ?? [];
    group.push(chunk);
    groups.set(chunk.fileId, group);
  }
  return groups;
}

function citationFromChunk(chunk: KnowledgeChunkRecord | undefined) {
  if (!chunk) return undefined;
  return {
    fileName: chunk.metadata.fileName,
    fileId: chunk.fileId,
    page: typeof chunk.metadata.page === "number" ? chunk.metadata.page : undefined,
    slide: typeof chunk.metadata.slide === "number" ? chunk.metadata.slide : undefined,
    sheet: typeof chunk.metadata.sheet === "string" ? chunk.metadata.sheet : undefined,
    cellRange: typeof chunk.metadata.cellRange === "string" ? chunk.metadata.cellRange : undefined,
    codePath: typeof chunk.metadata.codePath === "string" ? chunk.metadata.codePath : undefined,
    lineStart: typeof chunk.metadata.lineStart === "number" ? chunk.metadata.lineStart : undefined,
    lineEnd: typeof chunk.metadata.lineEnd === "number" ? chunk.metadata.lineEnd : undefined,
    text: firstLine(chunk.content),
  };
}

function pushEdge(
  edges: KnowledgeEdgeRecord[],
  edgeIds: Set<string>,
  edge: KnowledgeEdgeRecord,
) {
  if (edgeIds.has(edge.id)) return;
  edges.push(edge);
  edgeIds.add(edge.id);
}

function readStableSegment(id: string | undefined, title: string, index: number) {
  return id?.trim() ? slugify(id) : `${index + 1}-${slugify(title)}`;
}

function slugify(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii.slice(0, 48);

  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return `node-${hash.toString(36)}`;
}

function toneForMainline(index: number): KnowledgeNodeRecord["tone"] {
  const tones: KnowledgeNodeRecord["tone"][] = ["green", "cyan", "orange", "blue"];
  return tones[index % tones.length] ?? "green";
}

function toneForFileKind(kind: string): KnowledgeNodeRecord["tone"] {
  if (kind === "presentation") return "orange";
  if (kind === "code") return "green";
  if (kind === "database" || kind === "dataset") return "cyan";
  return "blue";
}

function viewerForFileKind(kind: string) {
  if (kind === "presentation") return "presentation";
  if (kind === "code") return "code";
  if (kind === "database") return "sql";
  if (kind === "dataset") return "table";
  return "docx";
}

function firstLine(content: string) {
  return content.split(/\r?\n/u).map((line) => line.trim()).find(Boolean) ?? "";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
