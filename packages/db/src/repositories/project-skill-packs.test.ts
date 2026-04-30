import assert from "node:assert/strict";
import test from "node:test";
import { createProjectSkillPackRepository } from "./project-skill-packs.ts";

test("replaces project skill pack assignments with explicit enable state", async () => {
  const executed: string[] = [];
  const repository = createProjectSkillPackRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.replace("project-1", [
    {
      id: "project-skill-pack-project-1-core-training",
      projectId: "project-1",
      packId: "core-training",
      enabled: true,
      source: "default",
      reason: null,
      createdAt: "2026-04-29T00:00:00.000Z",
      updatedAt: "2026-04-29T00:00:00.000Z",
    },
    {
      id: "project-skill-pack-project-1-file-explainers",
      projectId: "project-1",
      packId: "file-explainers",
      enabled: false,
      source: "explicit",
      reason: "暂时不开放资料讲解包",
      createdAt: "2026-04-29T00:00:00.000Z",
      updatedAt: "2026-04-29T00:00:00.000Z",
    },
  ]);

  assert.match(executed[0] ?? "", /DELETE FROM "ProjectSkillPack"/u);
  assert.match(executed[0] ?? "", /"packId"/u);
  assert.match(executed[0] ?? "", /'file-explainers'/u);
  assert.match(executed[0] ?? "", /ON CONFLICT \("projectId", "packId"\) DO UPDATE/u);
});

test("lists project skill pack assignments from repository json output", async () => {
  const repository = createProjectSkillPackRepository(async () => JSON.stringify([
    {
      id: "project-skill-pack-project-1-core-training",
      projectId: "project-1",
      packId: "core-training",
      enabled: true,
      source: "default",
      reason: null,
      createdAt: "2026-04-29T00:00:00.000Z",
      updatedAt: "2026-04-29T00:00:00.000Z",
    },
  ]));

  const result = await repository.list("project-1");
  assert.equal(result[0]?.packId, "core-training");
  assert.equal(result[0]?.enabled, true);
});
