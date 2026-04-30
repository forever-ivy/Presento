import type { KnowledgeChunkRecord } from "../../../src/lib/knowledge-chunks.ts";
import type { DefenseProcessingTask } from "../../../src/lib/project-workspace.ts";
import { createTextEmbedding, formatEmbeddingForPgvector } from "../../../src/lib/text-embedding.ts";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../../db/src/runner.ts";
import { sqlJson, sqlNumber, sqlText, sqlTimestamp } from "../../db/src/sql.ts";
import type { KnowledgeEdgeRecord, KnowledgeNodeRecord, ProjectSourceRecord } from "../../shared/src/domain.ts";
import type { ProcessingArtifact } from "../../../src/lib/local-processing.ts";
import type { SlideDeckRecord, SlideRecord } from "./slides.ts";

export async function persistIngestedFile({
  projectId,
  task,
  source,
  artifact,
  chunks,
  knowledgeNodes,
  knowledgeEdges,
  slideDeck,
  slides,
  runSql = runDockerComposePsql,
}: {
  projectId: string;
  task: DefenseProcessingTask;
  source: ProjectSourceRecord;
  artifact: ProcessingArtifact;
  chunks: KnowledgeChunkRecord[];
  knowledgeNodes: KnowledgeNodeRecord[];
  knowledgeEdges: KnowledgeEdgeRecord[];
  slideDeck?: SlideDeckRecord | null;
  slides?: SlideRecord[];
  runSql?: PsqlRunner;
}) {
  const helpers = createJsonRepositoryHelpers(runSql);
  const statements = [
    "BEGIN;",
    upsertSourceSql(source),
    upsertArtifactSql(projectId, artifact),
    replaceKnowledgeChunksSql(chunks, artifact.id),
    upsertKnowledgeNodesSql(knowledgeNodes),
    upsertKnowledgeEdgesSql(knowledgeEdges),
    replaceSlidesSql(slideDeck ?? null, slides ?? []),
    updateProcessingTaskSql(task.id, artifact.id, artifact.createdAt),
    "COMMIT;",
  ].filter(Boolean);

  await helpers.run(statements.join("\n"));
}

function upsertSourceSql(source: ProjectSourceRecord) {
  return `
INSERT INTO "ProjectSource" (
  "id", "projectId", "fileId", "kind", "title", "summary", "sourcePath", "metadata", "createdAt"
) VALUES (
  ${sqlText(source.id)},
  ${sqlText(source.projectId)},
  ${sqlText(source.fileId)},
  ${sqlText(source.kind)},
  ${sqlText(source.title)},
  ${sqlText(source.summary)},
  ${sqlText(source.sourcePath ?? null)},
  ${sqlJson(source.metadata)},
  ${sqlTimestamp(source.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "sourcePath" = EXCLUDED."sourcePath",
  "metadata" = EXCLUDED."metadata";`;
}

function upsertArtifactSql(projectId: string, artifact: ProcessingArtifact) {
  return `
INSERT INTO "Artifact" (
  "id", "projectId", "taskId", "fileId", "fileName", "kind", "title", "summary", "previewLines", "sourcePath", "createdAt"
) VALUES (
  ${sqlText(artifact.id)},
  ${sqlText(projectId)},
  ${sqlText(artifact.taskId)},
  ${sqlText(artifact.fileId)},
  ${sqlText(artifact.fileName)},
  ${sqlText(artifact.kind)},
  ${sqlText(artifact.title)},
  ${sqlText(artifact.summary)},
  ${sqlJson(artifact.previewLines)},
  ${sqlText(artifact.sourcePath ?? null)},
  ${sqlTimestamp(artifact.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "previewLines" = EXCLUDED."previewLines",
  "sourcePath" = EXCLUDED."sourcePath",
  "createdAt" = EXCLUDED."createdAt";`;
}

