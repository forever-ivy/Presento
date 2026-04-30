import assert from "node:assert/strict";
import test from "node:test";
import { createReviewRepository } from "./reviews.ts";

test("writes expanded MVP review metrics and better answers", async () => {
  const executed: string[] = [];
  const repository = createReviewRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.createReview({
    id: "review-1",
    projectId: "project-1",
    sessionId: "session-1",
    summary: "数据库设计还需加强。",
    averageScore: 74,
    scoreLabel: "基本能答",
    clarityScore: 76,
    evidenceScore: 68,
    pressureScore: 70,
    strengths: ["能说明主流程。"],
    weaknesses: [{ title: "数据库设计解释不够具体", count: 1, evidence: "第 2 页" }],
    betterAnswers: [{ title: "数据库设计", answer: "补充 orders 与 order_items。" }],
    nextActions: ["补充 orders 与 order_items 的关系。"],
    recommendedSkills: ["weakness_deep_dive"],
    citations: [],
    createdAt: "2026-04-28T12:10:00.000Z",
  }, []);

  assert.match(executed[0] ?? "", /"clarityScore"/u);
  assert.match(executed[0] ?? "", /"evidenceScore"/u);
  assert.match(executed[0] ?? "", /"pressureScore"/u);
  assert.match(executed[0] ?? "", /"betterAnswers"/u);
  assert.match(executed[0] ?? "", /"recommendedSkills"/u);
});

test("reads review session bundle with weaknesses and deep-dive refs", async () => {
  const repository = createReviewRepository(async (sql) => {
    if (sql.includes("deepDiveRefs")) {
      return JSON.stringify({
        review: { id: "review-1", projectId: "project-1", sessionId: "session-1" },
        weaknesses: [{ id: "weakness-1", title: "数据库设计解释不够具体" }],
        deepDiveRefs: [{ id: "deep-dive-1", weaknessId: "weakness-1" }],
      });
    }
    return "";
  });

  const bundle = await repository.readSessionBundle("project-1", "session-1");
  assert.equal(bundle.review?.id, "review-1");
  assert.equal(bundle.weaknesses[0]?.id, "weakness-1");
  assert.equal(bundle.deepDiveRefs[0]?.id, "deep-dive-1");
});
