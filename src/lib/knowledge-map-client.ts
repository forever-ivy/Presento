import type {
  FileExplanationSessionWithTurns,
  KnowledgeEdgeRecord,
  KnowledgeNodeKind,
  KnowledgeNodeRecord,
  NotebookExplanationMode,
} from "../../packages/shared/src/domain.ts";
import { readApiErrorMessage } from "./api-error.ts";
import type {
  DefenseFileKind,
  DefenseFileRecord,
  DefenseProcessingTask,
  DefenseWorkspace,
} from "./project-workspace.ts";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type KnowledgeMapSource = "api";
export type KnowledgeMapViewer = "details" | "pdf" | "docx" | "code" | "table" | "sql" | "presentation";
export type KnowledgeNodeActivation = "details" | "reader" | "scripts";
export type KnowledgeNodeOpenAction = KnowledgeNodeActivation;
export type KnowledgeNodeRole = "mainline" | "expression" | "evidence" | "risk";
export type KnowledgeNodeLayer = 0 | 1 | 2 | 3 | "risk";

export type KnowledgeExpressionEvidenceRefUi = {
  nodeId: string;
  fileId: string;
  label: string;
  reason: string;
  citation?: Record<string, unknown>;
};

export type KnowledgeExpressionUi = {
  oneSentence: string;
  talkTrack: string;
  topQuestion: string;
  riskLevel: "low" | "medium" | "high";
  evidenceRefs: KnowledgeExpressionEvidenceRefUi[];
  actions: string[];
};

export type KnowledgeMapGenerationUi = {
  status: "idle" | "queued" | "running" | "succeeded" | "failed" | "retryable";
  jobId?: string;
  error?: string;
  updatedAt?: string;
  completedAt?: string;
  nodeCount?: number;
  edgeCount?: number;
};

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
  semanticType?: string;
  riskLevel: "low" | "medium" | "high";
  viewer: KnowledgeMapViewer;
  explainable: boolean;
  evidence: string[];
  actions: string[];
  relatedSlides: string[];
  relatedFiles: string[];
  riskQuestions: string[];
  nodeRole?: KnowledgeNodeRole;
  layer?: KnowledgeNodeLayer;
  expression?: KnowledgeExpressionUi;
  evidenceRefs: KnowledgeExpressionEvidenceRefUi[];
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
  generation: KnowledgeMapGenerationUi;
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
  payload: { nodes?: KnowledgeNodeRecord[]; edges?: KnowledgeEdgeRecord[]; generation?: unknown },
  source: KnowledgeMapSource = "api",
): KnowledgeMapUi {
  const nodes = payload.nodes ?? [];
  const edges = payload.edges ?? [];

  return {
    projectId,
    source,
    nodes: nodes.map(normalizeNode),
    edges: normalizeEdges(edges),
    generation: normalizeGeneration(payload.generation),
  };
}

export function createWorkspaceKnowledgeMap(workspace: DefenseWorkspace): KnowledgeMapUi {
  const createdAt = new Date().toISOString();
  const projectNode: KnowledgeNodeRecord = {
    id: `workspace-project-${workspace.project.id}`,
    projectId: workspace.project.id,
    kind: "project",
    title: workspace.project.name || "项目资料",
    summary: `${workspace.files.length} 份资料已接入，后台解析完成后会自动生成完整知识地图。`,
    tone: "blue",
    metadata: {
      layout: { ring: 0 },
    },
    createdAt,
  };

  const filesByKind = groupFilesByKind(workspace.files);
  const categoryNodes = Array.from(filesByKind.entries()).map(([kind, files]) =>
    createWorkspaceCategoryNode(workspace.project.id, kind, files.length, createdAt),
  );
  const fileNodes = workspace.files.map((file) =>
    createWorkspaceFileNode(workspace.project.id, file, workspace.processingTasks, createdAt),
  );
  const edges: KnowledgeEdgeRecord[] = [
    ...categoryNodes.map((node) => ({
      id: `workspace-edge-${projectNode.id}-${node.id}`,
      projectId: workspace.project.id,
      fromNodeId: projectNode.id,
      toNodeId: node.id,
      kind: "contains" as const,
      label: "资料类型",
      createdAt,
    })),
    ...workspace.files.map((file) => ({
      id: `workspace-edge-${workspaceCategoryId(file.kind)}-${workspaceFileNodeId(file.id)}`,
      projectId: workspace.project.id,
      fromNodeId: workspaceCategoryId(file.kind),
      toNodeId: workspaceFileNodeId(file.id),
      kind: "evidence" as const,
      label: "已上传",
      createdAt,
    })),
  ];

  return normalizeKnowledgeMapPayload(workspace.project.id, {
    edges,
    nodes: [projectNode, ...categoryNodes, ...fileNodes],
  });
}

