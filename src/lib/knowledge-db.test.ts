import assert from "node:assert/strict";
import { test } from "node:test";
import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";
import { createKnowledgeDatabase } from "./knowledge-db.ts";

const chunks: KnowledgeChunkRecord[] = [
  {
    id: "chunk-artifact-readme-1",
    projectId: "project-defense",
    artifactId: "artifact-readme",
    fileId: "file-readme",
    content: "项目背景：解决食堂高峰期排队问题。",
    source: "README.md · document",
    metadata: {
      fileName: "README.md",
      kind: "document",
      artifactTitle: "README.md 解析结果",
      lineStart: 1,
      lineEnd: 1,
      sourcePath: ".data/uploads/2026-04-25/readme.md",
    },
    createdAt: "2026-04-25T06:04:00.000Z",
  },
];

test("writes knowledge chunks by replacing chunks for the same artifact", async () => {
  const calls: string[] = [];
  const database = createKnowledgeDatabase(async (sql) => {
    calls.push(sql);
    return "";
  });

  await database.replaceArtifactKnowledgeChunks("artifact-readme", chunks);

  assert.equal(calls.length, 1);
  assert.match(calls[0], /BEGIN;/);
  assert.match(calls[0], /DELETE FROM "KnowledgeChunk" WHERE "artifactId" = 'artifact-readme';/);
  assert.match(calls[0], /INSERT INTO "KnowledgeChunk"/);
  assert.match(calls[0], /"embedding"/);
  assert.match(calls[0], /::vector/);
  assert.match(calls[0], /README\.md · document/);
  assert.match(calls[0], /"lineStart":1/);
  assert.match(calls[0], /COMMIT;/);
});

test("only deletes old chunks when new chunk list is empty", async () => {
  let sql = "";
  const database = createKnowledgeDatabase(async (query) => {
    sql = query;
    return "";
  });

  await database.replaceArtifactKnowledgeChunks("artifact-readme", []);

  assert.match(sql, /DELETE FROM "KnowledgeChunk" WHERE "artifactId" = 'artifact-readme';/);
  assert.doesNotMatch(sql, /INSERT INTO "KnowledgeChunk"/);
});

test("reads project knowledge chunks ordered by source and line", async () => {
  const database = createKnowledgeDatabase(async () => JSON.stringify(chunks));

  const storedChunks = await database.readProjectKnowledgeChunks("project-defense");

  assert.deepEqual(storedChunks, chunks);
});

test("returns no project knowledge chunks when database query is empty", async () => {
  const database = createKnowledgeDatabase(async () => "");

  const storedChunks = await database.readProjectKnowledgeChunks("project-defense");

  assert.deepEqual(storedChunks, []);
});