function replaceKnowledgeChunksSql(chunks: KnowledgeChunkRecord[], artifactId: string) {
  const deleteSql = `DELETE FROM "KnowledgeChunk" WHERE "artifactId" = ${sqlText(artifactId)};`;
  if (chunks.length === 0) return deleteSql;
  return `
${deleteSql}
INSERT INTO "KnowledgeChunk" (
  "id", "projectId", "artifactId", "fileId", "content", "source", "metadata",
  "embedding", "embeddingV2", "retrievalText", "fts", "sourceId", "chunkKind",
  "page", "slide", "sheet", "codePath", "lineStart", "lineEnd", "createdAt"
) VALUES
${chunks
  .map(
    (chunk) => `(
  ${sqlText(chunk.id)},
  ${sqlText(chunk.projectId)},
  ${sqlText(chunk.artifactId ?? null)},
  ${sqlText(chunk.fileId ?? null)},
  ${sqlText(chunk.content)},
  ${sqlText(chunk.source)},
  ${sqlJson(chunk.metadata)},
  ${sqlText(formatEmbeddingForPgvector(createTextEmbedding(chunk.content)))}::vector,
  ${sqlVectorV2(chunk)}::vector,
  ${sqlText(retrievalTextForChunk(chunk))},
  to_tsvector('simple', ${sqlText(retrievalTextForChunk(chunk))}),
  ${sqlText(chunk.retrieval?.sourceId ?? readStringMetadata(chunk.metadata, "sourceId"))},
  ${sqlText(chunk.retrieval?.chunkKind ?? inferChunkKind(chunk))},
  ${sqlNullableNumber(chunk.retrieval?.page ?? readNumberMetadata(chunk.metadata, "page"))},
  ${sqlNullableNumber(chunk.retrieval?.slide ?? readNumberMetadata(chunk.metadata, "slide"))},
  ${sqlText(chunk.retrieval?.sheet ?? readStringMetadata(chunk.metadata, "sheet"))},
  ${sqlText(chunk.retrieval?.codePath ?? readStringMetadata(chunk.metadata, "codePath"))},
  ${sqlNullableNumber(chunk.retrieval?.lineStart ?? readNumberMetadata(chunk.metadata, "lineStart"))},
  ${sqlNullableNumber(chunk.retrieval?.lineEnd ?? readNumberMetadata(chunk.metadata, "lineEnd"))},
  ${sqlTimestamp(chunk.createdAt)}
)`,
  )
  .join(",\n")};`;
}

function sqlVectorV2(chunk: KnowledgeChunkRecord) {
  const vector = chunk.retrieval?.embeddingV2;
  if (!vector?.length) return "NULL";
  return `${sqlText(formatEmbeddingForPgvector(vector))}`;
}

function retrievalTextForChunk(chunk: KnowledgeChunkRecord) {
  return chunk.retrieval?.retrievalText
    ?? [
      readStringMetadata(chunk.metadata, "fileName"),
      readStringMetadata(chunk.metadata, "artifactTitle"),
      readStringMetadata(chunk.metadata, "codePath"),
      chunk.source,
      chunk.content,
    ].filter(Boolean).join("\n");
}

function inferChunkKind(chunk: KnowledgeChunkRecord) {
  if (readStringMetadata(chunk.metadata, "codePath")) return "code";
  if (readStringMetadata(chunk.metadata, "sheet") || readStringMetadata(chunk.metadata, "cellRange")) return "table";
  if (readNumberMetadata(chunk.metadata, "slide") !== undefined) return "slide";
  return readStringMetadata(chunk.metadata, "kind") ?? "document";
}

function readStringMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumberMetadata(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" ? value : undefined;
}

function sqlNullableNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "NULL";
  return sqlNumber(value);
}

