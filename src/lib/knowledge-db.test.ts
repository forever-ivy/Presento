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
