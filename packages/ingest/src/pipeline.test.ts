import assert from "node:assert/strict";
import test from "node:test";
import { ingestLocalFile, mergeAiKnowledgeGraph } from "./pipeline.ts";

test("ingestLocalFile stamps source-aware retrieval metadata on parsed chunks", () => {
  const result = ingestLocalFile({
    projectId: "project-defense",
    file: {
      id: "file-1",
      name: "README.md",
      size: 128,
      type: "text/markdown",
      kind: "document",
      status: "ready",
      source: "upload",
      addedAt: "2026-04-29T10:00:00.000Z",
      storagePath: ".data/uploads/readme.md",
    },
    task: {
      id: "task-1",
      fileId: "file-1",
      fileName: "README.md",
      kind: "document",
      title: "README 解析",
      engine: "notebook-rag",
      status: "pending",
      progress: 0,
      createdAt: "2026-04-29T10:00:00.000Z",
    },
    content: "项目目标是减少排队时间。",
    parsed: {
      source: {
        title: "README",
        summary: "项目说明",
        fileKind: "document",
      },
      chunks: [
        {
          id: "chunk-1",
          content: "项目目标是减少排队时间。",
          source: "README.md · document",
          metadata: {
            lineStart: 1,
            lineEnd: 1,
          },
        },
      ],
      preview: {
        text: "项目目标是减少排队时间。",
        outline: ["项目目标是减少排队时间。"],
      },
    },
    createdAt: "2026-04-29T10:00:00.000Z",
  });

  assert.equal(result.chunks[0]?.metadata.sourceId, "source-file-1");
  assert.equal(result.chunks[0]?.metadata.chunkKind, "document");
});

test("mergeAiKnowledgeGraph normalizes model output into sourced stable nodes", () => {
  const starter = createTestIngestResult();
  const graph = mergeAiKnowledgeGraph({
    projectId: "project-defense",
    source: starter.source,
    file: testFile,
    starterNodes: starter.knowledgeNodes,
    starterEdges: starter.knowledgeEdges,
    createdAt: "2026-04-29T10:00:00.000Z",
    output: {
      projectSummary: "订单系统包含创建订单、订单表和答辩风险。",
      modules: [{ title: "订单中心", summary: "负责订单状态流转。", citations: [{ fileId: "file-1" }] }],
      apis: [{ title: "POST /api/orders", summary: "创建订单接口。", citations: [{ fileId: "file-1", lineStart: 3 }] }],
      tables: [{ title: "orders", summary: "订单主表。", citations: [{ fileId: "file-1" }] }],
      risks: [{ title: "并发下单如何防重", summary: "需要解释幂等键。", riskLevel: "high", citations: [{ fileId: "file-1" }] }],
      weaknesses: [{ title: "表关系解释不清", summary: "需要讲清 orders 与 order_items。", citations: [{ fileId: "file-1" }] }],
      trainingPaths: [{ title: "订单链路讲练", summary: "练习订单链路追问。", citations: [{ fileId: "file-1" }] }],
      citations: [{ fileName: "README.md", fileId: "file-1", lineStart: 1, lineEnd: 4 }],
    },
  });

  const nodeIds = new Set(graph.knowledgeNodes.map((node) => node.id));
  assert.equal(nodeIds.size, graph.knowledgeNodes.length);
  assert.ok(graph.knowledgeEdges.every((edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)));
  assert.ok(graph.knowledgeNodes.some((node) => node.kind === "module" && node.metadata.semanticType === "api"));
  assert.ok(graph.knowledgeNodes.some((node) => node.kind === "risk" && node.metadata.riskLevel === "high"));
  assert.ok(graph.knowledgeNodes.some((node) => node.kind === "training" && node.title === "订单链路讲练"));
  assert.ok(graph.knowledgeNodes.every((node) => !node.metadata.aiGenerated || node.sourceId || node.metadata.fileId || node.metadata.citations));
});

