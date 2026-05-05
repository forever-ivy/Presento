import assert from "node:assert/strict";
import test from "node:test";
import { ingestLocalFile } from "./pipeline.ts";

import {
  createKnowledgeMapJobRecord,
  createLocalParsedFileResult,
  processClaimedIngestJob,
  triggerKnowledgeMapGenerationAfterIngest,
} from "./process-job.ts";
import type { JobRunRecord } from "../../shared/src/domain.ts";

test("creates a project-ready knowledge map job record", () => {
  const job = createKnowledgeMapJobRecord({
    createdAt: "2026-05-03T08:00:00.000Z",
    projectId: "project-presento",
    reason: "project_ready",
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
    reason: "project_ready",
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

test("queues a waiting knowledge map job while project files are still parsing", async () => {
  const calls: string[] = [];

  const result = await triggerKnowledgeMapGenerationAfterIngest({
    fileId: "file-readme",
    projectId: "project-presento",
    runSql: createTaskSummaryRunner(calls, {
      completedTaskCount: 1,
      failedTaskCount: 0,
      pendingTaskCount: 2,
      processingTaskCount: 1,
      totalTaskCount: 4,
    }),
    sourceJobId: "job-file-readme",
    taskId: "task-readme",
  });

  assert.equal(result.reason, "waiting_for_files");
  assert.equal(result.queued, false);
  assert.ok(calls.some((sql) => sql.includes('"reason":"waiting_for_files"')));
  assert.equal(calls.some((sql) => sql.includes('FROM "Project"')), false);
});

test("queues one project-ready knowledge map job only after all project files complete", async () => {
  const calls: string[] = [];

  const result = await triggerKnowledgeMapGenerationAfterIngest({
    fileId: "file-readme",
    projectId: "project-presento",
    runSql: createTaskSummaryRunner(calls, {
      completedTaskCount: 4,
      failedTaskCount: 0,
      pendingTaskCount: 0,
      processingTaskCount: 0,
      totalTaskCount: 4,
    }),
    sourceJobId: "job-file-readme",
    taskId: "task-readme",
  });

  assert.equal(result.reason, "project_ready");
  assert.equal(result.queued, true);
  assert.ok(calls.some((sql) => sql.includes('"reason":"project_ready"')));
  assert.equal(calls.some((sql) => sql.includes('DELETE FROM "KnowledgeNode"')), false);
});

test("blocks knowledge map generation when any project file failed", async () => {
  const calls: string[] = [];

  const result = await triggerKnowledgeMapGenerationAfterIngest({
    fileId: "file-readme",
    projectId: "project-presento",
    runSql: createTaskSummaryRunner(calls, {
      completedTaskCount: 3,
      failedTaskCount: 1,
      pendingTaskCount: 0,
      processingTaskCount: 0,
      totalTaskCount: 4,
    }),
    sourceJobId: "job-file-readme",
    taskId: "task-readme",
  });

  assert.equal(result.reason, "blocked_by_failed_files");
  assert.equal(result.queued, false);
  assert.ok(calls.some((sql) => sql.includes("存在解析失败文件，知识图谱未生成")));
  assert.ok(calls.some((sql) => sql.includes('"status", "payload", "error"')));
});

test("local parsed result is reserved for code-like files", () => {
  const parsed = createLocalParsedFileResult(
    {
      ...testFile,
      name: "src/index.ts",
      kind: "code",
      type: "text/typescript",
    },
    Buffer.from("export const ok = true;"),
  );

  assert.equal(parsed.metadata?.parser, "local-code-fallback");
  assert.equal(parsed.codeTree?.[0]?.path, "src/index.ts");
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

function createTaskSummaryRunner(
  calls: string[],
  summary: {
    completedTaskCount: number;
    failedTaskCount: number;
    pendingTaskCount: number;
    processingTaskCount: number;
    totalTaskCount: number;
  },
) {
  return async (sql: string) => {
    calls.push(sql);
    if (sql.includes('FROM "ProcessingTask"')) {
      return `${JSON.stringify(summary)}\n`;
    }
    return "";
  };
}