export function mergeWorkspaceKnowledgeMap(
  apiMap: KnowledgeMapUi,
  workspace: DefenseWorkspace | null | undefined,
): KnowledgeMapUi {
  if (!workspace?.files.length) return apiMap;

  const workspaceMap = createWorkspaceKnowledgeMap(workspace);
  if (!apiMap.nodes.length) return workspaceMap;

  const representedFileIds = new Set(
    apiMap.nodes
      .map((node) => node.fileId)
      .filter((fileId): fileId is string => Boolean(fileId)),
  );
  const missingFiles = workspace.files.filter((file) => !representedFileIds.has(file.id));
  if (!missingFiles.length) return apiMap;

  const nodes = [...apiMap.nodes];
  const edges = [...apiMap.edges];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const edgePairs = new Set(edges.map((edge) => edgePairKey(edge.fromNodeId, edge.toNodeId)));
  const rootNode = nodes.find((node) => node.kind === "project") ?? nodes[0];
  const missingFilesByKind = groupFilesByKind(missingFiles);

  for (const [kind, files] of missingFilesByKind) {
    const categoryNode = findCategoryNodeForKind(nodes, kind)
      ?? workspaceMap.nodes.find((node) => node.kind === "source-category" && categoryKindForNode(node) === kind);
    if (!categoryNode) continue;

    if (!nodeIds.has(categoryNode.id)) {
      nodes.push(categoryNode);
      nodeIds.add(categoryNode.id);
    }

    if (rootNode && categoryNode.id !== rootNode.id) {
      pushKnowledgeEdge(edges, edgeIds, edgePairs, {
        id: `workspace-edge-${rootNode.id}-${categoryNode.id}`,
        projectId: apiMap.projectId,
        fromNodeId: rootNode.id,
        toNodeId: categoryNode.id,
        kind: "contains",
        label: "已上传",
        active: false,
        raw: {
          id: `workspace-edge-${rootNode.id}-${categoryNode.id}`,
          projectId: apiMap.projectId,
          fromNodeId: rootNode.id,
          toNodeId: categoryNode.id,
          kind: "contains",
          label: "已上传",
          createdAt: new Date().toISOString(),
        },
      });
    }

    for (const file of files) {
      const fileNode = workspaceMap.nodes.find((node) => node.fileId === file.id);
      if (!fileNode || nodeIds.has(fileNode.id)) continue;

      nodes.push(fileNode);
      nodeIds.add(fileNode.id);
      pushKnowledgeEdge(edges, edgeIds, edgePairs, {
        id: `workspace-edge-${categoryNode.id}-${fileNode.id}`,
        projectId: apiMap.projectId,
        fromNodeId: categoryNode.id,
        toNodeId: fileNode.id,
        kind: "evidence",
        label: "已上传",
        active: false,
        raw: {
          id: `workspace-edge-${categoryNode.id}-${fileNode.id}`,
          projectId: apiMap.projectId,
          fromNodeId: categoryNode.id,
          toNodeId: fileNode.id,
          kind: "evidence",
          label: "已上传",
          createdAt: new Date().toISOString(),
        },
      });
    }
  }

  return {
    ...apiMap,
    nodes,
    edges,
  };
}

export async function loadKnowledgeMap(
  projectId: string,
  fetcher: FetchLike = fetch,
): Promise<KnowledgeMapUi> {
  const response = await fetcher(`/api/projects/${projectId}/knowledge-map`);
  if (!response.ok) throw new Error(await readApiErrorMessage(response, "Knowledge map request failed."));
  const payload = await response.json() as { nodes?: KnowledgeNodeRecord[]; edges?: KnowledgeEdgeRecord[]; generation?: unknown };
  return normalizeKnowledgeMapPayload(projectId, payload, "api");
}

function groupFilesByKind(files: DefenseFileRecord[]) {
  const groups = new Map<DefenseFileKind, DefenseFileRecord[]>();
  for (const file of files) {
    const group = groups.get(file.kind) ?? [];
    group.push(file);
    groups.set(file.kind, group);
  }
  return groups;
}

