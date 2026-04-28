import assert from "node:assert/strict";
import test from "node:test";

import type { KnowledgeEdgeRecord, KnowledgeNodeRecord } from "../../packages/shared/src/domain.ts";
import { createMockKnowledgeMap } from "./knowledge-map-client.ts";
import {
  buildKnowledgeMapScene,
  projectKnowledgeMapScene,
} from "./knowledge-map-scene.ts";

test("buildKnowledgeMapScene derives conceptual depth, scene parents, and branch ownership", () => {
  const map = createMockKnowledgeMap("demo");
  const scene = buildKnowledgeMapScene(map);

  assert.equal(scene.rootId, "project");
  assert.equal(scene.nodesById.project.depth, 0);
  assert.equal(scene.nodesById["source-presentation"].depth, 1);
  assert.equal(scene.nodesById["file-ppt"].depth, 2);
  assert.deepEqual(scene.nodesById["file-ppt"].sceneParentIds, ["source-presentation"]);
  assert.equal(scene.nodesById["training-node"].depth, 3);
  assert.deepEqual(
    scene.nodesById["training-node"].sceneParentIds.toSorted(),
    ["risk-order-state", "weak-db-snapshot"],
  );
  assert.deepEqual(
    scene.nodesById["training-node"].branchIds.toSorted(),
    ["file-orders-sql", "module-order"],
  );
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
    source: "mock",
    nodes: nodes.map((node) => ({
      ...createMockKnowledgeMap("demo").nodes[0],
      ...node,
      preview: createMockKnowledgeMap("demo").nodes[0].preview,
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

test("projectKnowledgeMapScene hides third-layer nodes by default and expands multiple branches in parallel", () => {
  const map = createMockKnowledgeMap("demo");
  const scene = buildKnowledgeMapScene(map);

  const collapsed = projectKnowledgeMapScene(scene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(),
    filter: "all",
    query: "",
  });

  assert.ok(collapsed.nodes.some((node) => node.id === "source-presentation"));
  assert.ok(!collapsed.nodes.some((node) => node.id === "file-ppt"));
  assert.ok(!collapsed.nodes.some((node) => node.id === "training-node"));

  const expanded = projectKnowledgeMapScene(scene, {
    activeNodeId: "module-order",
    expandedBranchIds: new Set(["source-presentation", "module-order"]),
    filter: "all",
    query: "",
  });

  assert.ok(expanded.nodes.some((node) => node.id === "file-ppt"));
  assert.ok(expanded.nodes.some((node) => node.id === "file-ppt-source"));
  assert.ok(expanded.nodes.some((node) => node.id === "file-code-orders"));
  assert.ok(expanded.nodes.some((node) => node.id === "risk-order-state"));
});

test("projectKnowledgeMapScene shows training nodes only when the parent chain is expanded and focused", () => {
  const map = createMockKnowledgeMap("demo");
  const scene = buildKnowledgeMapScene(map);

  const unfocused = projectKnowledgeMapScene(scene, {
    activeNodeId: "module-order",
    expandedBranchIds: new Set(["module-order", "file-orders-sql"]),
    filter: "all",
    query: "",
  });
  assert.ok(!unfocused.nodes.some((node) => node.id === "training-node"));

  const focused = projectKnowledgeMapScene(scene, {
    activeNodeId: "risk-order-state",
    expandedBranchIds: new Set(["module-order"]),
    filter: "all",
    query: "",
  });
  assert.ok(focused.nodes.some((node) => node.id === "training-node"));
});

test("projectKnowledgeMapScene auto-expands folded matches and keeps ancestor chains for filters", () => {
  const map = createMockKnowledgeMap("demo");
  const scene = buildKnowledgeMapScene(map);

  const searched = projectKnowledgeMapScene(scene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(),
    filter: "all",
    query: "订单数据.xlsx",
  });

  assert.ok(searched.nodes.some((node) => node.id === "file-order-data"));
  assert.ok(searched.nodes.some((node) => node.id === "file-orders-sql"));
  assert.ok(searched.autoExpandedBranchIds.has("file-orders-sql"));

  const filtered = projectKnowledgeMapScene(scene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(),
    filter: "weakness",
    query: "",
  });

  assert.ok(filtered.nodes.some((node) => node.id === "weak-db-snapshot"));
  assert.ok(filtered.nodes.some((node) => node.id === "file-orders-sql"));
  assert.ok(filtered.nodes.some((node) => node.id === "project"));
});