test("mergeAiKnowledgeGraph keeps ids stable and removes duplicate ai nodes", () => {
  const starter = createTestIngestResult();
  const output = {
    projectSummary: "订单系统。",
    modules: [
      { title: "订单中心", summary: "负责订单状态流转。", citations: [{ fileId: "file-1" }] },
      { title: "订单中心", summary: "重复输出应合并。", citations: [{ fileId: "file-1" }] },
    ],
    apis: [],
    tables: [],
    risks: [],
    weaknesses: [],
    trainingPaths: [],
    citations: [{ fileName: "README.md", fileId: "file-1" }],
  };

  const first = mergeAiKnowledgeGraph({
    projectId: "project-defense",
    source: starter.source,
    file: testFile,
    starterNodes: starter.knowledgeNodes,
    starterEdges: starter.knowledgeEdges,
    createdAt: "2026-04-29T10:00:00.000Z",
    output,
  });
  const second = mergeAiKnowledgeGraph({
    projectId: "project-defense",
    source: starter.source,
    file: testFile,
    starterNodes: starter.knowledgeNodes,
    starterEdges: starter.knowledgeEdges,
    createdAt: "2026-04-29T10:00:00.000Z",
    output,
  });

  assert.deepEqual(first.knowledgeNodes.map((node) => node.id), second.knowledgeNodes.map((node) => node.id));
  assert.equal(first.knowledgeNodes.filter((node) => node.title === "订单中心").length, 1);
});

test("mergeAiKnowledgeGraph drops unsourced model nodes and dangling edges", () => {
  const starter = createTestIngestResult();
  const graph = mergeAiKnowledgeGraph({
    projectId: "project-defense",
    source: starter.source,
    file: testFile,
    starterNodes: starter.knowledgeNodes,
    starterEdges: starter.knowledgeEdges,
    createdAt: "2026-04-29T10:00:00.000Z",
    output: {
      projectSummary: "订单系统。",
      modules: [{ title: "无来源模块", summary: "模型没有给证据。" }],
      apis: [],
      tables: [],
      risks: [{ title: "无来源风险", summary: "也没有证据。" }],
      weaknesses: [],
      trainingPaths: [{ title: "无来源训练", summary: "缺少 citation。" }],
      citations: [],
    },
  });

  const nodeIds = new Set(graph.knowledgeNodes.map((node) => node.id));
  assert.ok(!graph.knowledgeNodes.some((node) => node.title === "无来源模块"));
  assert.ok(!graph.knowledgeNodes.some((node) => node.title === "无来源风险"));
  assert.ok(!graph.knowledgeNodes.some((node) => node.title === "无来源训练"));
  assert.ok(graph.knowledgeEdges.every((edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)));
});

const testFile = {
  id: "file-1",
  name: "README.md",
  size: 128,
  type: "text/markdown",
  kind: "document" as const,
  status: "ready",
  source: "upload",
  addedAt: "2026-04-29T10:00:00.000Z",
  storagePath: ".data/uploads/readme.md",
};

function createTestIngestResult() {
  return ingestLocalFile({
    projectId: "project-defense",
    file: testFile,
    task: {
      id: "task-1",
      fileId: "file-1",
      fileName: "README.md",
      kind: "document",
      title: "README 解析",
      engine: "notebook-rag",
      status: "pending",
      progress: 0,
      createdAt: "2026-04-29T10:00:00.000Z",
    },
    content: "项目目标是减少排队时间。订单需要防重复提交。",
    parsed: {
      source: {
        title: "README",
        summary: "项目说明",
        fileKind: "document",
      },
      chunks: [
        {
          id: "chunk-1",
          content: "项目目标是减少排队时间。订单需要防重复提交。",
          source: "README.md · document",
          metadata: {
            lineStart: 1,
            lineEnd: 1,
          },
        },
      ],
      preview: {
        text: "项目目标是减少排队时间。",
        outline: ["项目目标是减少排队时间。"],
      },
    },
    createdAt: "2026-04-29T10:00:00.000Z",
  });
}
