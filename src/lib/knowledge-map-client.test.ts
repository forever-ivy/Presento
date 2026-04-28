import assert from "node:assert/strict";
import test from "node:test";

import {
  appendMockFileExplanationTurn,
  getKnowledgeNodeActivation,
  loadKnowledgeMap,
  normalizeKnowledgeMapPayload,
} from "./knowledge-map-client.ts";
import type { FileExplanationSessionWithTurns, KnowledgeEdgeRecord, KnowledgeNodeRecord } from "../../packages/shared/src/domain.ts";

const apiNode: KnowledgeNodeRecord = {
  id: "node-readme",
  projectId: "demo",
  kind: "file",
  title: "README.md",
  summary: "项目说明文档",
  tone: "cyan",
  sourceId: "source-readme",
  metadata: {
    fileId: "file-readme",
    fileKind: "docx",
    riskLevel: "medium",
    preview: {
      outline: ["项目背景", "技术路线"],
      text: "README 提供项目目标、技术路线和分工说明。",
    },
  },
  createdAt: "2026-04-26T00:00:00.000Z",
};

const apiEdge: KnowledgeEdgeRecord = {
  id: "edge-project-readme",
  projectId: "demo",
  fromNodeId: "project",
  toNodeId: "node-readme",
  kind: "evidence",
  label: "说明",
  createdAt: "2026-04-26T00:00:00.000Z",
};

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    },
  } as Response;
}

test("normalizes API knowledge map payload into UI nodes and edges", () => {
  const map = normalizeKnowledgeMapPayload("demo", {
    nodes: [apiNode],
    edges: [apiEdge],
  });

  assert.equal(map.source, "api");
  assert.equal(map.nodes.length, 1);
  assert.equal(map.nodes[0].id, "node-readme");
  assert.equal(map.nodes[0].kind, "file");
  assert.equal(map.nodes[0].fileKind, "docx");
  assert.equal(map.nodes[0].riskLevel, "medium");
  assert.equal(map.nodes[0].viewer, "docx");
  assert.deepEqual(map.nodes[0].evidence, ["README.md", "source-readme"]);
  assert.equal(map.edges[0].fromNodeId, "project");
  assert.equal(map.edges[0].kind, "evidence");
});

test("loadKnowledgeMap falls back to mock data for empty API results", async () => {
  const map = await loadKnowledgeMap("demo", async () => jsonResponse({ nodes: [], edges: [] }));

  assert.equal(map.source, "mock");
  assert.ok(map.nodes.some((node) => node.kind === "file" && node.fileKind === "pdf"));
  assert.ok(map.nodes.some((node) => node.kind === "file" && node.fileKind === "ppt"));
  assert.ok(map.edges.length > 0);
});

test("loadKnowledgeMap falls back to mock data when fetch fails", async () => {
  const map = await loadKnowledgeMap("demo", async () => {
    throw new Error("database is not ready");
  });

  assert.equal(map.source, "mock");
  assert.ok(map.nodes.find((node) => node.id === "project"));
});

test("classifies file node activation between reader, slide scripts, and detail panel", () => {
  assert.equal(
    getKnowledgeNodeActivation({ kind: "file", fileKind: "ppt" }),
    "scripts",
  );
  assert.equal(
    getKnowledgeNodeActivation({ kind: "file", fileKind: "presentation-pdf" }),
    "scripts",
  );
  assert.equal(
    getKnowledgeNodeActivation({ kind: "file", fileKind: "xlsx" }),
    "reader",
  );
  assert.equal(getKnowledgeNodeActivation({ kind: "module" }), "details");
});

test("appendMockFileExplanationTurn adds cited user and assistant turns", () => {
  const session = appendMockFileExplanationTurn(
    {
      id: "session-readme",
      projectId: "demo",
      nodeId: "node-readme",
      fileId: "file-readme",
      mode: "quick",
      status: "ready",
      summary: "README 说明项目目标。",
      outline: ["项目背景"],
      citations: [{ fileName: "README.md", page: 1 }],
      metadata: {
        followUps: ["老师会追问什么？"],
      },
      createdAt: "2026-04-26T00:00:00.000Z",
      updatedAt: "2026-04-26T00:00:00.000Z",
      turns: [],
    } satisfies FileExplanationSessionWithTurns,
    "老师最可能问什么？",
  );

  assert.equal(session.turns.length, 2);
  assert.equal(session.turns[0].role, "user");
  assert.equal(session.turns[1].role, "assistant");
  assert.match(session.turns[1].content, /老师最可能问什么/);
  assert.deepEqual(session.turns[1].citations, [{ fileName: "README.md", page: 1 }]);
});