function createWorkspaceCategoryNode(
  projectId: string,
  kind: DefenseFileKind,
  count: number,
  createdAt: string,
): KnowledgeNodeRecord {
  return {
    id: workspaceCategoryId(kind),
    projectId,
    kind: "source-category",
    title: workspaceCategoryLabel(kind),
    summary: `${count} 份${workspaceCategoryLabel(kind)}已接入。`,
    tone: workspaceToneForKind(kind),
    metadata: {
      fileKind: kind,
      layout: { ring: 1 },
    },
    createdAt,
  };
}

function createWorkspaceFileNode(
  projectId: string,
  file: DefenseFileRecord,
  tasks: DefenseProcessingTask[],
  createdAt: string,
): KnowledgeNodeRecord {
  const task = tasks.find((item) => item.fileId === file.id);
  const statusText = workspaceFileStatusText(file, task);
  return {
    id: workspaceFileNodeId(file.id),
    projectId,
    kind: "file",
    title: file.name,
    summary: statusText,
    tone: workspaceToneForKind(file.kind),
    sourceId: file.source,
    metadata: {
      actions: ["查看文件", "等待解析"],
      evidence: [file.name, statusText],
      explainable: false,
      fileId: file.id,
      fileKind: file.kind,
      mimeType: file.type,
      preview: {
        text: statusText,
      },
      riskLevel: "low",
      viewer: workspaceViewerForKind(file.kind),
      layout: { ring: 2 },
    },
    createdAt,
  };
}

function workspaceCategoryId(kind: DefenseFileKind) {
  return `workspace-category-${kind}`;
}

function workspaceFileNodeId(fileId: string) {
  return `workspace-file-${fileId}`;
}

function workspaceFileStatusText(file: DefenseFileRecord, task: DefenseProcessingTask | undefined) {
  if (!task) return `${file.status || "文件已接入"}。`;
  if (task.status === "completed") return "文件已解析完成，等待生成知识节点。";
  if (task.status === "failed") return task.error ? `解析失败：${task.error}` : "解析失败，请检查文件格式。";
  if (task.status === "processing") return `正在解析：${task.title}。`;
  return `等待解析：${task.title}。`;
}

function workspaceCategoryLabel(kind: DefenseFileKind) {
  const labels: Record<DefenseFileKind, string> = {
    presentation: "演示资料",
    document: "项目文档",
    code: "代码文件",
    database: "数据库脚本",
    dataset: "数据表",
    asset: "图片素材",
    other: "其他资料",
  };
  return labels[kind];
}

function findCategoryNodeForKind(nodes: KnowledgeMapNodeUi[], kind: DefenseFileKind) {
  return nodes.find((node) => node.kind === "source-category" && categoryKindForNode(node) === kind);
}

function categoryKindForNode(node: KnowledgeMapNodeUi) {
  const metadataKind = stringFromMetadata(node.raw.metadata, "kind");
  return node.fileKind ?? metadataKind;
}

function pushKnowledgeEdge(
  edges: KnowledgeMapEdgeUi[],
  edgeIds: Set<string>,
  edgePairs: Set<string>,
  edge: KnowledgeMapEdgeUi,
) {
  if (edgeIds.has(edge.id)) return;
  const pairKey = edgePairKey(edge.fromNodeId, edge.toNodeId);
  if (edgePairs.has(pairKey)) return;
  edges.push(edge);
  edgeIds.add(edge.id);
  edgePairs.add(pairKey);
}

function workspaceToneForKind(kind: DefenseFileKind): KnowledgeNodeRecord["tone"] {
  const tones: Record<DefenseFileKind, KnowledgeNodeRecord["tone"]> = {
    presentation: "purple",
    document: "cyan",
    code: "green",
    database: "orange",
    dataset: "blue",
    asset: "cyan",
    other: "blue",
  };
  return tones[kind];
}

function workspaceViewerForKind(kind: DefenseFileKind): KnowledgeMapViewer {
  if (kind === "presentation") return "presentation";
  if (kind === "code") return "code";
  if (kind === "database") return "sql";
  if (kind === "dataset") return "table";
  if (kind === "document") return "docx";
  return "details";
}

