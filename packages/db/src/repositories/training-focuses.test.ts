import assert from "node:assert/strict";
import test from "node:test";

import { createTrainingFocusRepository } from "./training-focuses.ts";

test("upserts project training focuses with a stable project-node key", async () => {
  const executed: string[] = [];
  const repository = createTrainingFocusRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.upsertFocus({
    projectId: "project-1",
    knowledgeNodeId: "node-module-1",
    createdAt: "2026-05-05T00:00:00.000Z",
  });

  assert.match(executed[0] ?? "", /"KnowledgeTrainingFocus"/u);
  assert.match(executed[0] ?? "", /ON CONFLICT \("projectId", "knowledgeNodeId"\)/u);
});

test("lists project training focuses in latest update order", async () => {
  const repository = createTrainingFocusRepository(async (sql) => {
    assert.match(sql, /ORDER BY focus_rows\."updatedAt" DESC/u);
    return JSON.stringify([
      {
        id: "focus-project-1-node-module-1",
        projectId: "project-1",
        knowledgeNodeId: "node-module-1",
        createdAt: "2026-05-05T00:00:00.000Z",
        updatedAt: "2026-05-05T00:00:00.000Z",
      },
    ]);
  });

  const focuses = await repository.listByProject("project-1");

  assert.equal(focuses[0]?.knowledgeNodeId, "node-module-1");
});
