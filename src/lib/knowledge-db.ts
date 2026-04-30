import { execFile } from "node:child_process";
import { createNotebookRagClient, type NotebookRagClient } from "../../packages/ingest/src/notebook-rag-client.ts";
import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";
import { createTextEmbedding, formatEmbeddingForPgvector } from "./text-embedding.ts";

export type KnowledgePsqlRunner = (sql: string) => Promise<string>;

type RetrievalClient = Pick<NotebookRagClient, "prepareRetrievalChunks" | "retrieveChunks">;

export function createKnowledgeDatabase(
  runPsql: KnowledgePsqlRunner = runDockerComposePsql,
  retrievalClient: RetrievalClient | null = createNotebookRagClient(),
) {
  return {
    async readProjectKnowledgeChunks(projectId: string) {
      const output = (await runPsql(readProjectKnowledgeChunksSql(projectId))).trim();
      if (!output) return [];
      return JSON.parse(output) as KnowledgeChunkRecord[];
    },

    async retrieveRelevantKnowledgeChunks({
      projectId,
      query,
      limit = 6,
      fileId,
      sourceId,
      slideId,
    }: {
      projectId: string;
      query: string;
      limit?: number;
      fileId?: string;
      sourceId?: string;
      slideId?: string;
    }) {
      if (retrievalClient) {
        const response = await retrievalClient.retrieveChunks({
          projectId,
          query,
          limit,
          fileId,
          sourceId,
          slideId,
        });
        return response.chunks as KnowledgeChunkRecord[];
      }
      const output = (await runPsql(retrieveRelevantKnowledgeChunksSql(projectId, query, limit))).trim();
      if (!output) return [];
      return JSON.parse(output) as KnowledgeChunkRecord[];
    },

    async readFileKnowledgeChunks({
      projectId,
      fileId,
      limit = 24,
    }: {
      projectId: string;
      fileId: string;
      limit?: number;
    }) {
      const output = (await runPsql(readFileKnowledgeChunksSql(projectId, fileId, limit))).trim();
      if (!output) return [];
      return JSON.parse(output) as KnowledgeChunkRecord[];
    },

    async retrieveRelevantFileKnowledgeChunks({
      projectId,
      fileId,
      query,
      limit = 6,
    }: {
      projectId: string;
      fileId: string;
      query: string;
      limit?: number;
    }) {
      if (retrievalClient) {
        const response = await retrievalClient.retrieveChunks({
          projectId,
          fileId,
          query,
          limit,
        });
        return response.chunks as KnowledgeChunkRecord[];
      }
      const output = (await runPsql(retrieveRelevantFileKnowledgeChunksSql(projectId, fileId, query, limit))).trim();
      if (!output) return [];
      return JSON.parse(output) as KnowledgeChunkRecord[];
    },

    async prepareRetrievalChunks(chunks: KnowledgeChunkRecord[]) {
      if (!retrievalClient || chunks.length === 0) return chunks;

      const response = await retrievalClient.prepareRetrievalChunks({
        chunks: chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          source: chunk.source,
          metadata: chunk.metadata,
        })),
      });

      return response.chunks.map((chunk, index) => ({
        ...chunks[index],
        content: chunk.content,
        source: chunk.source,
        metadata: chunk.metadata ?? chunks[index]?.metadata ?? {},
        retrieval: chunk.retrieval,
      })) as KnowledgeChunkRecord[];
    },

    async replaceArtifactKnowledgeChunks(artifactId: string, chunks: KnowledgeChunkRecord[]) {
      await runPsql(replaceArtifactKnowledgeChunksSql(artifactId, chunks));
    },
  };
}

export async function readProjectKnowledgeChunks(projectId: string) {
  return createKnowledgeDatabase().readProjectKnowledgeChunks(projectId);
}

export async function retrieveRelevantKnowledgeChunks({
  projectId,
  query,
  limit,
  fileId,
  sourceId,
  slideId,
}: {
  projectId: string;
  query: string;
  limit?: number;
  fileId?: string;
  sourceId?: string;
  slideId?: string;
}) {
  return createKnowledgeDatabase().retrieveRelevantKnowledgeChunks({
    projectId,
    query,
    limit,
    fileId,
    sourceId,
    slideId,
  });
}

