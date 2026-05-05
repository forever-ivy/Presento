import assert from "node:assert/strict";
import test from "node:test";
import type { LlmProvider } from "../../../src/lib/llm-provider.ts";
import { ingestLocalFile } from "./pipeline.ts";

import {
  createKnowledgeMapJobRecord,
  createLocalParsedFileResult,
  enhanceIngestKnowledgeMap,
  processClaimedIngestJob,
} from "./process-job.ts";
import type { JobRunRecord } from "../../shared/src/domain.ts";

test("creates a dedicated knowledge map job after an ingest succeeds", () => {
  const job = createKnowledgeMapJobRecord({
    createdAt: "2026-05-03T08:00:00.000Z",
    projectId: "project-presento",
    trigger: {
      fileId: "file-readme",
      sourceJobId: "job-file-readme",
      taskId: "task-readme",
    },
  });

  assert.equal(job.id, "job-knowledge-map-project-presento");
  assert.equal(job.kind, "knowledge_map");
  assert.equal(job.status, "queued");
  assert.deepEqual(job.payload, {
    fileId: "file-readme",
    reason: "file_ingest_succeeded",
    sourceJobId: "job-file-readme",
    taskId: "task-readme",
  });
});

test("knowledge map jobs do not require file ingest payload fields and fail clearly without an LLM", async () => {
  const calls: string[] = [];
  const job: JobRunRecord = {
    id: "job-knowledge-map-project-presento",
    projectId: "project-presento",
    kind: "knowledge_map",
    status: "running",
    payload: {},
    createdAt: "2026-05-03T08:00:00.000Z",
    updatedAt: "2026-05-03T08:00:00.000Z",
  };

  await assert.rejects(
    () => processClaimedIngestJob(job, async (sql) => {
      calls.push(sql);
      return "";
    }, {
      llmProvider: null,
    }),
    /LLM provider is not configured/u,
  );

  assert.ok(calls.some((sql) => sql.includes('"status" = \'running\'')));
  assert.ok(calls.some((sql) => sql.includes('"status" = \'failed\'')));
});

test("enhanceIngestKnowledgeMap stores ai graph metadata when model succeeds", async () => {
  const ingestResult = createTestIngestResult();
  const metadata = await enhanceIngestKnowledgeMap({
    projectId: "project-demo",
    file: testFile,
    source: ingestResult.source,
    parsedSummary: "项目说明",
    chunks: ingestResult.chunks,
    ingestResult,
    provider: fakeProvider({
      projectSummary: "订单系统。",
      modules: [{ title: "订单中心", summary: "处理订单。", citations: [{ fileId: "file-1" }] }],
      apis: [],
      tables: [],
      risks: [{ title: "如何避免重复提交", summary: "需要说明幂等。", citations: [{ fileId: "file-1" }] }],
      weaknesses: [],
      trainingPaths: [{ title: "订单讲练", summary: "练习订单链路。", citations: [{ fileId: "file-1" }] }],
      citations: [{ fileName: "README.md", fileId: "file-1" }],
    }),
    createdAt: "2026-05-01T00:00:00.000Z",
  });

  assert.equal(metadata.knowledgeMapMode, "ai");
  assert.ok(ingestResult.knowledgeNodes.some((node) => node.title === "订单中心"));
  assert.equal(metadata.knowledgeNodeCount, ingestResult.knowledgeNodes.length);
  assert.equal(metadata.knowledgeEdgeCount, ingestResult.knowledgeEdges.length);
});

test("enhanceIngestKnowledgeMap keeps starter graph when model is unavailable", async () => {
  const ingestResult = createTestIngestResult();
  const starterNodeIds = ingestResult.knowledgeNodes.map((node) => node.id);
  const metadata = await enhanceIngestKnowledgeMap({
    projectId: "project-demo",
    file: testFile,
    source: ingestResult.source,
    parsedSummary: "项目说明",
    chunks: ingestResult.chunks,
    ingestResult,
    provider: null,
    createdAt: "2026-05-01T00:00:00.000Z",
  });

  assert.equal(metadata.knowledgeMapMode, "starter");
  assert.match(metadata.knowledgeMapError ?? "", /模型未配置/u);
  assert.deepEqual(ingestResult.knowledgeNodes.map((node) => node.id), starterNodeIds);
});

const testFile = {
  id: "file-1",
  name: "README.md",
  size: 128,
  type: "text/markdown",
  kind: "document" as const,
  status: "ready",
  source: "upload",
  addedAt: "2026-05-01T00:00:00.000Z",
  storagePath: ".data/uploads/readme.md",
};

function fakeProvider(output: unknown): LlmProvider {
  return {
    async generateJson<T>() {
      return output as T;
    },
  };
}

function createTestIngestResult() {
  return ingestLocalFile({
    projectId: "project-demo",
    file: testFile,
    task: {
      id: "task-1",
      fileId: "file-1",
      fileName: "README.md",
      kind: "document",
      title: "README 解析",
      engine: "notebook-rag",
      status: "pending",
      progress: 0,
      createdAt: "2026-05-01T00:00:00.000Z",
    },
    content: "订单需要防重复提交。",
    parsed: {
      source: {
        title: "README",
        summary: "项目说明",
        fileKind: "document",
      },
      chunks: [{
        id: "chunk-1",
        content: "订单需要防重复提交。",
        source: "README.md · document",
        metadata: {
          lineStart: 1,
          lineEnd: 1,
        },
      }],
      preview: {
        text: "订单需要防重复提交。",
        outline: ["订单需要防重复提交。"],
      },
    },
    createdAt: "2026-05-01T00:00:00.000Z",
  });
}
