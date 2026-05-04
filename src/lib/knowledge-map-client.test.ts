import assert from "node:assert/strict";
import test from "node:test";

import {
  createFileExplanation,
  createWorkspaceKnowledgeMap,
  getKnowledgeNodeActivation,
  loadFileNodePreview,
  loadKnowledgeMap,
  mergeWorkspaceKnowledgeMap,
  normalizeKnowledgeMapPayload,
} from "./knowledge-map-client.ts";
import type { KnowledgeEdgeRecord, KnowledgeNodeRecord } from "../../packages/shared/src/domain.ts";

const apiNode: KnowledgeNodeRecord = {
  id: "node-readme",
  projectId: "demo",
  kind: "file",
  title: "README.md",
  summary: "项目说明文档",
  tone: "cyan",
  sourceId: "source-readme",
  metadata: {
    fileId: "file-readme",
    fileKind: "docx",
    riskLevel: "medium",
    preview: {
      outline: ["项目背景", "技术路线"],
      text: "README 提供项目目标、技术路线和分工说明。",
    },
  },
  createdAt: "2026-04-26T00:00:00.000Z",
};

const apiEdge: KnowledgeEdgeRecord = {
  id: "edge-project-readme",
  projectId: "demo",
  fromNodeId: "project",
  toNodeId: "node-readme",
  kind: "evidence",
  label: "说明",
  createdAt: "2026-04-26T00:00:00.000Z",
};

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  } as Response;
}

test("normalizes API knowledge map payload into UI nodes and edges", () => {
  const map = normalizeKnowledgeMapPayload("demo", {
    nodes: [apiNode],
    edges: [apiEdge],
  });

  assert.equal(map.source, "api");
  assert.equal(map.nodes.length, 1);
  assert.equal(map.nodes[0].id, "node-readme");
  assert.equal(map.nodes[0].kind, "file");
  assert.equal(map.nodes[0].fileKind, "docx");
  assert.equal(map.nodes[0].riskLevel, "medium");
  assert.equal(map.nodes[0].viewer, "docx");
  assert.deepEqual(map.nodes[0].evidence, ["README.md", "source-readme"]);
  assert.equal(map.edges[0].fromNodeId, "project");
  assert.equal(map.edges[0].kind, "evidence");
});

test("loadKnowledgeMap keeps empty API results as real empty state", async () => {
  const map = await loadKnowledgeMap("demo", async () => jsonResponse({ nodes: [], edges: [] }));

  assert.equal(map.source, "api");
  assert.equal(map.nodes.length, 0);
  assert.equal(map.edges.length, 0);
});

test("loadKnowledgeMap exposes generation status for expression map jobs", async () => {
  const map = await loadKnowledgeMap("demo", async () => jsonResponse({
    nodes: [],
    edges: [],
    generation: {
      status: "failed",
      jobId: "job-knowledge-map-demo",
      error: "LLM provider is not configured.",
      updatedAt: "2026-05-03T08:00:00.000Z",
    },
  }));

  assert.equal(map.generation.status, "failed");
  assert.equal(map.generation.jobId, "job-knowledge-map-demo");
  assert.match(map.generation.error ?? "", /LLM provider/u);
});

