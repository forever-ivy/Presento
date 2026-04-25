import assert from "node:assert/strict";
import { test } from "node:test";
import type { DefenseFileRecord, DefenseProcessingTask } from "./project-workspace.ts";
import { createProcessingArtifact, resolveLocalStoragePath } from "./local-processing.ts";

const baseFile: DefenseFileRecord = {
  id: "file-readme",
  name: "README.md",
  size: 128,
  type: "text/markdown",
  storagePath: ".data/uploads/2026-04-25/readme.md",
  kind: "document",
  status: "已上传，待入库",
  source: "项目速记 Skill",
  addedAt: "2026-04-25T06:00:00.000Z",
};

const baseTask: DefenseProcessingTask = {
  id: "task-readme",
  fileId: "file-readme",
  fileName: "README.md",
  kind: "document",
  title: "抽取项目知识库文本",
  engine: "Docling / Marker",
  status: "processing",
  progress: 35,
  createdAt: "2026-04-25T06:00:00.000Z",
};

test("creates a document artifact with preview lines and chunk count", () => {
  const artifact = createProcessingArtifact({
    file: baseFile,
    task: baseTask,
    content: "# 智能点餐系统\n\n后端负责订单创建。\n数据库包含 orders 表。",
    createdAt: "2026-04-25T06:05:00.000Z",
  });

  assert.equal(artifact.title, "README.md 解析结果");
  assert.equal(artifact.kind, "document");
  assert.equal(artifact.summary, "抽取 3 行文本，预计切分 1 个知识片段。");
  assert.deepEqual(artifact.previewLines, [
    "# 智能点餐系统",
    "后端负责订单创建。",
    "数据库包含 orders 表。",
  ]);
});

test("creates a dataset artifact from JSON keys", () => {
  const artifact = createProcessingArtifact({
    file: {
      ...baseFile,
      id: "file-json",
      name: "package.json",
      kind: "dataset",
      source: "数据质疑 Skill",
    },
    task: {
      ...baseTask,
      id: "task-json",
      fileId: "file-json",
      fileName: "package.json",
      kind: "dataset",
      title: "抽取数据字段与指标",
      engine: "SheetJS",
    },
    content: JSON.stringify({
      name: "web",
      scripts: { dev: "next dev" },
      dependencies: { next: "16.2.4" },
    }),
    createdAt: "2026-04-25T06:05:00.000Z",
  });

  assert.equal(artifact.kind, "dataset");
  assert.equal(artifact.summary, "识别 JSON 顶层字段 3 个：name、scripts、dependencies。");
  assert.deepEqual(artifact.previewLines, [
    "name: web",
    "scripts: {\"dev\":\"next dev\"}",
    "dependencies: {\"next\":\"16.2.4\"}",
  ]);
});

test("resolves only local .data upload paths", () => {
  assert.equal(
    resolveLocalStoragePath(
      ".data/uploads/2026-04-25/readme.md",
      "/Volumes/DISK/project/apps/web",
    ),
    "/Volumes/DISK/project/apps/web/.data/uploads/2026-04-25/readme.md",
  );

  assert.throws(
    () => resolveLocalStoragePath("../package.json", "/Volumes/DISK/project/apps/web"),
    /Invalid storage path/,
  );
  assert.throws(
    () => resolveLocalStoragePath("/etc/passwd", "/Volumes/DISK/project/apps/web"),
    /Invalid storage path/,
  );
});
