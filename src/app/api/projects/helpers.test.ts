import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPersistedFileBatch } from "./helpers.ts";

test("deduplicates repeated uploaded file records before building a persisted batch", () => {
  const batch = buildPersistedFileBatch("project-demo", [
    {
      name: "src/index.ts",
      size: 128,
      storagePath: ".data/uploads/2026-05-05/a-index.ts",
      storedName: "a-index.ts",
      uploadedAt: "2026-05-05T06:00:00.000Z",
      uploadStatus: "stored",
    },
    {
      name: "src/index.ts",
      size: 128,
      storagePath: ".data/uploads/2026-05-05/a-index.ts",
      storedName: "a-index.ts",
      uploadedAt: "2026-05-05T06:00:00.000Z",
      uploadStatus: "stored",
    },
  ]);

  assert.equal(batch.files.length, 1);
  assert.equal(batch.processingTasks.length, 1);
  assert.equal(batch.jobRuns.length, 1);
});
