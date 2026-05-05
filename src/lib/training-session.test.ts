import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeepDiveDrafts,
  buildRetrievedSources,
  buildSessionStatePatch,
  createTrainingSessionRecord,
  normalizeTrainingTurnsForReview,
} from "./training-session.ts";

test("createTrainingSessionRecord initializes the planned MVP training state", () => {
  const session = createTrainingSessionRecord({
    projectId: "project-1",
    title: "课程项目答辩训练",
    teacherRole: "strict",
    difficulty: "normal",
    currentSlideId: "slide-1",
    currentKnowledgeNodeId: "node-1",
    createdAt: "2026-04-28T12:00:00.000Z",
  });

  assert.equal(session.voiceState, "idle");
  assert.equal(session.hintCount, 0);
  assert.equal(session.followUpCount, 0);
  assert.deepEqual(session.detectedWeaknesses, []);
  assert.deepEqual(session.lastRetrievedSources, []);
  assert.equal(session.shouldFinish, false);
});

test("createTrainingSessionRecord snapshots focus nodes and keeps current node compatible", () => {
  const session = createTrainingSessionRecord({
    projectId: "project-1",
    title: "课程项目答辩训练",
    teacherRole: "strict",
    difficulty: "normal",
    focusKnowledgeNodeIds: ["node-a", "node-a", "node-b"],
    createdAt: "2026-04-28T12:00:00.000Z",
  });

  assert.deepEqual(session.focusKnowledgeNodeIds, ["node-a", "node-b"]);
  assert.equal(session.currentKnowledgeNodeId, "node-a");
});

test("buildRetrievedSources keeps a stable citation-oriented source summary", () => {
  const sources = buildRetrievedSources([
    {
      id: "chunk-1",
      source: "README.md · document",
      content: "项目背景",
      metadata: {
        fileName: "README.md",
        lineStart: 1,
        lineEnd: 3,
      },
    },
    {
      id: "chunk-2",
      source: "README.md · document",
      content: "项目背景",
      metadata: {
        fileName: "README.md",
        lineStart: 1,
        lineEnd: 3,
      },
    },
  ]);

  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.id, "README.md:1-3");
  assert.equal(sources[0]?.fileName, "README.md");
});

test("buildSessionStatePatch advances follow-up state and detects finish readiness", () => {
  const patch = buildSessionStatePatch({
    session: {
      followUpCount: 2,
      hintCount: 0,
      detectedWeaknesses: ["数据库设计解释不够具体"],
      lastRetrievedSources: [],
    },
    existingTurnCount: 2,
    userAnswer: "",
    retrievedSources: [{ id: "README.md:1-3", source: "README", fileName: "README.md" }],
    followUps: ["继续追问 1", "继续追问 2"],
    risks: ["个人贡献没有说清楚"],
    speech: { audioUrl: "data:audio/mpeg;base64,abc" },
  });

  assert.equal(patch.voiceState, "speaking");
  assert.equal(patch.followUpCount, 4);
  assert.equal(patch.hintCount, 1);
  assert.equal(patch.shouldFinish, true);
  assert.deepEqual(
    patch.detectedWeaknesses,
    ["数据库设计解释不够具体", "个人贡献没有说清楚"],
  );
});

test("normalizeTrainingTurnsForReview preserves slide and turn context", () => {
  const turns = normalizeTrainingTurnsForReview([
    {
      id: "turn-1",
      sessionId: "session-1",
      projectId: "project-1",
      slideId: "slide-1",
      slideIndex: 3,
      slideTitle: "系统架构",
      knowledgeNodeId: "node-1",
      teacherRole: "strict",
      userAnswer: "我负责订单接口",
      aiMessage: "继续解释数据库设计",
      score: 72,
      strengths: ["讲清主流程"],
      risks: ["数据库设计解释不够具体"],
      improvedAnswer: "补充 orders 与 order_items。",
      followUps: ["orders 表为什么单独建？"],
      citations: [],
      retrievedSourceIds: ["README.md:1-3"],
      speech: { audioUrl: "data:audio/mpeg;base64,abc" },
      createdAt: "2026-04-28T12:00:00.000Z",
    },
  ]);

  assert.equal(turns[0]?.slideIndex, 3);
  assert.equal(turns[0]?.slideTitle, "系统架构");
  assert.equal(turns[0]?.slideId, "slide-1");
  assert.deepEqual(turns[0]?.retrievedSourceIds, ["README.md:1-3"]);
});

test("buildDeepDiveDrafts creates stable task skeletons from weaknesses", () => {
  const deepDives = buildDeepDiveDrafts({
    projectId: "project-1",
    weaknesses: [
      {
        id: "weakness-1",
        projectId: "project-1",
        sessionId: "session-1",
        trainingTurnId: "turn-1",
        title: "数据库设计解释不够具体",
        reason: "第 3 页回答没讲清 orders 与 order_items。",
        status: "open",
        citations: [],
        createdAt: "2026-04-28T12:00:00.000Z",
      },
    ],
    createdAt: "2026-04-28T12:10:00.000Z",
  });

  assert.equal(deepDives.length, 1);
  assert.equal(deepDives[0]?.weaknessId, "weakness-1");
  assert.match(deepDives[0]?.title ?? "", /数据库设计/);
  assert.equal(Array.isArray(deepDives[0]?.checklist), true);
});