export async function readFileKnowledgeChunks({
  projectId,
  fileId,
  limit,
}: {
  projectId: string;
  fileId: string;
  limit?: number;
}) {
  return createKnowledgeDatabase().readFileKnowledgeChunks({
    projectId,
    fileId,
    limit,
  });
}

export async function retrieveRelevantFileKnowledgeChunks({
  projectId,
  fileId,
  query,
  limit,
}: {
  projectId: string;
  fileId: string;
  query: string;
  limit?: number;
}) {
  return createKnowledgeDatabase().retrieveRelevantFileKnowledgeChunks({
    projectId,
    fileId,
    query,
    limit,
  });
}

export async function replaceArtifactKnowledgeChunks(
  artifactId: string,
  chunks: KnowledgeChunkRecord[],
) {
  return createKnowledgeDatabase().replaceArtifactKnowledgeChunks(artifactId, chunks);
}

export async function prepareRetrievalChunks(chunks: KnowledgeChunkRecord[]) {
  return createKnowledgeDatabase().prepareRetrievalChunks(chunks);
}

function replaceArtifactKnowledgeChunksSql(
  artifactId: string,
  chunks: KnowledgeChunkRecord[],
) {
  const statements = [
    "BEGIN;",
    `DELETE FROM "KnowledgeChunk" WHERE "artifactId" = ${sqlText(artifactId)};`,
    insertKnowledgeChunksSql(chunks),
    "COMMIT;",
  ].filter(Boolean);

  return statements.join("\n");
}

function readProjectKnowledgeChunksSql(projectId: string) {
  return `
SELECT COALESCE(
  json_agg(
    json_build_object(
      'id', "id",
      'projectId', "projectId",
      'artifactId', "artifactId",
      'fileId', "fileId",
      'content', "content",
      'source', "source",
      'metadata', "metadata",
      'createdAt', to_json("createdAt")
    )
    ORDER BY "source", ("metadata"->>'lineStart')::int, "createdAt"
  ),
  '[]'::json
)::text
FROM "KnowledgeChunk"
WHERE "projectId" = ${sqlText(projectId)};
`;
}

function readFileKnowledgeChunksSql(projectId: string, fileId: string, limit: number) {
  return `
SELECT COALESCE(
  json_agg(
    json_build_object(
      'id', "id",
      'projectId', "projectId",
      'artifactId', "artifactId",
      'fileId', "fileId",
      'content', "content",
      'source', "source",
      'metadata', "metadata",
      'createdAt', to_json("createdAt")
    )
    ORDER BY ("metadata"->>'lineStart')::int, "createdAt"
  ),
  '[]'::json
)::text
FROM (
  SELECT *
  FROM "KnowledgeChunk"
  WHERE "projectId" = ${sqlText(projectId)}
    AND "fileId" = ${sqlText(fileId)}
  ORDER BY ("metadata"->>'lineStart')::int, "createdAt"
  LIMIT ${sqlNumber(limit)}
) scoped_chunks;
`;
}

function retrieveRelevantKnowledgeChunksSql(projectId: string, query: string, limit: number) {
  const queryVector = formatEmbeddingForPgvector(createTextEmbedding(query));
  return `
SELECT COALESCE(
  json_agg(
    json_build_object(
      'id', "id",
      'projectId', "projectId",
      'artifactId', "artifactId",
      'fileId', "fileId",
      'content', "content",
      'source', "source",
      'metadata', "metadata",
      'createdAt', to_json("createdAt")
    )
    ORDER BY distance
  ),
  '[]'::json
)::text
FROM (
  SELECT *, "embedding" <=> ${sqlVector(queryVector)}::vector AS distance
  FROM "KnowledgeChunk"
  WHERE "projectId" = ${sqlText(projectId)}
    AND "embedding" IS NOT NULL
  ORDER BY "embedding" <=> ${sqlVector(queryVector)}::vector
  LIMIT ${sqlNumber(limit)}
) ranked_chunks;
`;
}