test("createWorkspaceKnowledgeMap exposes uploaded files before generated knowledge nodes exist", () => {
  const map = createWorkspaceKnowledgeMap({
    project: {
      id: "project-demo",
      name: "智能点餐系统",
      category: "软件 / AI / 数据类",
      ownerScope: "",
      teammateScope: "",
      createdAt: "2026-04-30T00:00:00.000Z",
    },
    files: [
      {
        id: "file-src-main",
        name: "src/main.ts",
        size: 128,
        type: "text/typescript",
        kind: "code",
        status: "已上传，待 Repomix 处理",
        source: "代码解释 Skill",
        addedAt: "2026-04-30T00:00:00.000Z",
        storagePath: ".data/uploads/main.ts",
      },
    ],
    processingTasks: [
      {
        id: "task-src-main",
        fileId: "file-src-main",
        fileName: "src/main.ts",
        kind: "code",
        title: "打包代码上下文",
        engine: "Repomix",
        status: "pending",
        progress: 0,
        createdAt: "2026-04-30T00:00:00.000Z",
      },
    ],
    artifacts: [],
  });

  assert.equal(map.nodes.length, 3);
  assert.equal(map.nodes[0].kind, "project");
  assert.equal(map.nodes[1].title, "代码文件");
  assert.equal(map.nodes[2].title, "src/main.ts");
  assert.equal(map.nodes[2].fileId, "file-src-main");
  assert.equal(map.nodes[2].viewer, "code");
  assert.match(map.nodes[2].summary, /等待解析/u);
  assert.deepEqual(
    map.edges.map((edge) => [edge.fromNodeId, edge.toNodeId]),
    [["workspace-project-project-demo", "workspace-category-code"], ["workspace-category-code", "workspace-file-file-src-main"]],
  );
});

test("mergeWorkspaceKnowledgeMap keeps uploaded document files visible when API map is stale", () => {
  const apiMap = normalizeKnowledgeMapPayload("project-demo", {
    edges: [{
      id: "edge-project-code",
      projectId: "project-demo",
      fromNodeId: "node-project-project-demo",
      toNodeId: "node-source-category-project-demo-code",
      kind: "source",
      label: "资料类别",
      createdAt: "2026-04-30T00:00:00.000Z",
    }],
    nodes: [
      {
        id: "node-project-project-demo",
        projectId: "project-demo",
        kind: "project",
        title: "项目中心",
        summary: "",
        tone: "blue",
        metadata: {},
        createdAt: "2026-04-30T00:00:00.000Z",
      },
      {
        id: "node-source-category-project-demo-code",
        projectId: "project-demo",
        kind: "source-category",
        title: "代码资料",
        summary: "",
        tone: "green",
        metadata: {
          kind: "code",
          layout: { ring: 1 },
        },
        createdAt: "2026-04-30T00:00:00.000Z",
      },
    ],
  });
  const merged = mergeWorkspaceKnowledgeMap(apiMap, {
    project: {
      id: "project-demo",
      name: "智能点餐系统",
      category: "软件 / AI / 数据类",
      ownerScope: "",
      teammateScope: "",
      createdAt: "2026-04-30T00:00:00.000Z",
    },
    files: [
      {
        id: "file-main",
        name: "src/main.ts",
        size: 128,
        type: "text/typescript",
        kind: "code",
        status: "已上传，待 Repomix 处理",
        source: "代码解释 Skill",
        addedAt: "2026-04-30T00:00:00.000Z",
        storagePath: ".data/uploads/main.ts",
      },
      {
        id: "file-readme",
        name: "README.md",
        size: 256,
        type: "text/markdown",
        kind: "document",
        status: "已上传，待入库",
        source: "项目速记 Skill",
        addedAt: "2026-04-30T00:00:00.000Z",
        storagePath: ".data/uploads/README.md",
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
        createdAt: "2026-04-30T00:00:00.000Z",
      },
    ],
    artifacts: [],
  });

  assert.ok(merged.nodes.some((node) => node.title === "项目文档"));
  assert.ok(merged.nodes.some((node) => node.title === "README.md" && node.fileId === "file-readme"));
  assert.ok(merged.edges.some((edge) => edge.toNodeId === "workspace-file-file-readme"));
});

test("loadKnowledgeMap surfaces fetch and API failures", async () => {
  await assert.rejects(
    () => loadKnowledgeMap("demo", async () => {
      throw new Error("database is not ready");
    }),
    /database is not ready/,
  );

  await assert.rejects(
    () => loadKnowledgeMap("demo", async () => jsonResponse({
      error: { message: "knowledge map storage is unavailable" },
    }, false)),
    /knowledge map storage is unavailable/,
  );
});

