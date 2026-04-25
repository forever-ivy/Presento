import { execFile } from "node:child_process";
import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";

export type KnowledgePsqlRunner = (sql: string) => Promise<string>;

export function createKnowledgeDatabase(runPsql: KnowledgePsqlRunner = runDockerComposePsql) {
  return {
    async readProjectKnowledgeChunks(projectId: string) {
      const output = (await runPsql(readProjectKnowledgeChunksSql(projectId))).trim();
      if (!output) return [];
      return JSON.parse(output) as KnowledgeChunkRecord[];
    },

    async replaceArtifactKnowledgeChunks(artifactId: string, chunks: KnowledgeChunkRecord[]) {
      await runPsql(replaceArtifactKnowledgeChunksSql(artifactId, chunks));
    },
  };
}

export async function readProjectKnowledgeChunks(projectId: string) {
  return createKnowledgeDatabase().readProjectKnowledgeChunks(projectId);
}

export async function replaceArtifactKnowledgeChunks(
  artifactId: string,
  chunks: KnowledgeChunkRecord[],
) {
  return createKnowledgeDatabase().replaceArtifactKnowledgeChunks(artifactId, chunks);
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

function insertKnowledgeChunksSql(chunks: KnowledgeChunkRecord[]) {
  if (chunks.length === 0) return "";

  return `
INSERT INTO "KnowledgeChunk" (
  "id", "projectId", "artifactId", "fileId", "content", "source", "metadata", "createdAt"
) VALUES
${chunks
  .map(
    (chunk) => `(
  ${sqlText(chunk.id)},
  ${sqlText(chunk.projectId)},
  ${sqlText(chunk.artifactId)},
  ${sqlText(chunk.fileId)},
  ${sqlText(chunk.content)},
  ${sqlText(chunk.source)},
  ${sqlJson(chunk.metadata)},
  ${sqlTimestamp(chunk.createdAt)}
)`,
  )
  .join(",\n")};`;
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
