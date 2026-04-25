import assert from "node:assert/strict";
import { test } from "node:test";
import type { DefenseWorkspace } from "./project-workspace.ts";
import {
  workspaceFromDatabaseRows,
  workspaceToDatabaseRows,
} from "./workspace-db-mapper.ts";

const workspace: DefenseWorkspace = {
  project: {
    id: "project-defense",
    name: "智能点餐系统课程答辩",
    category: "软件 / AI / 数据类",
    ownerScope: "我负责：后端订单接口",
    teammateScope: "队友负责：前端页面 / 数据库",
    createdAt: "2026-04-25T06:00:00.000Z",
  },
  files: [
    {
      id: "file-readme",
      name: "README.md",
      size: 512,
      type: "text/markdown",
      storedName: "abc-README.md",
      storagePath: ".data/uploads/2026-04-25/abc-README.md",
      uploadedAt: "2026-04-25T06:01:00.000Z",
      uploadStatus: "stored",
      kind: "document",
      status: "已上传，待入库",
      source: "项目速记 Skill",
      addedAt: "2026-04-25T06:01:00.000Z",
    },
  ],
  processingTasks: [
    {
      id: "task-readme",
      fileId: "file-readme",
      fileName: "README.md",
      kind: "document",
      title: "抽取项目知识库文本",
      engine: "Docling / Marker",
      status: "completed",
      progress: 100,
      createdAt: "2026-04-25T06:01:00.000Z",
      startedAt: "2026-04-25T06:02:00.000Z",
      completedAt: "2026-04-25T06:03:00.000Z",
      artifactId: "artifact-readme",
    },
  ],
  artifacts: [
    {
      id: "artifact-readme",
      taskId: "task-readme",
      fileId: "file-readme",
      fileName: "README.md",
      kind: "document",
      title: "README.md 解析结果",
      summary: "抽取 3 行文本，预计切分 1 个知识片段。",
      previewLines: ["项目背景", "技术路线", "数据库设计"],
      sourcePath: ".data/uploads/2026-04-25/abc-README.md",
      createdAt: "2026-04-25T06:03:00.000Z",
    },
  ],
};

test("maps workspace into normalized database rows", () => {
  const rows = workspaceToDatabaseRows(workspace);

  assert.equal(rows.project.id, "project-defense");
  assert.equal(rows.files[0].projectId, "project-defense");
  assert.equal(rows.files[0].mimeType, "text/markdown");
  assert.equal(rows.processingTasks[0].projectId, "project-defense");
  assert.equal(rows.artifacts[0].projectId, "project-defense");
  assert.deepEqual(rows.artifacts[0].previewLines, [
    "项目背景",
    "技术路线",
    "数据库设计",
  ]);
});

test("restores frontend workspace shape from database rows", () => {
  const rows = workspaceToDatabaseRows(workspace);
  const restored = workspaceFromDatabaseRows(rows);

  assert.deepEqual(restored, workspace);
});
