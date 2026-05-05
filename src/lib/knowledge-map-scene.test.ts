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
    generation: { status: "idle" },
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

test("buildKnowledgeMapScene respects expression map metadata layers", () => {
  const createdAt = "2026-05-03T08:00:00.000Z";
  const nodes: KnowledgeNodeRecord[] = [
    {
      id: "project",
      projectId: "demo",
      kind: "project",
      title: "项目中心",
      summary: "",
      tone: "blue",
      metadata: { nodeRole: "mainline", layer: 0 },
      createdAt,
    },
    {
      id: "mainline-product",
      projectId: "demo",
      kind: "module",
      title: "产品功能主线",
      summary: "",
      tone: "green",
      metadata: { nodeRole: "mainline", layer: 1 },
      createdAt,
    },
    {
      id: "expression-map",
      projectId: "demo",
      kind: "module",
      title: "项目知识地图",
      summary: "",
      tone: "purple",
      metadata: { nodeRole: "expression", layer: 2 },
      createdAt,
    },
    {
      id: "evidence-ppt",
      projectId: "demo",
      kind: "file",
      title: "PPT 第 3 页",
      summary: "",
      tone: "orange",
      metadata: { nodeRole: "evidence", layer: 3, fileKind: "presentation" },
      createdAt,
    },
    {
      id: "risk-directory",
      projectId: "demo",
      kind: "risk",
      title: "和普通目录有什么区别？",
      summary: "",
      tone: "red",
      metadata: { nodeRole: "risk", layer: "risk" },
      createdAt,
    },
  ];
  const edges: KnowledgeEdgeRecord[] = [
    {
      id: "edge-project-mainline",
      projectId: "demo",
      fromNodeId: "project",
      toNodeId: "mainline-product",
      kind: "contains",
      createdAt,
    },
    {
      id: "edge-mainline-expression",
      projectId: "demo",
      fromNodeId: "mainline-product",
      toNodeId: "expression-map",
      kind: "contains",
      createdAt,
    },
    {
      id: "edge-expression-evidence",
      projectId: "demo",
      fromNodeId: "expression-map",
      toNodeId: "evidence-ppt",
      kind: "evidence",
      createdAt,
    },
    {
      id: "edge-expression-risk",
      projectId: "demo",
      fromNodeId: "expression-map",
      toNodeId: "risk-directory",
      kind: "risk",
      createdAt,
    },
  ];

  const scene = buildKnowledgeMapScene(normalizeKnowledgeMapPayload("demo", { edges, nodes }));

  assert.equal(scene.nodesById["mainline-product"].depth, 1);
  assert.equal(scene.nodesById["expression-map"].depth, 2);
  assert.equal(scene.nodesById["evidence-ppt"].depth, 3);
  assert.equal(scene.nodesById["risk-directory"].depth, 3);
  assert.deepEqual(scene.nodesById["evidence-ppt"].sceneParentIds, ["expression-map"]);
});

