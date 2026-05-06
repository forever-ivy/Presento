import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowKnowledgeMapLoadingState } from "./knowledge-map-loading.ts";
import type { DefenseWorkspace } from "./project-workspace.ts";

const workspace: DefenseWorkspace = {
  artifacts: [],
  files: [],
  processingTasks: [],
  project: {
    category: "软件 / AI / 数据类",
    createdAt: "2026-05-06T00:00:00.000Z",
    id: "project-demo",
    name: "Minisheet",
    ownerScope: "",
    teammateScope: "",
  },
};

test("keeps loading visible while API has no semantic nodes and generation is running", () => {
  assert.equal(shouldShowKnowledgeMapLoadingState({
    apiNodeCount: 0,
    generation: { status: "running" },
    isLoadingMap: false,
    isLoadingWorkspace: false,
    workspace,
  }), true);
});

test("keeps loading visible while workspace parsing is pending", () => {
  assert.equal(shouldShowKnowledgeMapLoadingState({
    apiNodeCount: 0,
    generation: { status: "idle" },
    isLoadingMap: false,
    isLoadingWorkspace: false,
    workspace: {
      ...workspace,
      processingTasks: [{
        createdAt: "2026-05-06T00:00:00.000Z",
        engine: "PDF.js",
        fileId: "file-1",
        fileName: "demo.pdf",
        id: "task-1",
        kind: "presentation",
        progress: 0,
        status: "pending",
        title: "解析演示资料",
      }],
    },
  }), true);
});

test("allows workspace fallback after loading work is no longer active", () => {
  assert.equal(shouldShowKnowledgeMapLoadingState({
    apiNodeCount: 0,
    generation: { status: "idle" },
    isLoadingMap: false,
    isLoadingWorkspace: false,
    workspace,
  }), false);
});

test("does not hide real API nodes", () => {
  assert.equal(shouldShowKnowledgeMapLoadingState({
    apiNodeCount: 3,
    generation: { status: "running" },
    isLoadingMap: false,
    isLoadingWorkspace: false,
    workspace,
  }), false);
});
