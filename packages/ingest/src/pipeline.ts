import type {
  KnowledgeEdgeRecord,
  KnowledgeNodeRecord,
  ParsedFileResult,
  ProjectSourceRecord,
} from "@shared/domain";
import { createKnowledgeChunks } from "../../../src/lib/knowledge-chunks.ts";
import type { KnowledgeChunkRecord } from "../../../src/lib/knowledge-chunks.ts";
import type {
  KnowledgeMapGraphCitation,
  KnowledgeMapGraphOutput,
  KnowledgeMapGraphRisk,
  KnowledgeMapGraphSemanticNode,
  KnowledgeMapGraphSemanticType,
  KnowledgeMapGraphTrainingPath,
  KnowledgeMapGraphWeakness,
} from "../../../src/lib/skill-graph.ts";
import { createProcessingArtifact } from "../../../src/lib/local-processing.ts";
import type {
  DefenseFileRecord,
  DefenseProcessingTask,
} from "../../../src/lib/project-workspace.ts";

export function ingestLocalFile({
  projectId,
  file,
  task,
  content,
  parsed,
  createdAt = new Date().toISOString(),
  createStarterGraph = true,
}: {
  projectId: string;
  file: DefenseFileRecord;
  task: DefenseProcessingTask;
  content: string;
  parsed?: ParsedFileResult;
  createdAt?: string;
  createStarterGraph?: boolean;
}) {
  const artifact = createProcessingArtifact({
    file,
    task,
    content,
    createdAt,
  });
  const source: ProjectSourceRecord = {
    id: `source-${file.id}`,
    projectId,
    fileId: file.id,
    kind: file.kind,
    title: parsed?.source.title ? `${parsed.source.title} 来源` : `${file.name} 来源`,
    summary: parsed?.source.summary ?? artifact.summary,
    sourcePath: file.storagePath,
    metadata: {
      mimeType: file.type,
      uploadedFrom: file.source,
      ...(parsed?.source.metadata ?? {}),
    },
    createdAt,
  };

  const chunks = createIngestKnowledgeChunks({
    projectId,
    artifact,
    source,
    parsed,
    content,
    createdAt,
  });

  const knowledgeNodes = createStarterGraph
    ? createStarterKnowledgeNodes({
      projectId,
      source,
      file,
      content,
      parsed,
      createdAt,
    })
    : [];
  const knowledgeEdges = createStarterGraph
    ? createStarterKnowledgeEdges({
      projectId,
      nodes: knowledgeNodes,
      createdAt,
    })
    : [];

  return {
    source,
    artifact,
    chunks,
    knowledgeNodes,
    knowledgeEdges,
  };
}

