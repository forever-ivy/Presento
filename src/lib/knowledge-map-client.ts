import type {
  FileExplanationSessionWithTurns,
  KnowledgeEdgeRecord,
  KnowledgeNodeKind,
  KnowledgeNodeRecord,
  NotebookExplanationMode,
} from "../../packages/shared/src/domain.ts";
import { readApiErrorMessage } from "./api-error.ts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type KnowledgeMapSource = "api";
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
  assetUrl?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  viewer: KnowledgeMapViewer;
  title: string;
  text: string;
  outline: string[];
  pages: Array<{ page: number; title: string; text: string }>;
  codeFiles: Array<{
    path: string;
    language?: string;
    content: string;
    lineStart?: number;
    lineEnd?: number;
  }>;
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
  const response = await fetcher(`/api/projects/${projectId}/knowledge-map`);
  if (!response.ok) throw new Error(await readApiErrorMessage(response, "Knowledge map request failed."));
  const payload = await response.json() as { nodes?: KnowledgeNodeRecord[]; edges?: KnowledgeEdgeRecord[] };
  return normalizeKnowledgeMapPayload(projectId, payload, "api");
}

export async function loadFileNodePreview(
  projectId: string,
  node: KnowledgeMapNodeUi,
  fetcher: FetchLike = fetch,
): Promise<FilePreviewUi> {
  const response = await fetcher(`/api/projects/${projectId}/knowledge-map/nodes/${node.id}/preview`);
  if (!response.ok) throw new Error(await readApiErrorMessage(response, "Preview request failed."));
  const payload = await response.json() as {
    chunks?: unknown;
    file?: { id?: unknown; kind?: unknown; mimeType?: unknown };
    preview?: unknown;
    viewer?: unknown;
  };
  return normalizePreview(node, payload.preview, String(payload.viewer ?? payload.file?.kind ?? node.viewer), {
    chunks: payload.chunks,
    fileId: stringValue(payload.file?.id),
    fileName: node.title,
    mimeType: stringValue(payload.file?.mimeType),
    projectId,
  });
}

export async function createFileExplanation(
  projectId: string,
  node: KnowledgeMapNodeUi,
  mode: NotebookExplanationMode,
  fetcher: FetchLike = fetch,
): Promise<FileExplanationUi> {
  const response = await fetcher(`/api/projects/${projectId}/knowledge-map/nodes/${node.id}/explanations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, "Explanation request failed."));
  const payload = await response.json() as { session?: FileExplanationSessionWithTurns };
  if (!payload.session) throw new Error("Explanation response is missing session.");
  return { ...payload.session, source: "api" };
}

export async function appendFileExplanationTurn(
  projectId: string,
  session: FileExplanationUi,
  question: string,
  fetcher: FetchLike = fetch,
): Promise<FileExplanationUi> {
  const response = await fetcher(`/api/projects/${projectId}/file-explanations/${session.id}/turns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, "Explanation turn request failed."));
  const payload = await response.json() as { session?: FileExplanationSessionWithTurns };
  if (!payload.session) throw new Error("Explanation turn response is missing session.");
  return { ...payload.session, source: "api" };
}

