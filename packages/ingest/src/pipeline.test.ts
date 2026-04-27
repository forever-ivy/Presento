import assert from "node:assert/strict";
import test from "node:test";
import { ingestLocalFile } from "./pipeline.ts";

test("ingests a local document file into source, artifact, chunks, and a starter knowledge map", () => {
  const result = ingestLocalFile({
    projectId: "project-1",
    file: {
      id: "file-1",
      name: "README.md",
      kind: "document",
      status: "uploaded",
      source: "本地上传",
      size: 256,
      type: "text/markdown",
      addedAt: "2026-04-27T10:00:00.000Z",
      storagePath: ".data/uploads/2026-04-27/readme.md",
    },
    task: {
      id: "job-1",
      fileId: "file-1",
      fileName: "README.md",
      kind: "document",
      title: "README 解析",
      engine: "local-ingest",
      status: "processing",
      progress: 30,
      createdAt: "2026-04-27T10:00:00.000Z",
    },
    content: [
      "# 项目背景",
      "智能点餐系统服务于校园食堂点餐与后厨协同。",
      "## 技术路线",
      "Next.js + PostgreSQL + AI 追问。",
      "## 个人负责",
      "我负责后端订单接口与状态流转。",
    ].join("\n"),
    createdAt: "2026-04-27T10:05:00.000Z",
  });

  assert.equal(result.source.fileId, "file-1");
  assert.equal(result.artifact.fileId, "file-1");
  assert.ok(result.chunks.length >= 1);
  assert.ok(result.knowledgeNodes.some((node) => node.kind === "project"));
  assert.ok(result.knowledgeNodes.some((node) => node.kind === "source"));
  assert.ok(result.knowledgeNodes.some((node) => node.kind === "module"));
  assert.ok(result.knowledgeEdges.length >= 2);
});
