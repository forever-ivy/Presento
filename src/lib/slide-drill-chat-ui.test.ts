import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSlideDrillMessage,
  mergeSlideDrillQuestion,
  mergeSlideDrillQuestionList,
} from "./slide-drill-chat-ui.ts";

test("deduplicates slide drill questions by normalized text", () => {
  const questions = mergeSlideDrillQuestion([], "  M3 如何处理公式？ ", "ai", {
    createdAt: "2026-05-06T00:00:00.000Z",
    id: "q-1",
  });
  const next = mergeSlideDrillQuestion(questions, "M3   如何处理公式？", "user", {
    createdAt: "2026-05-06T00:00:01.000Z",
    id: "q-2",
  });

  assert.equal(next.length, 1);
  assert.equal(next[0]?.source, "ai");
});

test("adds user and suggested questions to the drill list", () => {
  let nextId = 0;
  const questions = mergeSlideDrillQuestionList(
    [],
    ["老师会追问什么？", "还能怎么验证？"],
    "user",
    () => ({
      createdAt: "2026-05-06T00:00:00.000Z",
      id: `q-${++nextId}`,
    }),
  );

  assert.deepEqual(questions.map((question) => question.text), ["老师会追问什么？", "还能怎么验证？"]);
});

test("appends assistant messages with recommended follow-up questions", () => {
  const messages = appendSlideDrillMessage([], "assistant", "可以这样回答。", {
    createdAt: "2026-05-06T00:00:00.000Z",
    id: "m-1",
  }, ["继续追问边界条件？"]);

  assert.equal(messages[0]?.content, "可以这样回答。");
  assert.deepEqual(messages[0]?.suggestedQuestions, ["继续追问边界条件？"]);
});
