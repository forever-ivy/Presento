import assert from "node:assert/strict";
import test from "node:test";
import { buildFinalizedTurn } from "./turn-finalizer.ts";

test("buildFinalizedTurn collapses a completed realtime exchange into a training turn payload", () => {
  const turn = buildFinalizedTurn({
    projectId: "project-1",
    trainingSessionId: "session-1",
    realtimeSessionId: "rt-1",
    turnIndex: 2,
    teacherRole: "strict",
    currentSlideId: "slide-2",
    currentKnowledgeNodeId: "node-9",
    contextSnapshot: {
      slideTitle: "系统架构",
      slideIndex: 2,
      retrievedSources: [{ id: "README.md:1-3" }],
    },
    events: [
      {
        id: "event-1",
        eventType: "user.transcript.final",
        payload: {
          transcriptText: "我负责订单接口和数据库状态流转。",
        },
        createdAt: "2026-04-28T12:00:01.000Z",
      },
      {
        id: "event-2",
        eventType: "assistant.response.final",
        payload: {
          responseId: "resp-1",
          traceId: "trace-1",
          transcriptText: "继续说明为什么 orders 和 order_items 要拆表。",
          latencyMs: 864,
        },
        createdAt: "2026-04-28T12:00:02.000Z",
      },
    ],
  });

  assert.equal(turn.sessionId, "session-1");
  assert.equal(turn.realtimeSessionId, "rt-1");
  assert.equal(turn.turnIndex, 2);
  assert.equal(turn.slideTitle, "系统架构");
  assert.equal(turn.inputTranscript, "我负责订单接口和数据库状态流转。");
  assert.equal(turn.assistantTranscript, "继续说明为什么 orders 和 order_items 要拆表。");
  assert.equal(turn.providerResponseId, "resp-1");
  assert.equal(turn.providerTraceId, "trace-1");
  assert.equal(turn.latencyMs, 864);
  assert.deepEqual(turn.retrievedSourceIds, ["README.md:1-3"]);
  assert.equal(turn.mode, "realtime");
});

test("buildFinalizedTurn rejects incomplete exchanges", () => {
  assert.throws(() => buildFinalizedTurn({
    projectId: "project-1",
    trainingSessionId: "session-1",
    realtimeSessionId: "rt-1",
    turnIndex: 1,
    teacherRole: "strict",
    currentSlideId: null,
    currentKnowledgeNodeId: null,
    contextSnapshot: {},
    events: [
      {
        id: "event-1",
        eventType: "user.transcript.final",
        payload: { transcriptText: "只有用户输入" },
        createdAt: "2026-04-28T12:00:01.000Z",
      },
    ],
  }), /assistant response/u);
});
