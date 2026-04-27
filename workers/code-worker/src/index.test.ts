import assert from "node:assert/strict";
import test from "node:test";
import { canHandleCodeJob, runCodeWorkerJob } from "./index.ts";

test("code worker only handles code ingest jobs", async () => {
  const job = {
    id: "job-code",
    projectId: "project-1",
    kind: "file_ingest" as const,
    status: "queued" as const,
    payload: { kind: "code" },
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
  };

  assert.equal(canHandleCodeJob(job), true);

  const handled = await runCodeWorkerJob(job, async () => ({ ok: true }));
  assert.equal(handled.skipped, false);
});
