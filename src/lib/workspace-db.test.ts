import assert from "node:assert/strict";
import { test } from "node:test";
import type { DefenseWorkspace } from "./project-workspace.ts";
import { workspaceToDatabaseRows } from "./workspace-db-mapper.ts";
import { createWorkspaceDatabase } from "./workspace-db.ts";

const workspace: DefenseWorkspace = {
  project: {
    id: "project-defense",
    name: "智能点餐系统's 课程答辩",
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
      status: "pending",
      progress: 0,
      createdAt: "2026-04-25T06:01:00.000Z",
    },
  ],
  artifacts: [],
};

test("writes the current workspace with a single transaction", async () => {
  const calls: string[] = [];
  const database = createWorkspaceDatabase(async (sql) => {
    calls.push(sql);
    return "";
  });

  const saved = await database.writeCurrentWorkspace(workspace);

  assert.equal(saved.project.id, workspace.project.id);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /BEGIN;/);
  assert.match(calls[0], /DELETE FROM "Project" WHERE "id" = 'project-defense';/);
  assert.match(calls[0], /INSERT INTO "Project"/);
  assert.match(calls[0], /INSERT INTO "FileAsset"/);
  assert.match(calls[0], /INSERT INTO "ProcessingTask"/);
  assert.match(calls[0], /COMMIT;/);
  assert.match(calls[0], /智能点餐系统''s 课程答辩/);
});

test("reads the latest database workspace JSON and restores frontend shape", async () => {
  const rows = workspaceToDatabaseRows(workspace);
  const database = createWorkspaceDatabase(async () => JSON.stringify(rows));

  const stored = await database.readCurrentWorkspace();

  assert.deepEqual(stored, workspace);
});

test("returns null when database has no workspace rows", async () => {
  const database = createWorkspaceDatabase(async () => "");

  assert.equal(await database.readCurrentWorkspace(), null);
});
