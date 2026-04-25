import assert from "node:assert/strict";
import { test } from "node:test";
import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";
import { generateDefenseCoachTurn } from "./defense-chat-skill.ts";

const chunks: KnowledgeChunkRecord[] = [
  {
    id: "chunk-readme-1",
    projectId: "project-defense",
    artifactId: "artifact-readme",
    fileId: "file-readme",
    content: [
      "技术路线：Next.js 前端、Node API、PostgreSQL 数据库。",
      "功能模块：学生点餐、购物车、订单创建、后厨看板、管理员菜品管理。",
      "数据库设计：orders 表记录订单状态，order_items 表记录菜品明细。",
      "个人负责：后端订单接口、数据库表设计、订单状态流转。",
    ].join("\n"),
    source: "README.md · document",
    metadata: {
      fileName: "README.md",
      kind: "document",
      artifactTitle: "README.md 解析结果",
      lineStart: 1,
      lineEnd: 4,
    },
    createdAt: "2026-04-25T06:04:00.000Z",
  },
];

test("generates a strict teacher follow-up grounded in current slide and knowledge chunks", () => {
  const turn = generateDefenseCoachTurn({
    projectName: "智能点餐系统课程答辩",
    slideTitle: "系统架构",
    slideIndex: 2,
    teacherRole: "strict",
    userAnswer: "用户提交订单后，后端写入订单表，后厨看板读取待处理订单。",
    chunks,
    generatedAt: "2026-04-25T07:30:00.000Z",
  });

  assert.equal(turn.role, "AI 老师");
  assert.match(turn.message, /第 2 页/);
  assert.match(turn.message, /订单状态/);
  assert.equal(turn.feedback.score, 72);
  assert.ok(turn.feedback.strengths.some((item) => item.includes("订单")));
  assert.ok(turn.feedback.risks.some((item) => item.includes("数据库")));
  assert.ok(turn.followUps.length >= 2);
  assert.equal(turn.citations[0].source, "README.md · document");
  assert.equal(turn.generatedAt, "2026-04-25T07:30:00.000Z");
});

test("generates a starter question when user has not answered yet", () => {
  const turn = generateDefenseCoachTurn({
    projectName: "智能点餐系统课程答辩",
    slideTitle: "系统架构",
    slideIndex: 2,
    teacherRole: "technical",
    userAnswer: "",
    chunks,
  });

  assert.match(turn.message, /先用 30 秒/);
  assert.equal(turn.feedback.score, 0);
  assert.deepEqual(turn.feedback.strengths, []);
});

test("falls back gracefully without project knowledge chunks", () => {
  const turn = generateDefenseCoachTurn({
    projectName: "智能点餐系统课程答辩",
    slideTitle: "系统架构",
    slideIndex: 2,
    teacherRole: "normal",
    userAnswer: "我主要负责后端。",
    chunks: [],
  });

  assert.match(turn.message, /资料依据/);
  assert.equal(turn.citations.length, 0);
  assert.ok(turn.feedback.risks.some((item) => item.includes("项目资料")));
});
