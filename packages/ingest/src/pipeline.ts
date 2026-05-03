import type {
  KnowledgeEdgeRecord,
  KnowledgeNodeRecord,
  ParsedFileResult,
  ProjectSourceRecord,
} from "@shared/domain";
import { createKnowledgeChunks } from "../../../src/lib/knowledge-chunks.ts";
import type { KnowledgeChunkRecord } from "../../../src/lib/knowledge-chunks.ts";
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
}: {
  projectId: string;
  file: DefenseFileRecord;
  task: DefenseProcessingTask;
  content: string;
  parsed?: ParsedFileResult;
  createdAt?: string;
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

  const knowledgeNodes = createStarterKnowledgeNodes({
    projectId,
    source,
    file,
    content,
    parsed,
    createdAt,
  });
  const knowledgeEdges = createStarterKnowledgeEdges({
    projectId,
    nodes: knowledgeNodes,
    createdAt,
  });

  return {
    source,
    artifact,
    chunks,
    knowledgeNodes,
    knowledgeEdges,
  };
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
