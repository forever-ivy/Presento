import assert from "node:assert/strict";
import test from "node:test";

import {
  getKnowledgeNodeActivation,
  loadFileNodePreview,
  loadKnowledgeMap,
  normalizeKnowledgeMapPayload,
} from "./knowledge-map-client.ts";
import type { KnowledgeEdgeRecord, KnowledgeNodeRecord } from "../../packages/shared/src/domain.ts";

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
    async text() {
      return JSON.stringify(payload);
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

test("loadKnowledgeMap keeps empty API results as real empty state", async () => {
  const map = await loadKnowledgeMap("demo", async () => jsonResponse({ nodes: [], edges: [] }));

  assert.equal(map.source, "api");
  assert.equal(map.nodes.length, 0);
  assert.equal(map.edges.length, 0);
});

test("loadKnowledgeMap surfaces fetch and API failures", async () => {
  await assert.rejects(
    () => loadKnowledgeMap("demo", async () => {
      throw new Error("database is not ready");
    }),
    /database is not ready/,
  );

  await assert.rejects(
    () => loadKnowledgeMap("demo", async () => jsonResponse({
      error: { message: "knowledge map storage is unavailable" },
    }, false)),
    /knowledge map storage is unavailable/,
  );
});

test("loadFileNodePreview adds content asset url and code files from chunks", async () => {
  const map = normalizeKnowledgeMapPayload("demo", {
    nodes: [{
      ...apiNode,
      metadata: {
        ...apiNode.metadata,
        fileKind: "code",
        viewer: "code-ide",
      },
      title: "backend.zip",
    }],
    edges: [],
  });

  const preview = await loadFileNodePreview("demo", map.nodes[0], async () => jsonResponse({
    file: {
      id: "file-readme",
      kind: "code",
      mimeType: "application/zip",
    },
    viewer: "code-ide",
    preview: {
      codePath: "routes/orders.ts",
      language: "typescript",
      text: "fallback",
    },
    chunks: [
      {
        content: "export const ok = true;",
        metadata: {
          codePath: "routes/orders.ts",
          language: "typescript",
          lineStart: 1,
          lineEnd: 1,
        },
      },
    ],
  }));

  assert.equal(preview.viewer, "code");
  assert.equal(preview.assetUrl, "/api/projects/demo/files/file-readme/content");
  assert.equal(preview.mimeType, "application/zip");
  assert.equal(preview.codeFiles.length, 1);
  assert.equal(preview.codeFiles[0].path, "routes/orders.ts");
  assert.equal(preview.codeFiles[0].content, "export const ok = true;");
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
