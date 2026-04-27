import type { KnowledgeEdgeRecord, KnowledgeNodeRecord, ProjectSourceRecord } from "@shared/domain";
import { createKnowledgeChunks } from "../../../src/lib/knowledge-chunks.ts";
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
  createdAt = new Date().toISOString(),
}: {
  projectId: string;
  file: DefenseFileRecord;
  task: DefenseProcessingTask;
  content: string;
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
    title: `${file.name} 来源`,
    summary: artifact.summary,
    sourcePath: file.storagePath,
    metadata: {
      mimeType: file.type,
      uploadedFrom: file.source,
    },
    createdAt,
  };

  const chunks = createKnowledgeChunks({
    projectId,
    artifact,
    content,
    createdAt,
  });

  const knowledgeNodes = createStarterKnowledgeNodes({
    projectId,
    source,
    content,
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
  content,
  createdAt,
}: {
  projectId: string;
  source: ProjectSourceRecord;
  content: string;
  createdAt: string;
}): KnowledgeNodeRecord[] {
  const projectNode: KnowledgeNodeRecord = {
    id: `node-project-${projectId}`,
    projectId,
    kind: "project",
    title: "项目中心",
    summary: "当前项目的资料、模块、风险与训练入口。",
    tone: "blue",
    metadata: {},
    createdAt,
  };
  const sourceNode: KnowledgeNodeRecord = {
    id: `node-source-${source.fileId}`,
    projectId,
    kind: "source",
    title: source.title,
    summary: source.summary,
    tone: "green",
    sourceId: source.id,
    metadata: {
      fileId: source.fileId,
      kind: source.kind,
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
    },
    createdAt,
  };

  return [projectNode, sourceNode, moduleNode];
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
  return [
    {
      id: `edge-${projectNode.id}-${sourceNode.id}`,
      projectId,
      fromNodeId: projectNode.id,
      toNodeId: sourceNode.id,
      kind: "source",
      label: "资料来源",
      createdAt,
    },
    {
      id: `edge-${sourceNode.id}-${moduleNode.id}`,
      projectId,
      fromNodeId: sourceNode.id,
      toNodeId: moduleNode.id,
      kind: "training",
      label: "解析模块",
      createdAt,
    },
  ];
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