export function mergeAiKnowledgeGraph({
  projectId,
  source,
  file,
  starterNodes,
  starterEdges,
  output,
  createdAt,
}: {
  projectId: string;
  source: ProjectSourceRecord;
  file: DefenseFileRecord;
  starterNodes: KnowledgeNodeRecord[];
  starterEdges: KnowledgeEdgeRecord[];
  output: KnowledgeMapGraphOutput;
  createdAt: string;
}): { knowledgeNodes: KnowledgeNodeRecord[]; knowledgeEdges: KnowledgeEdgeRecord[] } {
  const nodesById = new Map<string, KnowledgeNodeRecord>();
  for (const node of starterNodes) {
    nodesById.set(node.id, output.projectSummary && node.kind === "project"
      ? { ...node, summary: output.projectSummary }
      : node);
  }

  const edgesById = new Map(starterEdges.map((edge) => [edge.id, edge]));
  const categoryNode = starterNodes.find((node) => node.kind === "source-category" && node.metadata.kind === source.kind)
    ?? starterNodes.find((node) => node.kind === "source-category");
  const fileNode = starterNodes.find((node) => node.kind === "file" && node.metadata.fileId === file.id)
    ?? starterNodes.find((node) => node.kind === "file");
  if (!categoryNode || !fileNode) {
    return { knowledgeNodes: starterNodes, knowledgeEdges: starterEdges };
  }

  const citations = normalizeCitations(output.citations);
  const semanticNodes = [
    ...normalizeAiSemanticNodes(output.modules, "feature"),
    ...normalizeAiSemanticNodes(output.apis, "api"),
    ...normalizeAiSemanticNodes(output.tables, "table"),
  ];

  for (const semanticNode of semanticNodes) {
    const record = createAiSemanticKnowledgeNode({
      projectId,
      source,
      file,
      item: semanticNode,
      fallbackCitations: citations,
      createdAt,
    });
    if (!record) continue;
    pushNode(nodesById, record);
    pushEdge(edgesById, {
      id: `edge-${categoryNode.id}-${record.id}`,
      projectId,
      fromNodeId: categoryNode.id,
      toNodeId: record.id,
      kind: "contains",
      label: semanticTypeLabel(record.metadata.semanticType),
      createdAt,
    });
    pushEdge(edgesById, {
      id: `edge-${record.id}-${fileNode.id}`,
      projectId,
      fromNodeId: record.id,
      toNodeId: fileNode.id,
      kind: "evidence",
      label: "证据文件",
      createdAt,
    });
  }

  const riskAndWeaknessNodes: KnowledgeNodeRecord[] = [];
  for (const risk of normalizeAiRisks(output.risks)) {
    const record = createAiRiskKnowledgeNode({ projectId, source, file, item: risk, fallbackCitations: citations, createdAt });
    if (!record) continue;
    pushNode(nodesById, record);
    riskAndWeaknessNodes.push(record);
    pushEdge(edgesById, {
      id: `edge-${fileNode.id}-${record.id}`,
      projectId,
      fromNodeId: fileNode.id,
      toNodeId: record.id,
      kind: "risk",
      label: "高危追问",
      createdAt,
    });
  }

  for (const weakness of normalizeAiWeaknesses(output.weaknesses)) {
    const record = createAiWeaknessKnowledgeNode({ projectId, source, file, item: weakness, fallbackCitations: citations, createdAt });
    if (!record) continue;
    pushNode(nodesById, record);
    riskAndWeaknessNodes.push(record);
    pushEdge(edgesById, {
      id: `edge-${fileNode.id}-${record.id}`,
      projectId,
      fromNodeId: fileNode.id,
      toNodeId: record.id,
      kind: "risk",
      label: "薄弱点",
      createdAt,
    });
  }

  for (const trainingPath of normalizeAiTrainingPaths(output.trainingPaths)) {
    const record = createAiTrainingKnowledgeNode({
      projectId,
      source,
      file,
      item: trainingPath,
      fallbackCitations: citations,
      createdAt,
    });
    if (!record) continue;
    pushNode(nodesById, record);
    const parents = riskAndWeaknessNodes.length ? riskAndWeaknessNodes : [fileNode];
    for (const parent of parents) {
      pushEdge(edgesById, {
        id: `edge-${parent.id}-${record.id}`,
        projectId,
        fromNodeId: parent.id,
        toNodeId: record.id,
        kind: "training",
        label: "讲练入口",
        createdAt,
      });
    }
  }

  const knowledgeNodes = [...nodesById.values()];
  const nodeIds = new Set(knowledgeNodes.map((node) => node.id));
  const knowledgeEdges = [...edgesById.values()].filter((edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId));
  return { knowledgeNodes, knowledgeEdges };
}

