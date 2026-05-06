import assert from "node:assert/strict";
import test from "node:test";
import { createRealtimeSessionRepository } from "./realtime-sessions.ts";

test("writes realtime session records with token and context snapshot", async () => {
  const executed: string[] = [];
  const repository = createRealtimeSessionRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.createSession({
    id: "rt-1",
    projectId: "project-1",
    trainingSessionId: "session-1",
    provider: "glm-realtime-flash",
    providerSessionId: null,
    status: "created",
    currentSlideId: "slide-2",
    currentKnowledgeNodeId: "node-9",
    currentPhase: "slide_intro",
    currentSlideIndex: 2,
    teacherRole: "strict",
    difficulty: "normal",
    contextSnapshot: { slideTitle: "系统架构" },
    clientTokenHash: "hash-1",
    tokenExpiresAt: "2026-04-28T12:20:00.000Z",
    startedAt: null,
    endedAt: null,
    createdAt: "2026-04-28T12:00:00.000Z",
    updatedAt: "2026-04-28T12:00:00.000Z",
  });

  assert.match(executed[0] ?? "", /"currentPhase"/u);
  assert.match(executed[0] ?? "", /"currentSlideIndex"/u);
  assert.match(executed[0] ?? "", /"clientTokenHash"/u);
  assert.match(executed[0] ?? "", /"tokenExpiresAt"/u);
  assert.match(executed[0] ?? "", /"contextSnapshot"/u);
});

test("writes realtime events with ordered metadata payloads", async () => {
  const executed: string[] = [];
  const repository = createRealtimeSessionRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.addEvent({
    id: "event-1",
    projectId: "project-1",
    trainingSessionId: "session-1",
    realtimeSessionId: "rt-1",
    turnId: null,
    sequence: 4,
    source: "provider",
    eventType: "response.done",
    payload: { responseId: "resp-1" },
    createdAt: "2026-04-28T12:00:10.000Z",
  });

  assert.match(executed[0] ?? "", /"sequence"/u);
  assert.match(executed[0] ?? "", /"eventType"/u);
  assert.match(executed[0] ?? "", /"payload"/u);
});

test("reads active realtime session and event list for a training session", async () => {
  const repository = createRealtimeSessionRepository(async (sql) => {
    if (sql.includes("\"RealtimeSession\" realtime_rows")) {
      return JSON.stringify({
        id: "rt-1",
        projectId: "project-1",
        trainingSessionId: "session-1",
        status: "active",
      });
    }
    if (sql.includes("FROM \"RealtimeEvent\" event_rows")) {
      return JSON.stringify([
        { id: "event-1", eventType: "response.done" },
      ]);
    }
    return "";
  });

  const activeSession = await repository.readActiveForTrainingSession("session-1");
  const events = await repository.listEvents("rt-1");

  assert.equal(activeSession?.id, "rt-1");
  assert.equal(events[0]?.id, "event-1");
});
