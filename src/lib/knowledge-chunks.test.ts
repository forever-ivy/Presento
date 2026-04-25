import assert from "node:assert/strict";
import { test } from "node:test";
import type { DefenseProcessingArtifact } from "./project-workspace.ts";
import { createKnowledgeChunks } from "./knowledge-chunks.ts";

const artifact: DefenseProcessingArtifact = {
  id: "artifact-readme",
  taskId: "task-readme",
  fileId: "file-readme",
  fileName: "README.md",
  kind: "document",
  title: "README.md 解析结果",
  summary: "抽取 4 行文本，预计切分 1 个知识片段。",
  previewLines: ["项目背景", "技术路线"],
  sourcePath: ".data/uploads/2026-04-25/readme.md",
  createdAt: "2026-04-25T06:03:00.000Z",
};

test("creates cited knowledge chunks from parsed artifact content", () => {
  const chunks = createKnowledgeChunks({
    projectId: "project-defense",
    artifact,
    content: [
      "# 智能点餐系统",
      "",
      "项目背景：解决食堂高峰期排队问题。",
      "技术路线：Next.js + PostgreSQL。",
      "数据库设计：orders 表记录订单状态。",
    ].join("\n"),
    createdAt: "2026-04-25T06:04:00.000Z",
  });

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].id, "chunk-artifact-readme-1");
  assert.equal(chunks[0].projectId, "project-defense");
  assert.equal(chunks[0].artifactId, "artifact-readme");
  assert.equal(chunks[0].fileId, "file-readme");
  assert.equal(chunks[0].source, "README.md · document");
  assert.equal(chunks[0].metadata.fileName, "README.md");
  assert.equal(chunks[0].metadata.kind, "document");
  assert.equal(chunks[0].metadata.lineStart, 1);
  assert.equal(chunks[0].metadata.lineEnd, 4);
  assert.match(chunks[0].content, /数据库设计/);
});

test("splits long content without breaking empty lines into chunks", () => {
  const chunks = createKnowledgeChunks({
    projectId: "project-defense",
    artifact,
    content: ["第一部分".repeat(80), "", "第二部分".repeat(80), "第三部分".repeat(80)].join(
      "\n",
    ),
    maxCharacters: 220,
    createdAt: "2026-04-25T06:04:00.000Z",
  });

  assert.equal(chunks.length, 3);
  assert.deepEqual(
    chunks.map((chunk) => chunk.id),
    ["chunk-artifact-readme-1", "chunk-artifact-readme-2", "chunk-artifact-readme-3"],
  );
  assert.equal(chunks[1].metadata.lineStart, 2);
  assert.equal(chunks[2].metadata.lineStart, 3);
});

test("returns no chunks for empty parsed content", () => {
  const chunks = createKnowledgeChunks({
    projectId: "project-defense",
    artifact,
    content: " \n \n",
  });

  assert.equal(chunks.length, 0);
});