function createStarterKnowledgeNodes({
  projectId,
  source,
  file,
  content,
  parsed,
  createdAt,
}: {
  projectId: string;
  source: ProjectSourceRecord;
  file: DefenseFileRecord;
  content: string;
  parsed?: ParsedFileResult;
  createdAt: string;
}): KnowledgeNodeRecord[] {
  const projectNode: KnowledgeNodeRecord = {
    id: `node-project-${projectId}`,
    projectId,
    kind: "project",
    title: "项目中心",
    summary: "",
    tone: "blue",
    metadata: {},
    createdAt,
  };
  const categoryNode: KnowledgeNodeRecord = {
    id: `node-source-category-${projectId}-${source.kind}`,
    projectId,
    kind: "source-category",
    title: sourceCategoryTitle(source.kind),
    summary: "",
    tone: "green",
    metadata: {
      kind: source.kind,
      layout: { ring: 1 },
    },
    createdAt,
  };
  const moduleNode: KnowledgeNodeRecord = {
    id: `node-module-${source.fileId}`,
    projectId,
    kind: "module",
    title: inferModuleTitle(content),
    summary: inferModuleSummary(content),
    tone: "purple",
    sourceId: source.id,
    metadata: {
      sourceFileId: source.fileId,
      layout: { ring: 2 },
    },
    createdAt,
  };
  const fileNode: KnowledgeNodeRecord = {
    id: `node-file-${source.fileId}`,
    projectId,
    kind: "file",
    title: file.name,
    summary: parsed?.source.summary ?? source.summary,
    tone: source.kind === "presentation" ? "orange" : "cyan",
    sourceId: source.id,
    metadata: {
      fileId: source.fileId,
      sourceId: source.id,
      fileKind: source.kind,
      mimeType: file.type,
      sourcePath: source.sourcePath,
      viewer: viewerForFileKind(source.kind),
      explainable: isFileExplainable(source.kind),
      preview: parsed?.preview ?? null,
      slideCount: parsed?.slides?.length ?? null,
      tableCount: parsed?.tables?.length ?? null,
      codeTreeCount: parsed?.codeTree?.length ?? null,
      layout: { ring: 3 },
    },
    createdAt,
  };
  const trainingNode: KnowledgeNodeRecord = {
    id: `node-training-${source.fileId}`,
    projectId,
    kind: "training",
    title: "文件讲解与追问",
    summary: "",
    tone: "purple",
    sourceId: source.id,
    metadata: {
      fileId: source.fileId,
      action: isFileExplainable(source.kind) ? "explain-file" : "open-slide-script",
      layout: { ring: 4 },
    },
    createdAt,
  };

  return [projectNode, categoryNode, moduleNode, fileNode, trainingNode];
}

function createStarterKnowledgeEdges({
  projectId,
  nodes,
  createdAt,
}: {
  projectId: string;
  nodes: KnowledgeNodeRecord[];
  createdAt: string;
}): KnowledgeEdgeRecord[] {
  const [projectNode, sourceNode, moduleNode] = nodes;
  const fileNode = nodes.find((node) => node.kind === "file");
  const trainingNode = nodes.find((node) => node.kind === "training");
  if (!fileNode || !trainingNode) return [];
  return [
    {
      id: `edge-${projectNode.id}-${sourceNode.id}`,
      projectId,
      fromNodeId: projectNode.id,
      toNodeId: sourceNode.id,
      kind: "source",
      label: "资料类别",
      createdAt,
    },
    {
      id: `edge-${sourceNode.id}-${moduleNode.id}`,
      projectId,
      fromNodeId: sourceNode.id,
      toNodeId: moduleNode.id,
      kind: "contains",
      label: "关联模块",
      createdAt,
    },
    {
      id: `edge-${moduleNode.id}-${fileNode.id}`,
      projectId,
      fromNodeId: moduleNode.id,
      toNodeId: fileNode.id,
      kind: "evidence",
      label: "资料文件",
      createdAt,
    },
    {
      id: `edge-${fileNode.id}-${trainingNode.id}`,
      projectId,
      fromNodeId: fileNode.id,
      toNodeId: trainingNode.id,
      kind: "training",
      label: "讲解入口",
      createdAt,
    },
  ];
}