function retrieveRelevantFileKnowledgeChunksSql(projectId: string, fileId: string, query: string, limit: number) {
  const queryVector = formatEmbeddingForPgvector(createTextEmbedding(query));
  return `
SELECT COALESCE(
  json_agg(
    json_build_object(
      'id', "id",
      'projectId', "projectId",
      'artifactId', "artifactId",
      'fileId', "fileId",
      'content', "content",
      'source', "source",
      'metadata', "metadata",
      'createdAt', to_json("createdAt")
    )
    ORDER BY distance
  ),
  '[]'::json
)::text
FROM (
  SELECT *, "embedding" <=> ${sqlVector(queryVector)}::vector AS distance
  FROM "KnowledgeChunk"
  WHERE "projectId" = ${sqlText(projectId)}
    AND "fileId" = ${sqlText(fileId)}
    AND "embedding" IS NOT NULL
  ORDER BY "embedding" <=> ${sqlVector(queryVector)}::vector
  LIMIT ${sqlNumber(limit)}
) ranked_chunks;
`;
}

function insertKnowledgeChunksSql(chunks: KnowledgeChunkRecord[]) {
  if (chunks.length === 0) return "";

  return `
INSERT INTO "KnowledgeChunk" (
  "id", "projectId", "artifactId", "fileId", "content", "source", "metadata",
  "embedding", "embeddingV2", "retrievalText", "fts", "sourceId", "chunkKind",
  "page", "slide", "sheet", "codePath", "lineStart", "lineEnd", "createdAt"
) VALUES
${chunks
  .map((chunk) => {
    const embedding = formatEmbeddingForPgvector(createTextEmbedding(chunk.content));
    const embeddingV2 = chunk.retrieval?.embeddingV2?.length
      ? formatEmbeddingForPgvector(chunk.retrieval.embeddingV2)
      : null;
    const retrievalText = chunk.retrieval?.retrievalText
      ?? [
        readStringMetadata(chunk.metadata, "fileName"),
        readStringMetadata(chunk.metadata, "artifactTitle"),
        readStringMetadata(chunk.metadata, "codePath"),
        chunk.source,
        chunk.content,
      ].filter(Boolean).join("\n");
    return `(
  ${sqlText(chunk.id)},
  ${sqlText(chunk.projectId)},
  ${sqlText(chunk.artifactId)},
  ${sqlText(chunk.fileId)},
  ${sqlText(chunk.content)},
  ${sqlText(chunk.source)},
  ${sqlJson(chunk.metadata)},
  ${sqlVector(embedding)}::vector,
  ${embeddingV2 ? `${sqlVector(embeddingV2)}::vector` : "NULL"},
  ${sqlText(retrievalText)},
  to_tsvector('simple', ${sqlText(retrievalText)}),
  ${sqlText(chunk.retrieval?.sourceId ?? readStringMetadata(chunk.metadata, "sourceId"))},
  ${sqlText(chunk.retrieval?.chunkKind ?? inferChunkKind(chunk))},
  ${sqlNullableNumber(chunk.retrieval?.page ?? readNumberMetadata(chunk.metadata, "page"))},
  ${sqlNullableNumber(chunk.retrieval?.slide ?? readNumberMetadata(chunk.metadata, "slide"))},
  ${sqlText(chunk.retrieval?.sheet ?? readStringMetadata(chunk.metadata, "sheet"))},
  ${sqlText(chunk.retrieval?.codePath ?? readStringMetadata(chunk.metadata, "codePath"))},
  ${sqlNullableNumber(chunk.retrieval?.lineStart ?? readNumberMetadata(chunk.metadata, "lineStart"))},
  ${sqlNullableNumber(chunk.retrieval?.lineEnd ?? readNumberMetadata(chunk.metadata, "lineEnd"))},
  ${sqlTimestamp(chunk.createdAt)}
)`;
  })
  .join(",\n")};`;
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

function sqlText(value: string | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlTimestamp(value: string | null | undefined) {
  if (!value) return "NULL";
  return `${sqlText(value)}::timestamptz`;
}

function sqlJson(value: unknown) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function sqlVector(value: string) {
  return sqlText(value);
}

function sqlNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.max(1, Math.trunc(value)));
}

function sqlNullableNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "NULL";
  return String(Math.trunc(value));
}

async function runDockerComposePsql(sql: string) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "defense",
        "-d",
        "defense_coach",
        "-tA",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}
