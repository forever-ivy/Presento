import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createProjectWorkspace } from "./project-workspace.ts";
import {
  readStoredWorkspace,
  workspaceStorePath,
  writeStoredWorkspace,
} from "./workspace-store.ts";

const tempRoot = await mkdtemp(join(tmpdir(), "defense-workspace-store-"));

after(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

test("persists and reads the current workspace from server storage", async () => {
  const workspace = createProjectWorkspace({
    name: "智能点餐系统课程答辩",
    category: "软件 / AI / 数据类",
    ownerScope: "我负责：后端订单接口",
    teammateScope: "队友负责：前端页面 / 数据库",
    files: [{ name: "README.md", size: 512, storagePath: ".data/uploads/readme.md" }],
  });

  await writeStoredWorkspace(workspace, tempRoot);
  const stored = await readStoredWorkspace(tempRoot);

  assert.equal(stored?.project.name, "智能点餐系统课程答辩");
  assert.equal(stored?.files.length, 1);
  assert.equal(stored?.processingTasks.length, 1);
  assert.equal(
    workspaceStorePath(tempRoot),
    join(tempRoot, ".data", "workspace", "current.json"),
  );
});

test("returns null when no workspace has been stored", async () => {
  const emptyRoot = await mkdtemp(join(tmpdir(), "defense-workspace-empty-"));
  after(async () => {
    await rm(emptyRoot, { recursive: true, force: true });
  });

  assert.equal(await readStoredWorkspace(emptyRoot), null);
});
