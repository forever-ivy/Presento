import assert from "node:assert/strict";
import { test } from "node:test";
import type { DefensePracticeTurn } from "./defense-review.ts";
import { generateDefenseReview } from "./defense-review.ts";

const turns: DefensePracticeTurn[] = [
  {
    id: "turn-1",
    projectId: "project-defense",
    slideIndex: 2,
    slideTitle: "系统架构",
    teacherRole: "strict",
    userAnswer: "用户提交订单后，后端写入订单表，后厨看板读取待处理订单。",
    aiMessage: "订单状态从创建到后厨接单，中间有哪些状态？谁有权限修改？",
    score: 76,
    strengths: ["回答已经抓到了订单主流程。"],
    risks: ["订单状态流转没有讲完整，容易被追问异常场景。", "资料里有数据库设计，但回答没有解释数据库表和状态字段。"],
    improvedAnswer: "补充 orders 表负责记录订单状态。",
    followUps: ["订单状态从创建到后厨接单，中间有哪些状态？谁有权限修改？"],
    citations: [{ source: "README.md · document", fileName: "README.md", lineStart: 1, lineEnd: 4 }],
    createdAt: "2026-04-25T07:30:00.000Z",
  },
  {
    id: "turn-2",
    projectId: "project-defense",
    slideIndex: 3,
    slideTitle: "数据库设计",
    teacherRole: "strict",
    userAnswer: "数据库包含订单表和订单明细表。",
    aiMessage: "为什么数据库这样设计？orders 表和 order_items 表是什么关系？",
    score: 68,
    strengths: ["能把说明落到数据存储层。"],
    risks: ["个人贡献没有说清楚，课程项目答辩里风险较高。"],
    improvedAnswer: "补充个人负责后端订单接口和状态流转。",
    followUps: ["你个人负责的后端订单接口，核心校验逻辑在哪里？"],
    citations: [{ source: "orders.sql · database", fileName: "orders.sql", lineStart: 1, lineEnd: 8 }],
    createdAt: "2026-04-25T07:35:00.000Z",
  },
];

test("generates defense review from stored practice turns", () => {
  const review = generateDefenseReview({
    projectName: "智能点餐系统课程答辩",
    turns,
    generatedAt: "2026-04-25T07:40:00.000Z",
  });

  assert.equal(review.projectName, "智能点餐系统课程答辩");
  assert.equal(review.totalTurns, 2);
  assert.equal(review.averageScore, 72);
  assert.equal(review.scoreLabel, "基本能答，但需要补证据链");
  assert.match(review.summary, /2 轮/);
  assert.ok(review.weaknesses.some((item) => item.title.includes("订单状态流转")));
  assert.ok(review.nextActions.some((item) => item.includes("个人贡献")));
  assert.equal(review.citations.length, 2);
});

test("generates empty review when there is no practice history", () => {
  const review = generateDefenseReview({
    projectName: "智能点餐系统课程答辩",
    turns: [],
  });

  assert.equal(review.totalTurns, 0);
  assert.equal(review.averageScore, 0);
  assert.equal(review.scoreLabel, "还没有训练记录");
  assert.equal(review.weaknesses[0].title, "先完成一轮同屏答辩");
});