export async function loadFileNodePreview(
  projectId: string,
  node: KnowledgeMapNodeUi,
  fetcher: FetchLike = fetch,
  options: {
    focusNodeId?: string;
  } = {},
): Promise<FilePreviewUi> {
  const query = new URLSearchParams();
  if (options.focusNodeId) query.set("focusNodeId", options.focusNodeId);
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetcher(`/api/projects/${projectId}/knowledge-map/nodes/${node.id}/preview${suffix}`);
  if (!response.ok) throw new Error(await readApiErrorMessage(response, "Preview request failed."));
  const payload = await response.json() as {
    chunks?: unknown;
    file?: { id?: unknown; kind?: unknown; mimeType?: unknown; sourcePath?: unknown; fileName?: unknown };
    preview?: unknown;
    viewer?: unknown;
  };
  const previewRecord = isRecord(payload.preview) ? payload.preview : {};
  return normalizePreview(node, payload.preview, String(payload.viewer ?? payload.file?.kind ?? node.viewer), {
    chunks: payload.chunks,
    fileId: stringValue(payload.file?.id),
    fileName: stringValue(payload.file?.sourcePath)
      ?? stringValue(payload.file?.fileName)
      ?? stringValue(previewRecord.fileName)
      ?? node.title,
    mimeType: stringValue(payload.file?.mimeType),
    projectId,
  });
}

