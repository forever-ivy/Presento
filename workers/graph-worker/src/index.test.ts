import assert from "node:assert/strict";
import test from "node:test";
import { canHandleGraphJob, runGraphWorkerJob } from "./index.ts";

test("graph worker only handles project-ready knowledge map jobs", async () => {
  const readyJob = {
    id: "job-knowledge-map-project-1",
    projectId: "project-1",
    kind: "knowledge_map" as const,
    status: "queued" as const,
    payload: { reason: "project_ready" },
    createdAt: "2026-05-06T00:00:00.000Z",
    updatedAt: "2026-05-06T00:00:00.000Z",
  };
  const waitingJob = {
    ...readyJob,
    id: "job-knowledge-map-project-2",
    payload: { reason: "waiting_for_files" },
  };

  assert.equal(canHandleGraphJob(readyJob), true);
  assert.equal(canHandleGraphJob(waitingJob), false);

  const handled = await runGraphWorkerJob(readyJob, async () => ({ ok: true }));
  const skipped = await runGraphWorkerJob(waitingJob, async () => {
    throw new Error("waiting jobs must not run");
  });

  assert.equal(handled.skipped, false);
  assert.equal(skipped.skipped, true);
});
