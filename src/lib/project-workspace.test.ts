import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createProjectWorkspace,
  classifyDefenseFile,
  completeProcessingTask,
  failProcessingTask,
  startNextProcessingTask,
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

test("creates processing tasks for uploaded files that need parsing", () => {
  const workspace = createProjectWorkspace({
    name: "智能点餐系统课程答辩",
    category: "软件 / AI / 数据类",
    ownerScope: "我负责：后端订单接口",
    teammateScope: "队友负责：前端页面 / 数据库",
    files: [
      {
        name: "答辩 PPT.pdf",
        size: 1024,
        type: "application/pdf",
        storagePath: ".data/uploads/2026-04-25/ppt.pdf",
      },
      {
        name: "logo.png",
        size: 128,
        type: "image/png",
        storagePath: ".data/uploads/2026-04-25/logo.png",
      },
    ],
  });

  assert.equal(workspace.processingTasks.length, 1);
  assert.equal(workspace.processingTasks[0].fileName, "答辩 PPT.pdf");
  assert.equal(workspace.processingTasks[0].kind, "presentation");
  assert.equal(workspace.processingTasks[0].status, "pending");
  assert.equal(workspace.processingTasks[0].engine, "PDF.js + 逐页讲稿 Skill");
});

test("moves processing tasks through start, complete, and failed states", () => {
  const workspace = createProjectWorkspace({
    name: "智能点餐系统课程答辩",
    category: "软件 / AI / 数据类",
    ownerScope: "我负责：后端订单接口",
    teammateScope: "队友负责：前端页面 / 数据库",
    files: [
      { name: "backend.zip", size: 2048, storagePath: ".data/uploads/backend.zip" },
      { name: "README.md", size: 512, storagePath: ".data/uploads/readme.md" },
    ],
  });

  const started = startNextProcessingTask(workspace, "2026-04-25T06:00:00.000Z");
  assert.equal(started.processingTasks[0].status, "processing");
  assert.equal(started.processingTasks[0].progress, 35);
  assert.equal(started.processingTasks[0].startedAt, "2026-04-25T06:00:00.000Z");

  const completed = completeProcessingTask(
    started,
    started.processingTasks[0].id,
    "2026-04-25T06:01:00.000Z",
  );
  assert.equal(completed.processingTasks[0].status, "completed");
  assert.equal(completed.processingTasks[0].progress, 100);
  assert.equal(completed.processingTasks[0].completedAt, "2026-04-25T06:01:00.000Z");

  const failed = failProcessingTask(
    completed,
    completed.processingTasks[1].id,
    "无法解析空文件",
    "2026-04-25T06:02:00.000Z",
  );
  assert.equal(failed.processingTasks[1].status, "failed");
  assert.equal(failed.processingTasks[1].error, "无法解析空文件");
});

test("stores processing artifacts when a task completes", () => {
  const workspace = createProjectWorkspace({
    name: "智能点餐系统课程答辩",
    category: "软件 / AI / 数据类",
    ownerScope: "我负责：后端订单接口",
    teammateScope: "队友负责：前端页面 / 数据库",
    files: [{ name: "README.md", size: 512, storagePath: ".data/uploads/readme.md" }],
  });
  const task = workspace.processingTasks[0];

  const completed = completeProcessingTask(
    workspace,
    task.id,
    "2026-04-25T06:05:00.000Z",
    {
      id: "artifact-readme",
      taskId: task.id,
      fileId: task.fileId,
      fileName: task.fileName,
      kind: task.kind,
      title: "README.md 解析结果",
      summary: "抽取 3 行文本，预计切分 1 个知识片段。",
      previewLines: ["项目背景", "技术路线", "数据库设计"],
      sourcePath: ".data/uploads/readme.md",
      createdAt: "2026-04-25T06:05:00.000Z",
    },
  );

  assert.equal(completed.artifacts.length, 1);
  assert.equal(completed.artifacts[0].summary, "抽取 3 行文本，预计切分 1 个知识片段。");
  assert.equal(completed.processingTasks[0].artifactId, "artifact-readme");
});
