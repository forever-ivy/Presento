import test from "node:test";
import assert from "node:assert/strict";

import { demoKnowledgeNodes } from "./demo-data.ts";
import { createKnowledgeMapFlow } from "./knowledge-map-flow.ts";

test("maps demo knowledge nodes into React Flow nodes and edges", () => {
  const flow = createKnowledgeMapFlow(demoKnowledgeNodes);

  assert.equal(flow.nodes.length, demoKnowledgeNodes.length);
  assert.ok(flow.edges.length >= demoKnowledgeNodes.length - 1);

  const projectNode = flow.nodes.find((node) => node.id === "project");
  assert.ok(projectNode);
  assert.equal(projectNode?.type, "knowledgeCard");
  assert.deepEqual(projectNode?.position, { x: 0, y: 0 });

  const riskNode = flow.nodes.find((node) => node.id === "risk");
  assert.ok(riskNode);
  assert.ok(typeof riskNode?.position.x === "number");
  assert.ok(typeof riskNode?.position.y === "number");

  const edgeIds = new Set(flow.edges.map((edge) => `${edge.source}->${edge.target}`));
  assert.ok(edgeIds.has("project->ppt"));
  assert.ok(edgeIds.has("project->code"));
  assert.ok(edgeIds.has("project->risk"));
});

test("preserves node metadata for downstream coach panel linking", () => {
  const flow = createKnowledgeMapFlow(demoKnowledgeNodes);
  const dbNode = flow.nodes.find((node) => node.id === "db");

  assert.ok(dbNode);
  assert.equal(dbNode?.data.title, "数据库设计");
  assert.equal(dbNode?.data.risk, "金额冗余需解释");
  assert.deepEqual(dbNode?.data.evidence, ["orders.sql", "PPT 第 3 页", "订单数据.xlsx"]);
});