export function getKnowledgeNodeActivation(node: Pick<KnowledgeMapNodeUi, "kind" | "fileKind"> | { kind?: string; fileKind?: string }) {
  if (node.kind !== "file") return "details";
  if (node.fileKind === "ppt" || node.fileKind === "presentation-pdf") return "scripts";
  return "reader";
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

function normalizePreview(
  node: KnowledgeNodeRecord | KnowledgeMapNodeUi,
  preview: unknown,
  viewerInput: string,
  options: {
    chunks?: unknown;
    fileId?: string;
    fileName?: string;
    mimeType?: string;
    projectId?: string;
  } = {},
): FilePreviewUi {
  const record = isRecord(preview) ? preview : {};
  const viewer = normalizeViewer(viewerInput);
  const metadata = "metadata" in node && isRecord(node.metadata) ? node.metadata : {};
  const nodeFileId = "fileId" in node && typeof node.fileId === "string"
    ? node.fileId
    : stringValue(metadata.fileId);
  const fileId = options.fileId ?? nodeFileId;
  const fileName = options.fileName ?? ("title" in node ? node.title : undefined);
  const mimeType = options.mimeType ?? stringValue(metadata.mimeType);
  const projectId = options.projectId ?? ("projectId" in node && typeof node.projectId === "string" ? node.projectId : undefined);
  const text = stringValue(record.text) ?? ("summary" in node ? node.summary : "");
  const codeFiles = codeFilesFromPreview({
    chunks: options.chunks,
    fallbackLanguage: stringValue(record.language),
    fallbackPath: stringValue(record.codePath) ?? fileName,
    fallbackText: text,
  });
  return {
    assetUrl: stringValue(record.assetUrl) ?? (fileId && projectId ? `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/content` : undefined),
    codeFiles,
    fileId,
    fileName,
    mimeType,
    viewer,
    title: node.title,
    text,
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
  if (value === "code-ide") return "code";
  if (value === "document" || value === "markdown" || value === "txt") return "docx";
  if (value === "slide-script") return "presentation";
  return "details";
}

function codeFilesFromPreview({
  chunks,
  fallbackLanguage,
  fallbackPath,
  fallbackText,
}: {
  chunks?: unknown;
  fallbackLanguage?: string;
  fallbackPath?: string;
  fallbackText: string;
}): FilePreviewUi["codeFiles"] {
  const chunkList = Array.isArray(chunks) ? chunks.filter(isRecord) : [];
  const grouped = new Map<string, Array<{ content: string; lineStart?: number; lineEnd?: number; language?: string }>>();

  for (const chunk of chunkList) {
    const content = stringValue(chunk.content);
    if (!content) continue;
    const metadata = isRecord(chunk.metadata) ? chunk.metadata : {};
    const path = stringValue(metadata.codePath) ?? inferCodePathFromChunk(content) ?? fallbackPath ?? "source";
    const group = grouped.get(path) ?? [];
    group.push({
      content: stripCodeMarker(content, path),
      language: stringValue(metadata.language) ?? fallbackLanguage ?? languageFromPath(path),
      lineEnd: numberValue(metadata.lineEnd),
      lineStart: numberValue(metadata.lineStart),
    });
    grouped.set(path, group);
  }

  if (grouped.size === 0 && fallbackText.trim()) {
    return [{
      content: fallbackText,
      language: fallbackLanguage ?? languageFromPath(fallbackPath ?? ""),
      path: fallbackPath ?? "source",
    }];
  }

  return [...grouped.entries()].map(([path, parts]) => {
    const sorted = [...parts].sort((left, right) => (left.lineStart ?? 0) - (right.lineStart ?? 0));
    return {
      content: sorted.map((part) => part.content).join("\n\n"),
      language: sorted.find((part) => part.language)?.language ?? languageFromPath(path),
      lineEnd: sorted.at(-1)?.lineEnd,
      lineStart: sorted[0]?.lineStart,
      path,
    };
  });
}

function inferCodePathFromChunk(content: string) {
  const match = /^---\s+(.+?)\s+---/u.exec(content.trim());
  return match?.[1];
}

function stripCodeMarker(content: string, path: string) {
  return content.replace(new RegExp(`^---\\s+${escapeRegExp(path)}\\s+---\\s*`, "u"), "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function languageFromPath(path: string) {
  const extension = path.toLowerCase().split(".").pop();
  if (extension === "ts" || extension === "tsx") return "typescript";
  if (extension === "js" || extension === "jsx") return "javascript";
  if (extension === "py") return "python";
  if (extension === "sql") return "sql";
  if (extension === "json") return "json";
  if (extension === "md") return "markdown";
  if (extension === "css") return "css";
  if (extension === "html") return "html";
  return undefined;
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

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
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
