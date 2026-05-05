import assert from "node:assert/strict";
import test from "node:test";
import { createTrainingSessionRepository } from "./training-sessions.ts";

test("writes planned MVP training session state fields", async () => {
  const executed: string[] = [];
  const repository = createTrainingSessionRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.createSession({
    id: "session-1",
    projectId: "project-1",
    title: "课程项目答辩训练",
    teacherRole: "strict",
    difficulty: "normal",
    currentSlideId: "slide-1",
    currentKnowledgeNodeId: "node-1",
    focusKnowledgeNodeIds: ["node-1", "node-2"],
    status: "active",
    voiceState: "idle",
    hintCount: 0,
    followUpCount: 0,
    detectedWeaknesses: [],
    lastRetrievedSources: [],
    shouldFinish: false,
    startedAt: "2026-04-28T12:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-04-28T12:00:00.000Z",
    updatedAt: "2026-04-28T12:00:00.000Z",
  });

  assert.match(executed[0] ?? "", /"hintCount"/u);
  assert.match(executed[0] ?? "", /"followUpCount"/u);
  assert.match(executed[0] ?? "", /"detectedWeaknesses"/u);
  assert.match(executed[0] ?? "", /"lastRetrievedSources"/u);
  assert.match(executed[0] ?? "", /"shouldFinish"/u);
  assert.match(executed[0] ?? "", /"focusKnowledgeNodeIds"/u);
});

test("writes training turn context fields including retrieved sources and speech", async () => {
  const executed: string[] = [];
  const repository = createTrainingSessionRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.addTurn({
    id: "turn-1",
    sessionId: "session-1",
    projectId: "project-1",
    slideId: "slide-1",
    slideIndex: 2,
    slideTitle: "系统架构",
    knowledgeNodeId: "node-1",
    teacherRole: "strict",
    userAnswer: "我负责订单接口",
    aiMessage: "继续解释数据库设计",
    score: 76,
    strengths: ["讲清主流程"],
    risks: ["数据库设计解释不够具体"],
    improvedAnswer: "补充 orders 与 order_items。",
    followUps: ["orders 表为什么单独建？"],
    citations: [],
    retrievedSourceIds: ["README.md:1-3"],
    speech: { audioUrl: "data:audio/mpeg;base64,abc" },
    createdAt: "2026-04-28T12:01:00.000Z",
  });

  assert.match(executed[0] ?? "", /"slideIndex"/u);
  assert.match(executed[0] ?? "", /"slideTitle"/u);
  assert.match(executed[0] ?? "", /"retrievedSourceIds"/u);
  assert.match(executed[0] ?? "", /"speech"/u);
});

test("reads training session aggregate with latest review and deep-dive refs", async () => {
  const repository = createTrainingSessionRepository(async (sql) => {
    if (sql.includes("latestReview")) {
      return JSON.stringify({
        session: { id: "session-1", projectId: "project-1" },
        turns: [],
        voiceCaptures: [],
        latestReview: { id: "review-1", sessionId: "session-1" },
        detectedWeaknesses: [{ id: "weakness-1", title: "数据库设计解释不够具体" }],
        deepDiveRefs: [{ id: "deep-dive-1", weaknessId: "weakness-1" }],
      });
    }
    return "";
  });

  const result = await repository.readSession("session-1");
  assert.equal(result.latestReview?.id, "review-1");
  assert.equal(result.detectedWeaknesses[0]?.id, "weakness-1");
  assert.equal(result.deepDiveRefs[0]?.id, "deep-dive-1");
});
