import type {
  FileExplanationSessionWithTurns,
  FileExplanationTurnRecord,
  KnowledgeEdgeRecord,
  KnowledgeNodeKind,
  KnowledgeNodeRecord,
  NotebookCitation,
  NotebookExplanationMode,
} from "../../packages/shared/src/domain.ts";
import {
  createMockFileExplanationSession,
  mockKnowledgeEdges,
  mockKnowledgeNodes,
} from "./knowledge-map-mock.ts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type KnowledgeMapSource = "api" | "mock";
export type KnowledgeMapViewer = "details" | "pdf" | "docx" | "code" | "table" | "sql" | "presentation";
export type KnowledgeNodeActivation = "details" | "reader" | "scripts";

export type KnowledgeMapNodeUi = {
  id: string;
  projectId: string;
  kind: KnowledgeNodeKind;
  title: string;
  summary: string;
  tone: KnowledgeNodeRecord["tone"];
  sourceId?: string;
  fileId?: string;
  fileKind?: string;
  riskLevel: "low" | "medium" | "high";
  viewer: KnowledgeMapViewer;
  explainable: boolean;
  evidence: string[];
  actions: string[];
  relatedSlides: string[];
  relatedFiles: string[];
  riskQuestions: string[];
  preview: FilePreviewUi;
  raw: KnowledgeNodeRecord;
};

export type KnowledgeMapEdgeUi = {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: KnowledgeEdgeRecord["kind"];
  label?: string;
  active: boolean;
  raw: KnowledgeEdgeRecord;
};

export type KnowledgeMapUi = {
  projectId: string;
  source: KnowledgeMapSource;
  nodes: KnowledgeMapNodeUi[];
  edges: KnowledgeMapEdgeUi[];
};

export type FilePreviewUi = {
  viewer: KnowledgeMapViewer;
  title: string;
  text: string;
  outline: string[];
  pages: Array<{ page: number; title: string; text: string }>;
  codePath?: string;
  language?: string;
  sheetName?: string;
  headers: string[];
  rows: string[][];
};

export type FileExplanationUi = FileExplanationSessionWithTurns & {
  source: KnowledgeMapSource;
};

export function normalizeKnowledgeMapPayload(
  projectId: string,
  payload: { nodes?: KnowledgeNodeRecord[]; edges?: KnowledgeEdgeRecord[] },
  source: KnowledgeMapSource = "api",
): KnowledgeMapUi {
  const nodes = payload.nodes ?? [];
  const edges = payload.edges ?? [];

  return {
    projectId,
    source,
    nodes: nodes.map(normalizeNode),
    edges: edges.map((edge) => normalizeEdge(edge, false)),
  };
}

export async function loadKnowledgeMap(
  projectId: string,
  fetcher: FetchLike = fetch,
): Promise<KnowledgeMapUi> {
  try {
    const response = await fetcher(`/api/projects/${projectId}/knowledge-map`);
    if (!response.ok) throw new Error("Knowledge map request failed.");
    const payload = await response.json() as { nodes?: KnowledgeNodeRecord[]; edges?: KnowledgeEdgeRecord[] };
    if (!payload.nodes?.length) return createMockKnowledgeMap(projectId);
    return normalizeKnowledgeMapPayload(projectId, payload, "api");
  } catch {
    return createMockKnowledgeMap(projectId);
  }
}

export async function loadFileNodePreview(
  projectId: string,
  node: KnowledgeMapNodeUi,
  fetcher: FetchLike = fetch,
): Promise<FilePreviewUi> {
  try {
    const response = await fetcher(`/api/projects/${projectId}/knowledge-map/nodes/${node.id}/preview`);
    if (!response.ok) throw new Error("Preview request failed.");
    const payload = await response.json() as {
      preview?: unknown;
      viewer?: unknown;
      file?: { kind?: unknown };
    };
    return normalizePreview(node, payload.preview, String(payload.viewer ?? payload.file?.kind ?? node.viewer));
  } catch {
    return node.preview;
  }
}