export async function createFileExplanation(
  projectId: string,
  node: KnowledgeMapNodeUi,
  mode: NotebookExplanationMode,
  fetcher: FetchLike = fetch,
  options: {
    focusNodeId?: string;
  } = {},
): Promise<FileExplanationUi> {
  const response = await fetcher(`/api/projects/${projectId}/knowledge-map/nodes/${node.id}/explanations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode,
      ...(options.focusNodeId ? { focusNodeId: options.focusNodeId } : {}),
    }),
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
  if ("nodeRole" in node && node.nodeRole === "evidence") return "reader";
  if (isPresentationFileKind(node.fileKind)) return "scripts";
  return "reader";
}

export function getKnowledgeNodeOpenAction(
  node: (Pick<KnowledgeMapNodeUi, "kind" | "fileKind"> | { kind?: string; fileKind?: string }) & {
    fileId?: string;
    metadata?: Record<string, unknown>;
  },
): KnowledgeNodeOpenAction {
  if (node.kind === "training") {
    const action = typeof node.metadata?.action === "string" ? node.metadata.action : undefined;
    if (action === "open-slide-script") return "scripts";
    if (action === "explain-file" && node.fileId) return "reader";
    return "details";
  }
  return getKnowledgeNodeActivation(node);
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
    return [node.title, node.summary, node.kind, node.fileKind, node.semanticType, ...node.evidence]
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
  const expression = expressionFromMetadata(node.metadata);
  const evidenceRefs = expression?.evidenceRefs ?? evidenceRefsFromMetadata(node.metadata.evidenceRefs);
  const riskQuestions = stringListFromMetadata(
    node.metadata,
    "riskQuestions",
    expression?.topQuestion ? [expression.topQuestion] : [],
  );
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
    semanticType: stringFromMetadata(node.metadata, "semanticType"),
    riskLevel: expression?.riskLevel ?? riskLevelFromMetadata(node.metadata),
    viewer,
    explainable: booleanFromMetadata(node.metadata, "explainable", node.kind === "file" && viewer !== "presentation"),
    evidence: stringListFromMetadata(
      node.metadata,
      "evidence",
      evidenceRefs.length
        ? evidenceRefs.map((ref) => `${ref.label}：${ref.reason}`)
        : [node.title, node.sourceId].filter(Boolean) as string[],
    ),
    actions: stringListFromMetadata(node.metadata, "actions", expression?.actions ?? defaultActionsForKind(node.kind)),
    relatedSlides: stringListFromMetadata(node.metadata, "relatedSlides", []),
    relatedFiles: stringListFromMetadata(node.metadata, "relatedFiles", []),
    riskQuestions,
    nodeRole: nodeRoleFromMetadata(node.metadata),
    layer: layerFromMetadata(node.metadata),
    expression,
    evidenceRefs,
    preview: normalizePreview(node, node.metadata.preview, viewer),
    raw: node,
  };
}

function normalizeGeneration(value: unknown): KnowledgeMapGenerationUi {
  if (!isRecord(value)) return { status: "idle" };
  const status = value.status;
  const normalizedStatus = status === "queued" || status === "running" || status === "succeeded" || status === "failed" || status === "retryable"
    ? status
    : "idle";
  return {
    status: normalizedStatus,
    completedAt: stringValue(value.completedAt),
    edgeCount: numberValue(value.edgeCount),
    error: stringValue(value.error),
    jobId: stringValue(value.jobId),
    nodeCount: numberValue(value.nodeCount),
    updatedAt: stringValue(value.updatedAt),
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

function normalizeEdges(edges: KnowledgeEdgeRecord[]) {
  const edgeIds = new Set<string>();
  const edgePairs = new Set<string>();
  const normalizedEdges: KnowledgeMapEdgeUi[] = [];

  for (const edge of edges) {
    if (edgeIds.has(edge.id)) continue;
    const pairKey = edgePairKey(edge.fromNodeId, edge.toNodeId);
    if (edgePairs.has(pairKey)) continue;
    normalizedEdges.push(normalizeEdge(edge, false));
    edgeIds.add(edge.id);
    edgePairs.add(pairKey);
  }

  return normalizedEdges;
}

function edgePairKey(fromNodeId: string, toNodeId: string) {
  return fromNodeId < toNodeId
    ? `${fromNodeId}\u0000${toNodeId}`
    : `${toNodeId}\u0000${fromNodeId}`;
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
  const fileName = options.fileName ?? stringValue(record.fileName) ?? ("title" in node ? node.title : undefined);
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
  if (isPresentationFileKind(fileKind)) return "presentation";
  return "details";
}

function normalizeViewer(value: string): KnowledgeMapViewer {
  if (value === "pdf" || value === "docx" || value === "code" || value === "table" || value === "sql" || value === "presentation") {
    return value;
  }
  if (value === "xlsx" || value === "csv") return "table";
  if (isPresentationFileKind(value)) return "presentation";
  if (value === "code-ide") return "code";
  if (value === "document" || value === "markdown" || value === "txt") return "docx";
  if (value === "slide-script") return "presentation";
  return "details";
}

function isPresentationFileKind(fileKind: string | undefined) {
  return fileKind === "presentation" || fileKind === "ppt" || fileKind === "pptx" || fileKind === "presentation-pdf";
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

function nodeRoleFromMetadata(metadata: Record<string, unknown>): KnowledgeNodeRole | undefined {
  const value = metadata.nodeRole;
  if (value === "mainline" || value === "expression" || value === "evidence" || value === "risk") return value;
  return undefined;
}

function layerFromMetadata(metadata: Record<string, unknown>): KnowledgeNodeLayer | undefined {
  const value = metadata.layer;
  if (value === "risk") return value;
  if (value === 0 || value === 1 || value === 2 || value === 3) return value;
  return undefined;
}

function expressionFromMetadata(metadata: Record<string, unknown>): KnowledgeExpressionUi | undefined {
  const expression = isRecord(metadata.expression) ? metadata.expression : null;
  if (!expression) return undefined;
  const oneSentence = stringValue(expression.oneSentence);
  const talkTrack = stringValue(expression.talkTrack);
  const topQuestion = stringValue(expression.topQuestion);
  if (!oneSentence || !talkTrack || !topQuestion) return undefined;
  return {
    oneSentence,
    talkTrack,
    topQuestion,
    riskLevel: riskLevelFromMetadata(expression),
    evidenceRefs: evidenceRefsFromMetadata(expression.evidenceRefs),
    actions: stringArray(expression.actions),
  };
}

function evidenceRefsFromMetadata(value: unknown): KnowledgeExpressionEvidenceRefUi[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const nodeId = stringValue(item.nodeId);
    const fileId = stringValue(item.fileId);
    const label = stringValue(item.label);
    const reason = stringValue(item.reason);
    if (!nodeId || !fileId || !label || !reason) return [];
    return [{
      nodeId,
      fileId,
      label,
      reason,
      ...(isRecord(item.citation) ? { citation: item.citation } : {}),
    }];
  });
}

function defaultActionsForKind(kind: KnowledgeNodeKind) {
  if (kind === "risk") return ["加入讲练重点", "生成回答框架"];
  if (kind === "weakness") return ["加入薄弱点钻研", "补强讲稿"];
  if (kind === "file") return ["速通讲解", "精通拆解"];
  if (kind === "training") return ["查看关联资料"];
  return ["查看证据链", "加入讲练重点"];
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