test("projectKnowledgeMapScene handles real empty maps", () => {
  const scene = buildKnowledgeMapScene({
    edges: [],
    generation: { status: "idle" },
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

test("projectKnowledgeMapScene hides file leaves from the default graph and keeps explicit file discovery", () => {
  const map = createKnowledgeMapFixture("demo");
  const scene = buildKnowledgeMapScene(map);

  const collapsed = projectKnowledgeMapScene(scene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(),
    filter: "all",
    query: "",
  });

  assert.ok(!collapsed.nodes.some((node) => node.id === "source-python"));
  assert.ok(!collapsed.nodes.some((node) => node.id === "file-python-intro"));
  assert.ok(!collapsed.nodes.some((node) => node.id === "training-node"));

  const expanded = projectKnowledgeMapScene(scene, {
    activeNodeId: "source-code",
    expandedBranchIds: new Set(["source-python", "source-code"]),
    filter: "all",
    query: "",
  });

  assert.ok(!expanded.nodes.some((node) => node.id === "file-python-intro"));
  assert.ok(!expanded.nodes.some((node) => node.id === "file-python-function"));
  assert.ok(!expanded.nodes.some((node) => node.id === "file-python-hello"));
  assert.ok(!expanded.nodes.some((node) => node.id === "source-code"));

  const filtered = projectKnowledgeMapScene(scene, {
    activeNodeId: "source-code",
    expandedBranchIds: new Set(["source-code"]),
    filter: "file",
    query: "",
  });

  assert.ok(filtered.nodes.some((node) => node.id === "file-python-function"));
  assert.ok(filtered.nodes.some((node) => node.id === "source-code"));
  assert.equal(filtered.nodes.find((node) => node.id === "source-code")?.childCount, 2);

  const searched = projectKnowledgeMapScene(scene, {
    activeNodeId: "source-code",
    expandedBranchIds: new Set(["source-code"]),
    filter: "all",
    query: "hello.py",
  });

  assert.ok(searched.nodes.some((node) => node.id === "file-python-hello"));
});

test("projectKnowledgeMapScene hides source buckets when semantic graph nodes exist", () => {
  const createdAt = "2026-05-05T00:00:00.000Z";
  const nodes: KnowledgeNodeRecord[] = [
    {
      id: "project",
      projectId: "demo",
      kind: "project",
      title: "项目中心",
      summary: "",
      tone: "blue",
      metadata: {},
      createdAt,
    },
    {
      id: "source-code",
      projectId: "demo",
      kind: "source-category",
      title: "代码资料",
      summary: "",
      tone: "cyan",
      metadata: {},
      createdAt,
    },
    {
      id: "module-product",
      projectId: "demo",
      kind: "module",
      title: "产品功能主线",
      summary: "",
      tone: "green",
      metadata: { semanticType: "feature" },
      createdAt,
    },
    {
      id: "file-entry",
      projectId: "demo",
      kind: "file",
      title: "package-lock.json",
      summary: "",
      tone: "cyan",
      metadata: { fileKind: "code" },
      createdAt,
    },
  ];
  const edges: KnowledgeEdgeRecord[] = [
    {
      id: "edge-project-source",
      projectId: "demo",
      fromNodeId: "project",
      toNodeId: "source-code",
      kind: "contains",
      createdAt,
    },
    {
      id: "edge-project-module",
      projectId: "demo",
      fromNodeId: "project",
      toNodeId: "module-product",
      kind: "contains",
      createdAt,
    },
    {
      id: "edge-source-file",
      projectId: "demo",
      fromNodeId: "source-code",
      toNodeId: "file-entry",
      kind: "contains",
      createdAt,
    },
  ];
  const scene = buildKnowledgeMapScene(normalizeKnowledgeMapPayload("demo", { edges, nodes }));

  const projected = projectKnowledgeMapScene(scene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(["source-code", "module-product"]),
    filter: "all",
    query: "",
  });

  assert.ok(projected.nodes.some((node) => node.id === "module-product"));
  assert.ok(!projected.nodes.some((node) => node.id === "source-code"));
  assert.ok(!projected.nodes.some((node) => node.id === "file-entry"));

  const fallbackScene = buildKnowledgeMapScene(
    normalizeKnowledgeMapPayload("demo", {
      edges: edges.filter((edge) => edge.toNodeId !== "module-product"),
      nodes: nodes.filter((node) => node.id !== "module-product"),
    }),
  );
  const fallback = projectKnowledgeMapScene(fallbackScene, {
    activeNodeId: "project",
    expandedBranchIds: new Set(["source-code"]),
    filter: "all",
    query: "",
  });

  assert.ok(fallback.nodes.some((node) => node.id === "source-code"));
  assert.ok(!fallback.nodes.some((node) => node.id === "file-entry"));
});

test("projectKnowledgeMapScene lays out dense expanded file branches as readable clusters", () => {
  const createdAt = "2026-05-01T00:00:00.000Z";
  const nodes: KnowledgeNodeRecord[] = [
    {
      id: "project",
      projectId: "demo",
      kind: "project",
      title: "项目中心",
      summary: "",
      tone: "blue",
      metadata: {},
      createdAt,
    },
    {
      id: "source-code",
      projectId: "demo",
      kind: "source-category",
      title: "代码资料",
      summary: "",
      tone: "green",
      metadata: {},
      createdAt,
    },
    ...Array.from({ length: 14 }, (_, index) => ({
      id: `file-${index}`,
      projectId: "demo",
      kind: "file" as const,
      title: `frontend/src/module-${index}/very-long-file-name-${index}.ts`,
      summary: "",
      tone: "green" as const,
      metadata: {
        fileKind: "code",
      },
      createdAt,
    })),
  ];
  const edges: KnowledgeEdgeRecord[] = [
    {
      id: "edge-project-code",
      projectId: "demo",
      fromNodeId: "project",
      toNodeId: "source-code",
      kind: "contains",
      createdAt,
    },
    ...Array.from({ length: 14 }, (_, index) => ({
      id: `edge-code-file-${index}`,
      projectId: "demo",
      fromNodeId: "source-code",
      toNodeId: `file-${index}`,
      kind: "contains" as const,
      createdAt,
    })),
  ];
  const scene = buildKnowledgeMapScene(normalizeKnowledgeMapPayload("demo", { edges, nodes }));
  const projected = projectKnowledgeMapScene(scene, {
    activeNodeId: "source-code",
    expandedBranchIds: new Set(["source-code"]),
    filter: "file",
    query: "",
  });
  const filePositions = projected.nodes
    .filter((node) => node.depth === 2)
    .map((node) => node.position);
  const roundedX = new Set(filePositions.map((position) => Math.round(position.x * 10) / 10));
  const roundedY = new Set(filePositions.map((position) => Math.round(position.y * 10) / 10));

  assert.equal(filePositions.length, 14);
  assert.ok(roundedX.size >= 2);
  assert.ok(roundedY.size >= 5);
});

test("projectKnowledgeMapScene keeps training nodes out of the graph projection", () => {
  const map = createKnowledgeMapFixture("demo");
  const scene = buildKnowledgeMapScene(map);

  const unfocused = projectKnowledgeMapScene(scene, {
    activeNodeId: "source-python",
    expandedBranchIds: new Set(["risk-viewer-coverage"]),
    filter: "all",
    query: "",
  });
  assert.ok(!unfocused.nodes.some((node) => node.id === "training-node"));

  const focusedParent = projectKnowledgeMapScene(scene, {
    activeNodeId: "risk-viewer-coverage",
    expandedBranchIds: new Set(["risk-viewer-coverage"]),
    filter: "all",
    query: "",
  });
  assert.ok(!focusedParent.nodes.some((node) => node.id === "training-node"));

  const focusedTraining = projectKnowledgeMapScene(scene, {
    activeNodeId: "training-node",
    expandedBranchIds: new Set(["risk-viewer-coverage"]),
    filter: "all",
    query: "",
  });
  assert.ok(!focusedTraining.nodes.some((node) => node.id === "training-node"));
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
