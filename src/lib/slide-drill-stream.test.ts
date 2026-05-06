import assert from "node:assert/strict";
import test from "node:test";
import { readUIMessageStream } from "ai";
import {
  createSlideDrillUIMessageStream,
  splitSlideDrillAnswerDeltas,
  type SlideDrillStreamMessage,
} from "./slide-drill-stream.ts";

test("converts slide drill answers into an AI SDK UI message stream", async () => {
  let completed = false;
  const stream = createSlideDrillUIMessageStream({
    answer: "可以先解释调用链，再补充异常兜底。",
    chunkDelayMs: 0,
    messageId: "drill-message-1",
    metadata: {
      skillInvocationId: "invocation-1",
      skillStatus: "completed",
      usedFallback: false,
    },
    onComplete: async () => {
      completed = true;
    },
    suggestedQuestions: ["如果调用链中断怎么办？", "如何证明结果可靠？"],
  });

  const states: SlideDrillStreamMessage[] = [];
  for await (const state of readUIMessageStream<SlideDrillStreamMessage>({ stream })) {
    states.push(state);
  }

  assert.equal(completed, true);
  const finalState = states.at(-1);
  assert.ok(finalState);
  assert.equal(finalState.metadata?.skillInvocationId, "invocation-1");
  assert.deepEqual(finalState.metadata?.suggestedQuestions, ["如果调用链中断怎么办？", "如何证明结果可靠？"]);
  assert.equal(
    finalState.parts.filter((part) => part.type === "text").map((part) => part.text).join(""),
    "可以先解释调用链，再补充异常兜底。",
  );
  assert.deepEqual(
    finalState.parts.filter((part) => part.type === "data-suggestions").map((part) => part.data),
    [{ questions: ["如果调用链中断怎么办？", "如何证明结果可靠？"] }],
  );
});

test("splits slide drill answers into multiple streaming deltas", () => {
  const deltas = splitSlideDrillAnswerDeltas("第一，先正面回答。第二，再给依据。第三，说明边界。");

  assert.ok(deltas.length > 1);
  assert.equal(deltas.join(""), "第一，先正面回答。第二，再给依据。第三，说明边界。");
});
