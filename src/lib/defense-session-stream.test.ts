import assert from "node:assert/strict";
import test from "node:test";
import { readUIMessageStream } from "ai";
import {
  createDefenseTurnUIMessageStream,
  type DefenseTurnStreamMessage,
} from "./defense-session-stream.ts";

test("streams a defense teacher reply with turn metadata", async () => {
  const completed: string[] = [];
  const stream = createDefenseTurnUIMessageStream({
    answer: "先讲结论，再补材料支撑。",
    chunkDelayMs: 0,
    messageId: "turn-1",
    metadata: {
      phaseAfter: "teacher_followup",
      phaseBefore: "slide_intro",
      realtimeSessionId: "rt-1",
      sessionId: "session-1",
      turnType: "presentation",
    },
    onComplete: async () => {
      completed.push("done");
    },
    result: {
      currentFollowupCount: 1,
      phaseAfter: "teacher_followup",
      sessionPatch: {
        currentPhase: "teacher_followup",
      },
      turn: {
        id: "turn-1",
        score: 82,
      },
    },
  });

  const states: DefenseTurnStreamMessage[] = [];
  for await (const state of readUIMessageStream<DefenseTurnStreamMessage>({ stream })) {
    states.push(state);
  }

  assert.deepEqual(completed, ["done"]);
  const finalState = states.at(-1);
  assert.ok(finalState);
  assert.equal(finalState.metadata?.sessionId, "session-1");
  assert.equal(finalState.metadata?.realtimeSessionId, "rt-1");
  assert.equal(finalState.metadata?.phaseAfter, "teacher_followup");
  assert.equal(finalState.metadata?.status, "completed");
  assert.equal(
    finalState.parts.filter((part) => part.type === "text").map((part) => part.text).join(""),
    "先讲结论，再补材料支撑。",
  );
  assert.deepEqual(
    finalState.parts.filter((part) => part.type === "data-turn").map((part) => part.data),
    [{
      currentFollowupCount: 1,
      phaseAfter: "teacher_followup",
      sessionPatch: {
        currentPhase: "teacher_followup",
      },
      turn: {
        id: "turn-1",
        score: 82,
      },
    }],
  );
});