export async function createFileExplanation(
  projectId: string,
  node: KnowledgeMapNodeUi,
  mode: NotebookExplanationMode,
  fetcher: FetchLike = fetch,
): Promise<FileExplanationUi> {
  try {
    const response = await fetcher(`/api/projects/${projectId}/knowledge-map/nodes/${node.id}/explanations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!response.ok) throw new Error("Explanation request failed.");
    const payload = await response.json() as { session?: FileExplanationSessionWithTurns };
    if (!payload.session) throw new Error("Explanation response is missing session.");
    return { ...payload.session, source: "api" };
  } catch {
    return {
      ...createMockFileExplanationSession(projectId, node.raw, mode),
      source: "mock",
    };
  }
}

export async function appendFileExplanationTurn(
  projectId: string,
  session: FileExplanationUi,
  question: string,
  fetcher: FetchLike = fetch,
): Promise<FileExplanationUi> {
  try {
    const response = await fetcher(`/api/projects/${projectId}/file-explanations/${session.id}/turns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) throw new Error("Explanation turn request failed.");
    const payload = await response.json() as { session?: FileExplanationSessionWithTurns };
    if (!payload.session) throw new Error("Explanation turn response is missing session.");
    return { ...payload.session, source: "api" };
  } catch {
    return { ...appendMockFileExplanationTurn(session, question), source: "mock" };
  }
}

export function appendMockFileExplanationTurn(
  session: FileExplanationSessionWithTurns,
  question: string,
): FileExplanationSessionWithTurns {
  const now = new Date().toISOString();
  const citations = session.citations.length ? session.citations : citationsFromMetadata(session.metadata);
  const userTurn: FileExplanationTurnRecord = {
    id: `mock-user-${crypto.randomUUID()}`,
    sessionId: session.id,
    projectId: session.projectId,
    role: "user",
    content: question,
    citations: [],
    metadata: { mocked: true },
    createdAt: now,
  };
  const assistantTurn: FileExplanationTurnRecord = {
    id: `mock-assistant-${crypto.randomUUID()}`,
    sessionId: session.id,
    projectId: session.projectId,
    role: "assistant",
    content: [
      `针对“${question}”，可以从资料证据、个人负责范围和答辩风险三步回答。`,
      "先引用当前文件中的直接依据，再说明它如何支撑 PPT 表达，最后准备一个边界条件的兜底说法。",
    ].join("\n"),
    citations,
    metadata: { mocked: true },
    createdAt: now,
  };

  return {
    ...session,
    updatedAt: now,
    turns: [...session.turns, userTurn, assistantTurn],
  };
}

export function getKnowledgeNodeActivation(node: Pick<KnowledgeMapNodeUi, "kind" | "fileKind"> | { kind?: string; fileKind?: string }) {
  if (node.kind !== "file") return "details";
  if (node.fileKind === "ppt" || node.fileKind === "presentation-pdf") return "scripts";
  return "reader";
}

export function createMockKnowledgeMap(projectId: string): KnowledgeMapUi {
  return normalizeKnowledgeMapPayload(
    projectId,
    {
      nodes: mockKnowledgeNodes.map((node) => ({ ...node, projectId })),
      edges: mockKnowledgeEdges.map((edge) => ({ ...edge, projectId })),
    },
    "mock",
  );
}

