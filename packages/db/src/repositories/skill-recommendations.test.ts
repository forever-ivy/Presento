import assert from "node:assert/strict";
import test from "node:test";
import { createSkillRecommendationRepository } from "./skill-recommendations.ts";

test("writes recommendation logs with nullable requested skill and acceptance state", async () => {
  const executed: string[] = [];
  const repository = createSkillRecommendationRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.create({
    id: "skill-recommendation-1",
    projectId: "project-1",
    requestedSkillId: null,
    resolvedSkillId: "project_brief",
    mode: "workspace",
    event: "page_load",
    reason: "工作台优先生成项目速记卡。",
    context: { pageKind: "workspace", enabledPackIds: ["core-training"] },
    accepted: null,
    createdAt: "2026-04-29T00:00:00.000Z",
  });

  assert.match(executed[0] ?? "", /INSERT INTO "SkillRecommendationLog"/u);
  assert.match(executed[0] ?? "", /NULL/u);
  assert.match(executed[0] ?? "", /"context"/u);
});