function createIngestKnowledgeChunks({
  projectId,
  artifact,
  source,
  parsed,
  content,
  createdAt,
}: {
  projectId: string;
  artifact: ReturnType<typeof createProcessingArtifact>;
  source: ProjectSourceRecord;
  parsed?: ParsedFileResult;
  content: string;
  createdAt: string;
}): KnowledgeChunkRecord[] {
  if (!parsed?.chunks?.length) {
    return createKnowledgeChunks({
      projectId,
      artifact,
      content,
      createdAt,
    }).map((chunk) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        sourceId: source.id,
        chunkKind: inferChunkKind(artifact.kind, chunk.metadata),
      },
    }));
  }

  return parsed.chunks
    .filter((chunk) => chunk.content.trim())
    .map((chunk, index) => ({
      id: chunk.id ?? `chunk-${artifact.id}-${index + 1}`,
      projectId,
      artifactId: artifact.id,
      fileId: artifact.fileId,
      content: chunk.content,
      source: chunk.source ?? `${artifact.fileName} · ${artifact.kind}`,
      metadata: {
        fileName: artifact.fileName,
        kind: artifact.kind,
        artifactTitle: artifact.title,
        sourceId: source.id,
        chunkKind: inferChunkKind(artifact.kind, chunk.metadata),
        lineStart: readNumberMetadata(chunk.metadata, "lineStart") ?? index + 1,
        lineEnd: readNumberMetadata(chunk.metadata, "lineEnd") ?? index + 1,
        ...(artifact.sourcePath ? { sourcePath: artifact.sourcePath } : {}),
        ...(chunk.metadata ?? {}),
      },
      createdAt,
    }));
}

function readNumberMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" ? value : undefined;
}

function inferChunkKind(
  fileKind: DefenseFileRecord["kind"],
  metadata: Record<string, unknown> | undefined,
) {
  if (typeof metadata?.codePath === "string" && metadata.codePath.trim()) return "code";
  if (typeof metadata?.sheet === "string" && metadata.sheet.trim()) return "table";
  if (typeof metadata?.cellRange === "string" && metadata.cellRange.trim()) return "table";
  if (typeof metadata?.slide === "number") return "slide";
  if (typeof metadata?.page === "number") return fileKind === "presentation" ? "slide" : "document";
  if (fileKind === "code") return "code";
  if (fileKind === "dataset" || fileKind === "database") return "table";
  if (fileKind === "presentation") return "slide";
  return "document";
}

function sourceCategoryTitle(kind: string) {
  if (kind === "presentation") return "演示稿资料";
  if (kind === "dataset") return "数据与表格";
  if (kind === "code") return "代码资料";
  return "文档资料";
}

function viewerForFileKind(kind: string) {
  if (kind === "presentation") return "slide-script";
  if (kind === "code") return "code-ide";
  if (kind === "dataset") return "table";
  return "document";
}

function isFileExplainable(kind: string) {
  return kind !== "presentation";
}

function inferModuleTitle(content: string) {
  if (content.includes("订单")) return "订单模块";
  if (content.includes("数据库")) return "数据库设计";
  if (content.includes("AI")) return "AI 模块";
  return "项目模块";
}

function inferModuleSummary(content: string) {
  const firstLine = content
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/u, "").trim())
    .find(Boolean);
  return firstLine ?? "从资料中提取的项目模块。";
}

function normalizeAiSemanticNodes(
  items: KnowledgeMapGraphSemanticNode[] | undefined,
  semanticType: KnowledgeMapGraphSemanticType,
): KnowledgeMapGraphSemanticNode[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter(isRecord)
    .map((item) => ({
      ...item,
      semanticType: normalizeSemanticType(readSemanticType(item.semanticType), semanticType),
    }) as KnowledgeMapGraphSemanticNode);
}

function normalizeAiRisks(items: KnowledgeMapGraphRisk[] | undefined): KnowledgeMapGraphRisk[] {
  return Array.isArray(items) ? items.filter(isRecord).map((item) => item as KnowledgeMapGraphRisk) : [];
}

function normalizeAiWeaknesses(items: KnowledgeMapGraphWeakness[] | undefined): KnowledgeMapGraphWeakness[] {
  return Array.isArray(items) ? items.filter(isRecord).map((item) => item as KnowledgeMapGraphWeakness) : [];
}

function normalizeAiTrainingPaths(items: KnowledgeMapGraphTrainingPath[] | undefined): KnowledgeMapGraphTrainingPath[] {
  return Array.isArray(items) ? items.filter(isRecord).map((item) => item as KnowledgeMapGraphTrainingPath) : [];
}

function normalizeCitations(citations: KnowledgeMapGraphCitation[] | undefined) {
  return Array.isArray(citations)
    ? citations.filter(isRecord).map((citation) => citation as KnowledgeMapGraphCitation).filter((citation) => hasCitationSource(citation))
    : [];
}

