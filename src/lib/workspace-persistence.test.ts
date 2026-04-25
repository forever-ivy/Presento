import assert from "node:assert/strict";
import { test } from "node:test";
import type { DefenseWorkspace } from "./project-workspace.ts";
import { createWorkspacePersistence } from "./workspace-persistence.ts";

const workspace: DefenseWorkspace = {
  project: {
    id: "project-defense",
    name: "智能点餐系统课程答辩",
    category: "软件 / AI / 数据类",
    ownerScope: "我负责：后端订单接口",
    teammateScope: "队友负责：前端页面 / 数据库",
    createdAt: "2026-04-25T06:00:00.000Z",
  },
  files: [],
  processingTasks: [],
  artifacts: [],
};

test("reads workspace from PostgreSQL before JSON fallback", async () => {
  let storeReads = 0;
  const persistence = createWorkspacePersistence({
    readDatabase: async () => workspace,
    writeDatabase: async (value) => value,
    readStore: async () => {
      storeReads += 1;
      return null;
    },
    writeStore: async (value) => value,
  });

  assert.equal((await persistence.readWorkspace())?.project.id, "project-defense");
  assert.equal(storeReads, 0);
});

test("falls back to JSON storage when PostgreSQL read fails", async () => {
  const persistence = createWorkspacePersistence({
    readDatabase: async () => {
      throw new Error("database offline");
    },
    writeDatabase: async (value) => value,
    readStore: async () => workspace,
    writeStore: async (value) => value,
  });

  assert.equal((await persistence.readWorkspace())?.project.name, "智能点餐系统课程答辩");
});

test("writes through PostgreSQL and keeps JSON storage as a local fallback copy", async () => {
  const calls: string[] = [];
  const persistence = createWorkspacePersistence({
    readDatabase: async () => null,
    writeDatabase: async (value) => {
      calls.push("database");
      return value;
    },
    readStore: async () => null,
    writeStore: async (value) => {
      calls.push(`store:${value.project.id}`);
      return value;
    },
  });

  const saved = await persistence.writeWorkspace(workspace);

  assert.equal(saved.project.id, "project-defense");
  assert.deepEqual(calls, ["database", "store:project-defense"]);
});

test("writes JSON storage when PostgreSQL write fails", async () => {
  const calls: string[] = [];
  const persistence = createWorkspacePersistence({
    readDatabase: async () => null,
    writeDatabase: async () => {
      calls.push("database");
      throw new Error("database offline");
    },
    readStore: async () => null,
    writeStore: async (value) => {
      calls.push(`store:${value.project.id}`);
      return value;
    },
  });

  const saved = await persistence.writeWorkspace(workspace);

  assert.equal(saved.project.id, "project-defense");
  assert.deepEqual(calls, ["database", "store:project-defense"]);
});
