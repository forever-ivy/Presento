import assert from "node:assert/strict";
import test from "node:test";

import type { KnowledgeEdgeRecord, KnowledgeNodeRecord } from "../../packages/shared/src/domain.ts";
import { normalizeKnowledgeMapPayload } from "./knowledge-map-client.ts";
import { mockKnowledgeEdges, mockKnowledgeNodes } from "./knowledge-map-mock.ts";
import {
  buildKnowledgeMapScene,
  projectKnowledgeMapScene,
} from "./knowledge-map-scene.ts";

function createKnowledgeMapFixture(projectId: string) {
  return normalizeKnowledgeMapPayload(projectId, {
    edges: mockKnowledgeEdges.map((edge) => ({ ...edge, projectId })),
    nodes: mockKnowledgeNodes.map((node) => ({ ...node, projectId })),
  });
}

test("buildKnowledgeMapScene derives conceptual depth, scene parents, and branch ownership", () => {
  const map = createKnowledgeMapFixture("demo");
  const scene = buildKnowledgeMapScene(map);

  assert.equal(scene.rootId, "project");
  assert.equal(scene.nodesById.project.depth, 0);
  assert.equal(scene.nodesById["source-python"].depth, 1);
  assert.equal(scene.nodesById["file-python-intro"].depth, 2);
  assert.deepEqual(scene.nodesById["file-python-intro"].sceneParentIds, ["source-python"]);
  assert.equal(scene.nodesById["training-node"].depth, 3);
  assert.deepEqual(scene.nodesById["training-node"].sceneParentIds, ["risk-viewer-coverage"]);
  assert.deepEqual(scene.nodesById["training-node"].branchIds, ["risk-viewer-coverage"]);
});

test("buildKnowledgeMapScene falls back to layout ring hints when graph depth is unavailable", () => {
  const nodes: KnowledgeNodeRecord[] = [
    {
      id: "project",
      projectId: "demo",
      kind: "project",
      title: "项目中心",
      summary: "",
      tone: "blue",
      metadata: {},
      createdAt: "2026-04-28T00:00:00.000Z",
    },
    {
      id: "dangling-file",
      projectId: "demo",
      kind: "file",
      title: "孤立资料.pdf",
      summary: "",
      tone: "cyan",
      metadata: {
        fileKind: "pdf",
        layout: { ring: 3 },
      },
      createdAt: "2026-04-28T00:00:00.000Z",
    },
    {
      id: "dangling-training",
      projectId: "demo",
      kind: "training",
      title: "训练入口",
      summary: "",
      tone: "purple",
      metadata: {
        layout: { ring: 4 },
      },
      createdAt: "2026-04-28T00:00:00.000Z",
    },
  ];
  const edges: KnowledgeEdgeRecord[] = [];

  const scene = buildKnowledgeMapScene({
    projectId: "demo",
    source: "api",
    nodes: nodes.map((node) => ({
      ...createKnowledgeMapFixture("demo").nodes[0],
      ...node,
      preview: createKnowledgeMapFixture("demo").nodes[0].preview,
      evidence: [],
      actions: [],
      relatedFiles: [],
      relatedSlides: [],
      riskQuestions: [],
      riskLevel: "medium",
      viewer: "pdf",
      explainable: true,
      raw: node,
    })),
    edges: edges.map((edge) => ({
      ...edge,
      active: false,
      raw: edge,
    })),
  });

  assert.equal(scene.nodesById["dangling-file"].depth, 2);
  assert.equal(scene.nodesById["dangling-training"].depth, 3);
});

test("projectKnowledgeMapScene handles real empty maps", () => {
  const scene = buildKnowledgeMapScene({
    edges: [],
    nodes: [],
    projectId: "demo",
    source: "api",
  });

  const projected = projectKnowledgeMapScene(scene, {
    activeNodeId: "",
    expandedBranchIds: new Set(),
    filter: "all",
    query: "",
  });

  assert.deepEqual(projected.nodes, []);
  assert.deepEqual(projected.edges, []);
});

test("projectKnowledgeMapScene hides third-layer nodes by default and expands multiple branches in parallel", () => {
  const map = createKnowledgeMapFixture("demo");
  const scene = buildKnowledgeMapScene(map);

  const collapsed = projectKnowledgeMapScene(scene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(),
    filter: "all",
    query: "",
  });

  assert.ok(collapsed.nodes.some((node) => node.id === "source-python"));
  assert.ok(!collapsed.nodes.some((node) => node.id === "file-python-intro"));
  assert.ok(!collapsed.nodes.some((node) => node.id === "training-node"));

  const expanded = projectKnowledgeMapScene(scene, {
    activeNodeId: "source-code",
    expandedBranchIds: new Set(["source-python", "source-code"]),
    filter: "all",
    query: "",
  });

  assert.ok(expanded.nodes.some((node) => node.id === "file-python-intro"));
  assert.ok(expanded.nodes.some((node) => node.id === "file-python-function"));
  assert.ok(expanded.nodes.some((node) => node.id === "file-python-hello"));
});

test("projectKnowledgeMapScene shows training nodes only when the parent chain is expanded and focused", () => {
  const map = createKnowledgeMapFixture("demo");
  const scene = buildKnowledgeMapScene(map);

  const unfocused = projectKnowledgeMapScene(scene, {
    activeNodeId: "source-python",
    expandedBranchIds: new Set(["risk-viewer-coverage"]),
    filter: "all",
    query: "",
  });
  assert.ok(!unfocused.nodes.some((node) => node.id === "training-node"));

  const focused = projectKnowledgeMapScene(scene, {
    activeNodeId: "risk-viewer-coverage",
    expandedBranchIds: new Set(["risk-viewer-coverage"]),
    filter: "all",
    query: "",
  });
  assert.ok(focused.nodes.some((node) => node.id === "training-node"));
});

test("projectKnowledgeMapScene auto-expands folded matches and keeps ancestor chains for filters", () => {
  const map = createKnowledgeMapFixture("demo");
  const scene = buildKnowledgeMapScene(map);

  const searched = projectKnowledgeMapScene(scene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(),
    filter: "all",
    query: "invoice.xlsx",
  });

  assert.ok(searched.nodes.some((node) => node.id === "file-invoice"));
  assert.ok(searched.nodes.some((node) => node.id === "source-data"));
  assert.ok(searched.autoExpandedBranchIds.has("source-data"));

  const filtered = projectKnowledgeMapScene(scene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(),
    filter: "risk",
    query: "",
  });

  assert.ok(filtered.nodes.some((node) => node.id === "risk-viewer-coverage"));
  assert.ok(filtered.nodes.some((node) => node.id === "project"));
});
