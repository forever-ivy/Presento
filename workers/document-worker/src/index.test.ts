import assert from "node:assert/strict";
import test from "node:test";
import { canHandleDocumentJob, runDocumentWorkerJob } from "./index.ts";

test("document worker handles file ingest and knowledge map jobs", async () => {
  const calls: string[] = [];
  const handled = await runDocumentWorkerJob(
    {
      id: "job-1",
      projectId: "project-1",
      kind: "file_ingest",
      status: "queued",
      payload: {},
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:00:00.000Z",
    },
    async (job) => {
      calls.push(job.id);
      return { ok: true };
    },
  );

  assert.equal(canHandleDocumentJob({
    id: "job-2",
    projectId: "project-1",
    kind: "knowledge_map",
    status: "queued",
    payload: {},
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  }), true);
  assert.deepEqual(calls, ["job-1"]);
  assert.equal(handled.skipped, false);
});