function createAiSemanticKnowledgeNode({
  projectId,
  source,
  file,
  item,
  fallbackCitations,
  createdAt,
}: {
  projectId: string;
  source: ProjectSourceRecord;
  file: DefenseFileRecord;
  item: KnowledgeMapGraphSemanticNode;
  fallbackCitations: KnowledgeMapGraphCitation[];
  createdAt: string;
}): KnowledgeNodeRecord | null {
  const title = cleanTitle(item.title);
  const citations = citationsForItem(item.citations, fallbackCitations);
  if (!title || !hasModelEvidence(item, citations)) return null;
  const semanticType = normalizeSemanticType(item.semanticType, "feature");

  return {
    id: `node-ai-${semanticType}-${file.id}-${stableIdPart(item.id ?? title)}`,
    projectId,
    kind: "module",
    title,
    summary: item.summary ?? "",
    tone: semanticType === "api" || semanticType === "table" ? "cyan" : "purple",
    sourceId: source.id,
    metadata: {
      aiGenerated: true,
      semanticType,
      fileId: file.id,
      sourceId: source.id,
      sourceFileId: source.fileId,
      citations,
      evidence: normalizeEvidence(item.evidence, citations, file.name),
      riskQuestions: stringList(item.riskQuestions),
      layout: { ring: 2 },
    },
    createdAt,
  };
}

function createAiRiskKnowledgeNode({
  projectId,
  source,
  file,
  item,
  fallbackCitations,
  createdAt,
}: {
  projectId: string;
  source: ProjectSourceRecord;
  file: DefenseFileRecord;
  item: KnowledgeMapGraphRisk;
  fallbackCitations: KnowledgeMapGraphCitation[];
  createdAt: string;
}): KnowledgeNodeRecord | null {
  const title = cleanTitle(item.title);
  const citations = citationsForItem(item.citations, fallbackCitations);
  if (!title || !hasModelEvidence(item, citations)) return null;

  return {
    id: `node-ai-risk-${file.id}-${stableIdPart(item.id ?? title)}`,
    projectId,
    kind: "risk",
    title,
    summary: item.summary ?? "",
    tone: "red",
    sourceId: source.id,
    metadata: {
      aiGenerated: true,
      fileId: file.id,
      sourceId: source.id,
      citations,
      riskLevel: normalizeRiskLevel(item.riskLevel),
      evidence: normalizeEvidence(item.evidence, citations, file.name),
      actions: stringList(item.actions, ["进入模拟讲练", "生成回答框架"]),
      layout: { ring: 4 },
    },
    createdAt,
  };
}

function createAiWeaknessKnowledgeNode({
  projectId,
  source,
  file,
  item,
  fallbackCitations,
  createdAt,
}: {
  projectId: string;
  source: ProjectSourceRecord;
  file: DefenseFileRecord;
  item: KnowledgeMapGraphWeakness;
  fallbackCitations: KnowledgeMapGraphCitation[];
  createdAt: string;
}): KnowledgeNodeRecord | null {
  const title = cleanTitle(item.title);
  const citations = citationsForItem(item.citations, fallbackCitations);
  if (!title || !hasModelEvidence(item, citations)) return null;

  return {
    id: `node-ai-weakness-${file.id}-${stableIdPart(item.id ?? title)}`,
    projectId,
    kind: "weakness",
    title,
    summary: item.summary ?? "",
    tone: "orange",
    sourceId: source.id,
    metadata: {
      aiGenerated: true,
      fileId: file.id,
      sourceId: source.id,
      citations,
      riskLevel: "medium",
      evidence: normalizeEvidence(item.evidence, citations, file.name),
      actions: stringList(item.actions, ["加入薄弱点钻研", "补强讲稿"]),
      layout: { ring: 4 },
    },
    createdAt,
  };
}

