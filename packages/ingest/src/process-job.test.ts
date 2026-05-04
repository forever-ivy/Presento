import assert from "node:assert/strict";
import test from "node:test";

import {
  createKnowledgeMapJobRecord,
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
