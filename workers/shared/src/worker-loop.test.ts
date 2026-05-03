import assert from "node:assert/strict";
import test from "node:test";
import { runWorkerLoop } from "./worker-loop.ts";

test("runWorkerLoop keeps looping after a claimed job fails", async () => {
  const jobs = [
    {
      id: "job-fails",
      projectId: "project-1",
      kind: "file_ingest" as const,
      status: "queued" as const,
      payload: { kind: "code" },
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      id: "job-succeeds",
      projectId: "project-1",
      kind: "file_ingest" as const,
      status: "queued" as const,
      payload: { kind: "code" },
      createdAt: "2026-05-01T00:00:01.000Z",
      updatedAt: "2026-05-01T00:00:01.000Z",
    },
  ];
  const processed: string[] = [];

  const result = await runWorkerLoop({
    claimNext: async () => jobs.shift() ?? null,
    once: true,
    runJob: async (job) => {
      processed.push(job.id);
      if (job.id === "job-fails") {
        throw new Error("Notebook RAG sidecar is not configured.");
      }
    },
  });

  assert.deepEqual(processed, ["job-fails", "job-succeeds"]);
  assert.deepEqual(result, { processed: 1, idle: false });
});