export function filterKnowledgeMapNodes({
  nodes,
  edges,
  query,
  filter,
}: {
  nodes: KnowledgeMapNodeUi[];
  edges: KnowledgeMapEdgeUi[];
  query: string;
  filter: string;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const matchesFilter = (node: KnowledgeMapNodeUi) => {
    if (filter === "all") return true;
    if (filter === "risk") return node.kind === "risk" || node.riskLevel === "high";
    if (filter === "weakness") return node.kind === "weakness";
    if (filter === "file") return node.kind === "file";
    if (filter === "training") return node.kind === "training";
    return true;
  };
  const matchesQuery = (node: KnowledgeMapNodeUi) => {
    if (!normalizedQuery) return true;
    return [node.title, node.summary, node.kind, node.fileKind, ...node.evidence]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  };
  const visibleIds = new Set(nodes.filter((node) => matchesFilter(node) && matchesQuery(node)).map((node) => node.id));
  if (!visibleIds.size) return { nodes, edges };
  return {
    nodes: nodes.filter((node) => visibleIds.has(node.id)),
    edges: edges.filter((edge) => visibleIds.has(edge.fromNodeId) && visibleIds.has(edge.toNodeId)),
  };
}

export function markActiveKnowledgeEdges(edges: KnowledgeMapEdgeUi[], activeNodeId: string) {
  return edges.map((edge) => normalizeEdge(edge.raw, edge.fromNodeId === activeNodeId || edge.toNodeId === activeNodeId));
}

function normalizeNode(node: KnowledgeNodeRecord): KnowledgeMapNodeUi {
  const fileKind = stringFromMetadata(node.metadata, "fileKind");
  const viewer = viewerForNode(node.kind, fileKind, stringFromMetadata(node.metadata, "viewer"));
  return {
    id: node.id,
    projectId: node.projectId,
    kind: node.kind,
    title: node.title,
    summary: node.summary,
    tone: node.tone,
    sourceId: node.sourceId,
    fileId: stringFromMetadata(node.metadata, "fileId"),
    fileKind,
    riskLevel: riskLevelFromMetadata(node.metadata),
    viewer,
    explainable: booleanFromMetadata(node.metadata, "explainable", node.kind === "file" && viewer !== "presentation"),
    evidence: stringListFromMetadata(node.metadata, "evidence", [node.title, node.sourceId].filter(Boolean) as string[]),
    actions: stringListFromMetadata(node.metadata, "actions", defaultActionsForKind(node.kind)),
    relatedSlides: stringListFromMetadata(node.metadata, "relatedSlides", []),
    relatedFiles: stringListFromMetadata(node.metadata, "relatedFiles", []),
    riskQuestions: stringListFromMetadata(node.metadata, "riskQuestions", []),
    preview: normalizePreview(node, node.metadata.preview, viewer),
    raw: node,
  };
}

function normalizeEdge(edge: KnowledgeEdgeRecord, active: boolean): KnowledgeMapEdgeUi {
  return {
    id: edge.id,
    projectId: edge.projectId,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
    kind: edge.kind,
    label: edge.label,
    active,
    raw: edge,
  };
}

function normalizePreview(node: KnowledgeNodeRecord | KnowledgeMapNodeUi, preview: unknown, viewerInput: string): FilePreviewUi {
  const record = isRecord(preview) ? preview : {};
  const viewer = normalizeViewer(viewerInput);
  return {
    viewer,
    title: node.title,
    text: stringValue(record.text) ?? ("summary" in node ? node.summary : ""),
    outline: stringArray(record.outline),
    pages: pageArray(record.pages),
    codePath: stringValue(record.codePath),
    language: stringValue(record.language),
    sheetName: stringValue(record.sheetName),
    headers: stringArray(record.headers),
    rows: tableRows(record.rows),
  };
}

function viewerForNode(kind: KnowledgeNodeKind, fileKind?: string, preferred?: string): KnowledgeMapViewer {
  if (preferred) return normalizeViewer(preferred);
  if (kind !== "file") return "details";
  if (fileKind === "pdf") return "pdf";
  if (fileKind === "docx") return "docx";
  if (fileKind === "code") return "code";
  if (fileKind === "sql") return "sql";
  if (fileKind === "csv" || fileKind === "xlsx") return "table";
  if (fileKind === "ppt" || fileKind === "presentation-pdf") return "presentation";
  return "details";
}

function normalizeViewer(value: string): KnowledgeMapViewer {
  if (value === "pdf" || value === "docx" || value === "code" || value === "table" || value === "sql" || value === "presentation") {
    return value;
  }
  if (value === "xlsx" || value === "csv") return "table";
  if (value === "ppt" || value === "presentation-pdf") return "presentation";
  return "details";
}

function riskLevelFromMetadata(metadata: Record<string, unknown>): KnowledgeMapNodeUi["riskLevel"] {
  const value = metadata.riskLevel;
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function defaultActionsForKind(kind: KnowledgeNodeKind) {
  if (kind === "risk") return ["进入模拟讲练", "生成回答框架"];
  if (kind === "weakness") return ["加入薄弱点钻研", "补强讲稿"];
  if (kind === "file") return ["速通讲解", "精通拆解"];
  if (kind === "training") return ["开始讲练"];
  return ["查看证据链", "进入讲练"];
}

function citationsFromMetadata(metadata: Record<string, unknown>): NotebookCitation[] {
  const citations = metadata.citations;
  return Array.isArray(citations) ? citations.filter(isRecord) as NotebookCitation[] : [];
}

function stringFromMetadata(metadata: Record<string, unknown>, key: string) {
  return stringValue(metadata[key]);
}

function booleanFromMetadata(metadata: Record<string, unknown>, key: string, fallback: boolean) {
  const value = metadata[key];
  return typeof value === "boolean" ? value : fallback;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringListFromMetadata(metadata: Record<string, unknown>, key: string, fallback: string[]) {
  const value = stringArray(metadata[key]);
  return value.length ? value : fallback;
}

function pageArray(value: unknown): FilePreviewUi["pages"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{
      page: typeof item.page === "number" ? item.page : 1,
      title: stringValue(item.title) ?? "资料页",
      text: stringValue(item.text) ?? "",
    }];
  });
}

function tableRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(Array.isArray)
    .map((row) => row.map((cell) => String(cell)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
