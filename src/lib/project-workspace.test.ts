import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createProjectWorkspace,
  classifyDefenseFile,
  summarizeWorkspace,
} from "./project-workspace.ts";

test("classifies common course defense files by extension and name", () => {
  assert.equal(classifyDefenseFile("答辩 PPT.pdf"), "presentation");
  assert.equal(classifyDefenseFile("README.md"), "document");
  assert.equal(classifyDefenseFile("backend.zip"), "code");
  assert.equal(classifyDefenseFile("orders.sql"), "database");
  assert.equal(classifyDefenseFile("订单数据.xlsx"), "dataset");
});

test("creates a workspace with uploaded file records and readiness summary", () => {
  const workspace = createProjectWorkspace({
    name: "智能点餐系统课程答辩",
    category: "软件 / AI / 数据类",
    ownerScope: "我负责：后端订单接口",
    teammateScope: "队友负责：前端页面 / 数据库",
    files: [
      { name: "答辩 PPT.pdf", size: 1024, type: "application/pdf" },
      { name: "backend.zip", size: 2048, type: "application/zip" },
      { name: "orders.sql", size: 512, type: "application/sql" },
    ],
  });

  assert.equal(workspace.project.name, "智能点餐系统课程答辩");
  assert.equal(workspace.files.length, 3);
  assert.deepEqual(
    workspace.files.map((file) => file.kind),
    ["presentation", "code", "database"],
  );

  const summary = summarizeWorkspace(workspace);
  assert.equal(summary.fileCount, 3);
  assert.equal(summary.hasPresentation, true);
  assert.equal(summary.hasCode, true);
  assert.equal(summary.hasDataOrDatabase, true);
  assert.equal(summary.readiness, 45);
});
