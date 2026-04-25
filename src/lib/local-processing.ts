import type {
  DefenseFileKind,
  DefenseFileRecord,
  DefenseProcessingTask,
} from "./project-workspace";

export type ProcessingArtifact = {
  id: string;
  taskId: string;
  fileId: string;
  fileName: string;
  kind: DefenseFileKind;
  title: string;
  summary: string;
  previewLines: string[];
  sourcePath?: string;
  createdAt: string;
};

export function createProcessingArtifact({
  file,
  task,
  content,
  createdAt = new Date().toISOString(),
}: {
  file: DefenseFileRecord;
  task: DefenseProcessingTask;
  content: string;
  createdAt?: string;
}): ProcessingArtifact {
  const previewLines = previewForContent(file, content);
  const summary = summaryForContent(file, content, previewLines);

  return {
    id: `artifact-${task.id}`,
    taskId: task.id,
    fileId: file.id,
    fileName: file.name,
    kind: file.kind,
    title: `${file.name} 解析结果`,
    summary,
    previewLines,
    sourcePath: file.storagePath,
    createdAt,
  };
}

export function resolveLocalStoragePath(storagePath: string, cwd: string) {
  if (storagePath.startsWith("/") || storagePath.includes("..")) {
    throw new Error("Invalid storage path");
  }

  const normalized = storagePath.replace(/\\/g, "/");
  if (!normalized.startsWith(".data/uploads/")) {
    throw new Error("Invalid storage path");
  }

  return `${cwd.replace(/\/$/g, "")}/${normalized}`;
}

function previewForContent(file: DefenseFileRecord, content: string) {
  if (file.kind === "dataset" && looksLikeJson(file.name, content)) {
    return jsonPreview(content);
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function summaryForContent(
  file: DefenseFileRecord,
  content: string,
  previewLines: string[],
) {
  if (file.kind === "dataset" && looksLikeJson(file.name, content)) {
    const keys = jsonTopLevelKeys(content);
    if (keys.length) {
      return `识别 JSON 顶层字段 ${keys.length} 个：${keys.join("、")}。`;
    }
  }

  if (file.kind === "dataset" && file.name.toLowerCase().endsWith(".csv")) {
    const rows = content.split(/\r?\n/).filter((line) => line.trim()).length;
    const columns = previewLines[0]?.split(",").length ?? 0;
    return `识别 CSV ${Math.max(rows - 1, 0)} 行数据，${columns} 个字段。`;
  }

  const lineCount = content.split(/\r?\n/).filter((line) => line.trim()).length;
  const chunkCount = Math.max(1, Math.ceil(content.length / 1200));
  return `抽取 ${lineCount} 行文本，预计切分 ${chunkCount} 个知识片段。`;
}

function looksLikeJson(fileName: string, content: string) {
  return fileName.toLowerCase().endsWith(".json") || content.trim().startsWith("{");
}

function jsonPreview(content: string) {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return Object.entries(parsed)
      .slice(0, 5)
      .map(([key, value]) => `${key}: ${formatPreviewValue(value)}`);
  } catch {
    return content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5);
  }
}

function jsonTopLevelKeys(content: string) {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return Object.keys(parsed).slice(0, 5);
  } catch {
    return [];
  }
}

function formatPreviewValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
