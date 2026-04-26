import test from "node:test";
import assert from "node:assert/strict";

import {
  createFlowWorkspaceFlow,
  flowStepToRoute,
  getFlowStepByRoute,
} from "./flow-workspace.ts";

test("maps product routes to flow workspace steps", () => {
  assert.equal(getFlowStepByRoute("/projects/demo/files").id, "files");
  assert.equal(getFlowStepByRoute("/").id, "knowledge");
  assert.equal(getFlowStepByRoute("/projects/demo/knowledge-map").id, "knowledge");
  assert.equal(getFlowStepByRoute("/projects/demo/scripts").id, "scripts");
  assert.equal(getFlowStepByRoute("/projects/demo/defense").id, "defense");
  assert.equal(getFlowStepByRoute("/projects/demo/review").id, "review");
  assert.equal(getFlowStepByRoute("/projects/demo/deep-dive").id, "deepDive");
  assert.equal(getFlowStepByRoute("/projects/demo/skills").id, "skills");
  assert.equal(getFlowStepByRoute("/projects/demo/pcg").id, "pcg");
});

test("uses canonical routes for flow steps", () => {
  assert.equal(flowStepToRoute("files"), "/projects/demo/files");
  assert.equal(flowStepToRoute("knowledge"), "/projects/demo/knowledge-map");
  assert.equal(flowStepToRoute("defense"), "/projects/demo/defense");
});

test("creates active flow graph with colored status edges", () => {
  const flow = createFlowWorkspaceFlow("defense");

  const activeNode = flow.nodes.find((node) => node.id === "defense");
  assert.ok(activeNode);
  assert.equal(activeNode.data.active, true);
  assert.equal(activeNode.data.status, "active");
  assert.equal(activeNode.data.tone, "blue");

  const filesToKnowledge = flow.edges.find((edge) => edge.id === "files-knowledge");
  assert.ok(filesToKnowledge);
  assert.equal(filesToKnowledge.data?.tone, "green");

  const defenseToReview = flow.edges.find((edge) => edge.id === "defense-review");
  assert.ok(defenseToReview);
  assert.equal(defenseToReview.animated, true);
});
