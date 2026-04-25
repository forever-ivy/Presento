import assert from "node:assert/strict";
import { test } from "node:test";
import type { DefensePracticeTurn } from "./defense-review.ts";
import { createDefensePracticeDatabase } from "./defense-practice-db.ts";

const turn: DefensePracticeTurn = {
  id: "turn-1",
  projectId: "project-defense",
  slideIndex: 2,
  slideTitle: "系统架构",
  teacherRole: "strict",
  userAnswer: "用户提交订单后，后端写入订单表。",
  aiMessage: "订单状态从创建到后厨接单，中间有哪些状态？谁有权限修改？",
  score: 76,
  strengths: ["回答已经抓到了订单主流程。"],
  risks: ["订单状态流转没有讲完整，容易被追问异常场景。"],
  improvedAnswer: "补充 orders 表负责记录订单状态。",
  followUps: ["订单状态从创建到后厨接单，中间有哪些状态？谁有权限修改？"],
  citations: [{ source: "README.md · document", fileName: "README.md", lineStart: 1, lineEnd: 4 }],
  createdAt: "2026-04-25T07:30:00.000Z",
};

test("writes a defense practice turn into the database", async () => {
  let sql = "";
  const database = createDefensePracticeDatabase(async (query) => {
    sql = query;
    return "";
  });

  await database.writePracticeTurn(turn);

  assert.match(sql, /INSERT INTO "DefensePracticeTurn"/);
  assert.match(sql, /'turn-1'/);
  assert.match(sql, /'project-defense'/);
  assert.match(sql, /'strict'/);
  assert.match(sql, /"score", "strengths", "risks"/);
  assert.match(sql, /ON CONFLICT \("id"\) DO UPDATE/);
});

test("reads defense practice turns for a project", async () => {
  const database = createDefensePracticeDatabase(async () => JSON.stringify([turn]));

  const turns = await database.readProjectPracticeTurns("project-defense");

  assert.deepEqual(turns, [turn]);
});

test("returns no practice turns when project has no history", async () => {
  const database = createDefensePracticeDatabase(async () => "");

  const turns = await database.readProjectPracticeTurns("project-defense");

  assert.deepEqual(turns, []);
});
