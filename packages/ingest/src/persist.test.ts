import assert from "node:assert/strict";
import test from "node:test";
import { persistIngestedFile } from "./persist.ts";

test("persists retrieval v2 columns for knowledge chunks", async () => {
  let executedSql = "";

  await persistIngestedFile({
    projectId: "project-defense",
    task: {
      id: "task-1",
      fileId: "file-1",
      fileName: "README.md",
      kind: "document",
      title: "README 解析",
      engine: "notebook-rag",
      status: "processing",
      progress: 25,
      createdAt: "2026-04-29T10:00:00.000Z",
    },
    source: {
      id: "source-file-1",
      projectId: "project-defense",
      fileId: "file-1",
      kind: "document",
      title: "README 来源",
      summary: "项目说明",
      sourcePath: ".data/uploads/readme.md",
      metadata: {},
      createdAt: "2026-04-29T10:00:00.000Z",
    },
    artifact: {
      id: "artifact-1",
      taskId: "task-1",
      fileId: "file-1",
      fileName: "README.md",
      kind: "document",
      title: "README 解析",
      summary: "项目说明",
      previewLines: ["项目目标"],
      sourcePath: ".data/uploads/readme.md",
      createdAt: "2026-04-29T10:00:00.000Z",
    },
    chunks: [
      {
        id: "chunk-1",
        projectId: "project-defense",
        artifactId: "artifact-1",
        fileId: "file-1",
        content: "项目目标是减少排队时间。",
        source: "README.md · document",
        metadata: {
          fileName: "README.md",
          kind: "document",
          artifactTitle: "README 解析",
          sourceId: "source-file-1",
          lineStart: 1,
          lineEnd: 1,
        },
        retrieval: {
          embeddingV2: [0.1, 0.2, 0.3],
          sourceId: "source-file-1",
          chunkKind: "document",
          lineStart: 1,
          lineEnd: 1,
          retrievalText: "README.md 项目目标是减少排队时间。",
        },
        createdAt: "2026-04-29T10:00:00.000Z",
      },
    ],
    knowledgeNodes: [],
    knowledgeEdges: [],
    runSql: async (sql) => {
      executedSql = sql;
      return "";
    },
  });

  assert.match(executedSql, /"embeddingV2"/);
  assert.match(executedSql, /"fts"/);
  assert.match(executedSql, /"sourceId"/);
  assert.match(executedSql, /to_tsvector/);
  assert.match(executedSql, /source-file-1/);
});