function createAiTrainingKnowledgeNode({
  projectId,
  source,
  file,
  item,
  fallbackCitations,
  createdAt,
}: {
  projectId: string;
  source: ProjectSourceRecord;
  file: DefenseFileRecord;
  item: KnowledgeMapGraphTrainingPath;
  fallbackCitations: KnowledgeMapGraphCitation[];
  createdAt: string;
}): KnowledgeNodeRecord | null {
  const title = cleanTitle(item.title);
  const citations = citationsForItem(item.citations, fallbackCitations);
  if (!title || !hasModelEvidence(item, citations)) return null;

  return {
    id: `node-ai-training-${file.id}-${stableIdPart(item.id ?? title)}`,
    projectId,
    kind: "training",
    title,
    summary: item.summary ?? "",
    tone: "purple",
    sourceId: source.id,
    metadata: {
      aiGenerated: true,
      fileId: file.id,
      sourceId: source.id,
      action: isFileExplainable(file.kind) ? "explain-file" : "open-slide-script",
      citations,
      evidence: normalizeEvidence(item.evidence, citations, file.name),
      actions: stringList(item.actions, ["开始讲练"]),
      layout: { ring: 5 },
    },
    createdAt,
  };
}

function pushNode(nodesById: Map<string, KnowledgeNodeRecord>, node: KnowledgeNodeRecord) {
  if (!nodesById.has(node.id)) nodesById.set(node.id, node);
}

function pushEdge(edgesById: Map<string, KnowledgeEdgeRecord>, edge: KnowledgeEdgeRecord) {
  if (!edgesById.has(edge.id)) edgesById.set(edge.id, edge);
}

function cleanTitle(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSemanticType(
  value: KnowledgeMapGraphSemanticType | undefined,
  fallback: KnowledgeMapGraphSemanticType,
): KnowledgeMapGraphSemanticType {
  if (value === "feature" || value === "api" || value === "table" || value === "flow" || value === "architecture") {
    return value;
  }
  return fallback;
}

function readSemanticType(value: unknown) {
  return typeof value === "string" ? value as KnowledgeMapGraphSemanticType : undefined;
}

function normalizeRiskLevel(value: KnowledgeMapGraphRisk["riskLevel"]) {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function citationsForItem(
  itemCitations: KnowledgeMapGraphCitation[] | undefined,
  fallbackCitations: KnowledgeMapGraphCitation[],
) {
  const own = normalizeCitations(itemCitations);
  return own.length ? own : fallbackCitations;
}

function hasModelEvidence(
  item: { evidence?: string[] },
  citations: KnowledgeMapGraphCitation[],
) {
  return stringList(item.evidence).length > 0 || citations.length > 0;
}

function hasCitationSource(citation: KnowledgeMapGraphCitation) {
  return Boolean(
    citation.fileId
      || citation.sourceId
      || citation.fileName
      || citation.codePath
      || citation.sheet
      || citation.text,
  );
}

function normalizeEvidence(
  evidence: string[] | undefined,
  citations: KnowledgeMapGraphCitation[],
  fallbackFileName: string,
) {
  const explicitEvidence = stringList(evidence);
  if (explicitEvidence.length) return explicitEvidence;
  const citationEvidence = citations.map(formatCitationEvidence).filter(Boolean);
  return citationEvidence.length ? citationEvidence : [fallbackFileName];
}

function formatCitationEvidence(citation: KnowledgeMapGraphCitation) {
  const file = citation.fileName ?? citation.codePath ?? citation.sheet ?? citation.fileId ?? citation.sourceId;
  if (!file) return "";
  if (citation.lineStart || citation.lineEnd) {
    return `${file} L${citation.lineStart ?? "?"}-${citation.lineEnd ?? citation.lineStart ?? "?"}`;
  }
  if (citation.page) return `${file} Page ${citation.page}`;
  if (citation.slide) return `${file} Slide ${citation.slide}`;
  return file;
}

function stringList(values: string[] | undefined, fallback: string[] = []) {
  if (!Array.isArray(values)) return fallback;
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length ? normalized : fallback;
}

function stableIdPart(value: string) {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72);
  return normalized || "item";
}

function semanticTypeLabel(value: unknown) {
  if (value === "api") return "接口";
  if (value === "table") return "数据表";
  if (value === "flow") return "流程";
  if (value === "architecture") return "架构";
  return "语义模块";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
