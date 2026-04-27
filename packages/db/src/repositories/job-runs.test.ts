import assert from "node:assert/strict";
import test from "node:test";
import { createJobRunRepository } from "./job-runs.ts";

test("creates and updates job runs through the repository abstraction", async () => {
  const executed: string[] = [];
  const repository = createJobRunRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.create({
    id: "job-1",
    projectId: "project-1",
    kind: "file_ingest",
    status: "queued",
    payload: { fileId: "file-1" },
    createdAt: "2026-04-27T10:00:00.000Z",
    updatedAt: "2026-04-27T10:00:00.000Z",
  });
  await repository.markRunning("job-1", "2026-04-27T10:01:00.000Z");
  await repository.markSucceeded("job-1", "2026-04-27T10:02:00.000Z", {
    artifactId: "artifact-1",
  });

  assert.equal(executed.length, 3);
  assert.match(executed[0], /INSERT INTO "JobRun"/);
  assert.match(executed[1], /"status" = 'running'/);
  assert.match(executed[2], /"status" = 'succeeded'/);
});