function upsertKnowledgeNodesSql(nodes: KnowledgeNodeRecord[]) {
  if (nodes.length === 0) return "";
  return `
INSERT INTO "KnowledgeNode" (
  "id", "projectId", "kind", "title", "summary", "tone", "sourceId", "metadata", "createdAt"
) VALUES
${nodes
  .map(
    (node) => `(
  ${sqlText(node.id)},
  ${sqlText(node.projectId)},
  ${sqlText(node.kind)},
  ${sqlText(node.title)},
  ${sqlText(node.summary)},
  ${sqlText(node.tone)},
  ${sqlText(node.sourceId ?? null)},
  ${sqlJson(node.metadata)},
  ${sqlTimestamp(node.createdAt)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "tone" = EXCLUDED."tone",
  "sourceId" = EXCLUDED."sourceId",
  "metadata" = EXCLUDED."metadata";`;
}

function upsertKnowledgeEdgesSql(edges: KnowledgeEdgeRecord[]) {
  if (edges.length === 0) return "";
  return `
INSERT INTO "KnowledgeEdge" (
  "id", "projectId", "fromNodeId", "toNodeId", "kind", "label", "createdAt"
) VALUES
${edges
  .map(
    (edge) => `(
  ${sqlText(edge.id)},
  ${sqlText(edge.projectId)},
  ${sqlText(edge.fromNodeId)},
  ${sqlText(edge.toNodeId)},
  ${sqlText(edge.kind)},
  ${sqlText(edge.label ?? null)},
  ${sqlTimestamp(edge.createdAt)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "fromNodeId" = EXCLUDED."fromNodeId",
  "toNodeId" = EXCLUDED."toNodeId",
  "kind" = EXCLUDED."kind",
  "label" = EXCLUDED."label";`;
}

function replaceSlidesSql(slideDeck: SlideDeckRecord | null, slides: SlideRecord[]) {
  if (!slideDeck) return "";

  return `
DELETE FROM "Slide" WHERE "fileId" = ${sqlText(slideDeck.fileId)};
DELETE FROM "SlideDeck" WHERE "fileId" = ${sqlText(slideDeck.fileId)};
INSERT INTO "SlideDeck" (
  "id", "projectId", "fileId", "title", "pageCount", "metadata", "createdAt"
) VALUES (
  ${sqlText(slideDeck.id)},
  ${sqlText(slideDeck.projectId)},
  ${sqlText(slideDeck.fileId)},
  ${sqlText(slideDeck.title)},
  ${sqlNumber(slideDeck.pageCount)},
  ${sqlJson(slideDeck.metadata)},
  ${sqlTimestamp(slideDeck.createdAt)}
);
${insertSlidesSql(slides)}`;
}

function insertSlidesSql(slides: SlideRecord[]) {
  if (slides.length === 0) return "";
  return `
INSERT INTO "Slide" (
  "id", "deckId", "projectId", "fileId", "page", "title", "extractedText",
  "imagePath", "thumbnailPath", "metadata", "createdAt"
) VALUES
${slides
  .map(
    (slide) => `(
  ${sqlText(slide.id)},
  ${sqlText(slide.deckId)},
  ${sqlText(slide.projectId)},
  ${sqlText(slide.fileId ?? null)},
  ${sqlNumber(slide.page)},
  ${sqlText(slide.title)},
  ${sqlText(slide.extractedText ?? null)},
  ${sqlText(slide.imagePath ?? null)},
  ${sqlText(slide.thumbnailPath ?? null)},
  ${sqlJson(slide.metadata)},
  ${sqlTimestamp(slide.createdAt)}
)`,
  )
  .join(",\n")};`;
}

function updateProcessingTaskSql(taskId: string, artifactId: string, completedAt: string) {
  return `
UPDATE "ProcessingTask"
SET
  "status" = 'completed',
  "progress" = ${sqlNumber(100)},
  "artifactId" = ${sqlText(artifactId)},
  "completedAt" = ${sqlTimestamp(completedAt)}
WHERE "id" = ${sqlText(taskId)};`;
}
