import type {
  DefenseFileKind,
  DefenseProcessingArtifact,
} from "./project-workspace";

export type KnowledgeChunkMetadata = {
  fileName: string;
  kind: DefenseFileKind;
  artifactTitle: string;
  lineStart: number;
  lineEnd: number;
  page?: number;
  slide?: number;
  sheet?: string;
  cellRange?: string;
  codePath?: string;
  sourcePath?: string;
  [key: string]: unknown;
};

export type KnowledgeChunkRecord = {
  id: string;
  projectId: string;
  artifactId: string;
  fileId: string;
  content: string;
  source: string;
  metadata: KnowledgeChunkMetadata;
  retrieval?: {
    embeddingV2: number[];
    sourceId?: string;
    chunkKind?: string;
    page?: number;
    slide?: number;
    sheet?: string;
    codePath?: string;
    lineStart?: number;
    lineEnd?: number;
    retrievalText?: string;
  };
  createdAt: string;
};

export function createKnowledgeChunks({
  projectId,
  artifact,
  content,
  maxCharacters = 1200,
  createdAt = new Date().toISOString(),
}: {
  projectId: string;
  artifact: DefenseProcessingArtifact;
  content: string;
  maxCharacters?: number;
  createdAt?: string;
}): KnowledgeChunkRecord[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  return splitLines(lines, maxCharacters).map((chunk, index) => ({
    id: `chunk-${artifact.id}-${index + 1}`,
    projectId,
    artifactId: artifact.id,
    fileId: artifact.fileId,
    content: chunk.lines.join("\n"),
    source: `${artifact.fileName} · ${artifact.kind}`,
    metadata: {
      fileName: artifact.fileName,
      kind: artifact.kind,
      artifactTitle: artifact.title,
      lineStart: chunk.lineStart,
      lineEnd: chunk.lineEnd,
      ...(artifact.sourcePath ? { sourcePath: artifact.sourcePath } : {}),
    },
    createdAt,
  }));
}

function splitLines(lines: string[], maxCharacters: number) {
  const chunks: Array<{
    lines: string[];
    lineStart: number;
    lineEnd: number;
  }> = [];
  let currentLines: string[] = [];
  let currentLength = 0;
  let lineStart = 1;

  lines.forEach((line, index) => {
    const nextLength = currentLength + line.length + (currentLines.length > 0 ? 1 : 0);
    if (currentLines.length > 0 && nextLength > maxCharacters) {
      chunks.push({
        lines: currentLines,
        lineStart,
        lineEnd: index,
      });
      currentLines = [];
      currentLength = 0;
      lineStart = index + 1;
    }

    currentLines.push(line);
    currentLength += line.length + (currentLines.length > 1 ? 1 : 0);
  });

  if (currentLines.length > 0) {
    chunks.push({
      lines: currentLines,
      lineStart,
      lineEnd: lines.length,
    });
  }

  return chunks;
}