test("loadFileNodePreview adds content asset url and code files from chunks", async () => {
  const map = normalizeKnowledgeMapPayload("demo", {
    nodes: [{
      ...apiNode,
      metadata: {
        ...apiNode.metadata,
        fileKind: "code",
        viewer: "code-ide",
      },
      title: "backend.zip",
    }],
    edges: [],
  });

  const preview = await loadFileNodePreview("demo", map.nodes[0], async () => jsonResponse({
    file: {
      id: "file-readme",
      kind: "code",
      mimeType: "application/zip",
    },
    viewer: "code-ide",
    preview: {
      codePath: "routes/orders.ts",
      language: "typescript",
      text: "fallback",
    },
    chunks: [
      {
        content: "export const ok = true;",
        metadata: {
          codePath: "routes/orders.ts",
          language: "typescript",
          lineStart: 1,
          lineEnd: 1,
        },
      },
    ],
  }));

  assert.equal(preview.viewer, "code");
  assert.equal(preview.assetUrl, "/api/projects/demo/files/file-readme/content");
  assert.equal(preview.mimeType, "application/zip");
  assert.equal(preview.codeFiles.length, 1);
  assert.equal(preview.codeFiles[0].path, "routes/orders.ts");
  assert.equal(preview.codeFiles[0].content, "export const ok = true;");
});

test("file preview and explanation requests can stay focused on the selected expression node", async () => {
  const map = normalizeKnowledgeMapPayload("demo", {
    nodes: [{
      ...apiNode,
      id: "node-file-readme",
    }],
    edges: [],
  });
  const requestedUrls: string[] = [];
  const requestBodies: unknown[] = [];

  await loadFileNodePreview("demo", map.nodes[0], async (url) => {
    requestedUrls.push(url);
    return jsonResponse({
      file: {
        id: "file-readme",
        kind: "document",
        mimeType: "text/markdown",
      },
      viewer: "document",
      preview: { text: "README" },
      chunks: [],
    });
  }, {
    focusNodeId: "node-expression-map",
  });

  await createFileExplanation("demo", map.nodes[0], "quick", async (url, init) => {
    requestedUrls.push(url);
    requestBodies.push(JSON.parse(String(init?.body ?? "{}")));
    return jsonResponse({
      session: {
        id: "session-1",
        projectId: "demo",
        nodeId: "node-file-readme",
        fileId: "file-readme",
        mode: "quick",
        status: "completed",
        summary: "README",
        outline: [],
        citations: [],
        metadata: {},
        turns: [],
        createdAt: "2026-05-03T08:00:00.000Z",
        updatedAt: "2026-05-03T08:00:00.000Z",
      },
    });
  }, {
    focusNodeId: "node-expression-map",
  });

  assert.equal(requestedUrls[0], "/api/projects/demo/knowledge-map/nodes/node-file-readme/preview?focusNodeId=node-expression-map");
  assert.equal(requestedUrls[1], "/api/projects/demo/knowledge-map/nodes/node-file-readme/explanations");
  assert.deepEqual(requestBodies[0], {
    focusNodeId: "node-expression-map",
    mode: "quick",
  });
});

test("classifies file node activation between reader, slide scripts, and detail panel", () => {
  assert.equal(
    getKnowledgeNodeActivation({ kind: "file", fileKind: "ppt" }),
    "scripts",
  );
  assert.equal(
    getKnowledgeNodeActivation({ kind: "file", fileKind: "presentation-pdf" }),
    "scripts",
  );
  assert.equal(
    getKnowledgeNodeActivation({ kind: "file", fileKind: "presentation" }),
    "scripts",
  );
  assert.equal(
    getKnowledgeNodeActivation({ kind: "file", fileKind: "xlsx" }),
    "reader",
  );
  assert.equal(getKnowledgeNodeActivation({ kind: "module" }), "details");
});