test("retrieves relevant project chunks with pgvector distance", async () => {
  let sql = "";
  const database = createKnowledgeDatabase(async (query) => {
    sql = query;
    return JSON.stringify(chunks);
  });

  const results = await database.retrieveRelevantKnowledgeChunks({
    projectId: "project-defense",
    query: "订单状态如何设计",
    limit: 3,
  });

  assert.deepEqual(results, chunks);
  assert.match(sql, /ORDER BY "embedding" <=> '\[/);
  assert.match(sql, /::vector/);
  assert.match(sql, /LIMIT 3/);
});

test("reads file knowledge chunks scoped by file id", async () => {
  let sql = "";
  const database = createKnowledgeDatabase(async (query) => {
    sql = query;
    return JSON.stringify(chunks);
  });

  const results = await database.readFileKnowledgeChunks({
    projectId: "project-defense",
    fileId: "file-readme",
    limit: 5,
  });

  assert.deepEqual(results, chunks);
  assert.match(sql, /WHERE "projectId" = 'project-defense'/);
  assert.match(sql, /AND "fileId" = 'file-readme'/);
  assert.match(sql, /LIMIT 5/);
});

test("retrieves relevant file chunks with pgvector distance and file scope", async () => {
  let sql = "";
  const database = createKnowledgeDatabase(async (query) => {
    sql = query;
    return JSON.stringify(chunks);
  });

  const results = await database.retrieveRelevantFileKnowledgeChunks({
    projectId: "project-defense",
    fileId: "file-readme",
    query: "食堂排队优化怎么做",
    limit: 4,
  });

  assert.deepEqual(results, chunks);
  assert.match(sql, /WHERE "projectId" = 'project-defense'/);
  assert.match(sql, /AND "fileId" = 'file-readme'/);
  assert.match(sql, /ORDER BY "embedding" <=> '\[/);
  assert.match(sql, /LIMIT 4/);
});

test("retrieves relevant project chunks through the notebook rag sidecar when configured", async () => {
  const database = createKnowledgeDatabase(
    async () => {
      throw new Error("should not hit psql retrieval path");
    },
    {
      retrieveChunks: async (payload: unknown) => {
        const typedPayload = payload as { projectId: string; query: string; limit?: number };
        assert.equal(typedPayload.projectId, "project-defense");
        assert.equal(typedPayload.query, "排队问题");
        assert.equal(typedPayload.limit, 5);
        return {
          chunks,
          mode: "hybrid",
          trace: {
            vectorCandidateCount: 6,
            lexicalCandidateCount: 4,
            reranked: true,
          },
        };
      },
    } as never,
  );

  const results = await database.retrieveRelevantKnowledgeChunks({
    projectId: "project-defense",
    query: "排队问题",
    limit: 5,
  });

  assert.deepEqual(results, chunks);
});

test("retrieves relevant file chunks through the notebook rag sidecar with file scope", async () => {
  const database = createKnowledgeDatabase(
    async () => {
      throw new Error("should not hit psql retrieval path");
    },
    {
      retrieveChunks: async (payload: unknown) => {
        const typedPayload = payload as { fileId?: string };
        assert.equal(typedPayload.fileId, "file-readme");
        return {
          chunks,
          mode: "hybrid",
          trace: {
            filters: { fileId: "file-readme" },
          },
        };
      },
    } as never,
  );

  const results = await database.retrieveRelevantFileKnowledgeChunks({
    projectId: "project-defense",
    fileId: "file-readme",
    query: "食堂排队优化怎么做",
    limit: 4,
  });

  assert.deepEqual(results, chunks);
});

test("falls back to pgvector project retrieval when notebook rag sidecar fails", async () => {
  let sql = "";
  const database = createKnowledgeDatabase(
    async (query) => {
      sql = query;
      return JSON.stringify(chunks);
    },
    {
      retrieveChunks: async () => {
        throw new Error("Notebook RAG sidecar /retrieve-chunks failed: 500 Internal Server Error");
      },
    } as never,
  );

  const results = await database.retrieveRelevantKnowledgeChunks({
    projectId: "project-defense",
    query: "排队问题",
    limit: 3,
  });

  assert.deepEqual(results, chunks);
  assert.match(sql, /WHERE "projectId" = 'project-defense'/);
  assert.match(sql, /ORDER BY "embedding" <=> '\[/);
});

test("falls back to pgvector file retrieval when notebook rag sidecar fails", async () => {
  let sql = "";
  const database = createKnowledgeDatabase(
    async (query) => {
      sql = query;
      return JSON.stringify(chunks);
    },
    {
      retrieveChunks: async () => {
        throw new Error("Notebook RAG sidecar /retrieve-chunks failed: 500 Internal Server Error");
      },
    } as never,
  );

  const results = await database.retrieveRelevantFileKnowledgeChunks({
    projectId: "project-defense",
    fileId: "file-readme",
    query: "食堂排队优化怎么做",
    limit: 4,
  });

  assert.deepEqual(results, chunks);
  assert.match(sql, /AND "fileId" = 'file-readme'/);
  assert.match(sql, /ORDER BY "embedding" <=> '\[/);
});

test("prepares retrieval chunks through the notebook rag sidecar and merges retrieval metadata", async () => {
  const database = createKnowledgeDatabase(
    async () => "",
    {
      prepareRetrievalChunks: async () => ({
        chunks: [
          {
            id: "chunk-artifact-readme-1",
            content: "项目背景：解决食堂高峰期排队问题。",
            source: "README.md · document",
            metadata: chunks[0]?.metadata ?? {},
            retrieval: {
              embeddingV2: [0.1, 0.2, 0.3],
              sourceId: "source-file-1",
              chunkKind: "document",
              retrievalText: "README.md 项目背景：解决食堂高峰期排队问题。",
              lineStart: 1,
              lineEnd: 1,
            },
          },
        ],
      }),
      retrieveChunks: async () => ({
        chunks: [],
        mode: "fallback",
      }),
    } as never,
  );

  const prepared = await database.prepareRetrievalChunks(chunks);

  assert.deepEqual(prepared[0]?.retrieval?.embeddingV2, [0.1, 0.2, 0.3]);
  assert.equal(prepared[0]?.retrieval?.sourceId, "source-file-1");
});
