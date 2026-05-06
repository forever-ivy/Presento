import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import WebSocket, { WebSocketServer } from "ws";
import type { RealtimeSessionRecord } from "@shared/domain";
import { createDefenseRealtimeServer } from "./server.ts";

test("realtime server drives continuous defense phases and emits coach events around a finalized turn", async () => {
  const providerPort = await getFreePort();
  const serverPort = await getFreePort();
  const providerEvents: unknown[] = [];

  const providerWss = new WebSocketServer({ port: providerPort });
  providerWss.on("connection", (socket: WebSocket) => {
    socket.send(JSON.stringify({
      type: "session.created",
      session: { id: "glm-session-1" },
    }));
    socket.on("message", (raw: WebSocket.RawData) => {
      const payload = JSON.parse(String(raw));
      providerEvents.push(payload);

      if (payload.type === "session.update") {
        socket.send(JSON.stringify({
          type: "session.updated",
          session: { id: "glm-session-1" },
        }));
      }

      if (payload.type === "response.create") {
        socket.send(JSON.stringify({
          type: "conversation.item.input_audio_transcription.completed",
          transcript: "我负责订单接口和数据库状态流转。",
        }));
        socket.send(JSON.stringify({
          type: "response.text.delta",
          delta: "继续说明为什么 orders 和 order_items 要拆表。",
        }));
        socket.send(JSON.stringify({
          type: "response.done",
          response: {
            id: "resp-1",
            trace_id: "trace-1",
            output_text: "继续说明为什么 orders 和 order_items 要拆表。",
          },
          latency_ms: 432,
        }));
      }
    });
  });

  const storedEvents: unknown[] = [];
  let persistedStatus = "created";
  const realtimeRepository = {
    async readByToken(sessionId: string, tokenHash: string): Promise<RealtimeSessionRecord | null> {
      if (sessionId !== "rt-1" || tokenHash !== "hash-1") return null;
      return {
        id: "rt-1",
        projectId: "project-1",
        trainingSessionId: "session-1",
        provider: "glm-realtime-flash" as const,
        providerSessionId: null,
        status: persistedStatus as RealtimeSessionRecord["status"],
        currentSlideId: "slide-2",
        currentKnowledgeNodeId: "node-9",
        currentPhase: "idle",
        currentSlideIndex: 2,
        teacherRole: "strict",
        difficulty: "normal",
        contextSnapshot: {
          projectName: "Presento",
          slideTitle: "系统架构",
          slideIndex: 2,
          slideGoal: "讲清系统主流程",
          followUpBudget: 1,
          retrievedSources: [{ id: "README.md:1-3" }],
        },
        clientTokenHash: "hash-1",
        tokenExpiresAt: "2099-01-01T00:00:00.000Z",
        startedAt: null,
        endedAt: null,
        createdAt: "2026-04-28T12:00:00.000Z",
        updatedAt: "2026-04-28T12:00:00.000Z",
      };
    },
    async updateSession(_id: string, patch: Record<string, unknown>) {
      if (typeof patch.status === "string") persistedStatus = patch.status;
      return patch;
    },
    async addEvent(event: unknown) {
      storedEvents.push(event);
      return event;
    },
  };

  let finalizedTurn: unknown = null;
  const server = await createDefenseRealtimeServer({
    port: serverPort,
    providerFactory: () => new WebSocket(`ws://127.0.0.1:${providerPort}`),
    realtimeRepository,
    hashToken: (token) => token === "session-token" ? "hash-1" : "bad-hash",
    finalizeTurn: async (payload) => {
      finalizedTurn = payload;
      return {
        ...payload,
        id: "turn-1",
      };
    },
  });

  const messages: Array<Record<string, unknown>> = [];
  const client = new WebSocket(`ws://127.0.0.1:${serverPort}`);
  await new Promise<void>((resolve, reject) => {
    client.once("open", resolve);
    client.once("error", reject);
  });

  client.on("message", (raw: WebSocket.RawData) => {
    messages.push(JSON.parse(String(raw)) as Record<string, unknown>);
  });

  client.send(JSON.stringify({
    type: "session.init",
    realtimeSessionId: "rt-1",
    sessionToken: "session-token",
  }));

  await waitFor(() => messages.some((item) => item.type === "session.ready"));

  client.send(JSON.stringify({
    type: "session.begin",
  }));

  await waitFor(() => messages.some((item) => item.type === "coach.slide_intro"));

  client.send(JSON.stringify({
    type: "presentation.commit",
    text: "我负责订单接口和数据库状态流转。",
  }));

  await waitFor(() => messages.some((item) => item.type === "coach.followup"));
  await waitFor(() => messages.some((item) => item.type === "turn.finalized"));

  assert.equal(messages.some((item) => item.type === "assistant.response.final"), true);
  assert.equal(messages.some((item) => item.type === "coach.opening"), true);
  assert.equal(messages.some((item) => item.type === "coach.slide_intro"), true);
  assert.equal(messages.some((item) => item.type === "coach.followup"), true);
  assert.equal(
    storedEvents.some((item) =>
      isRecord(item)
      && item.eventType === "input_text.fallback"
    ),
    true,
  );
  assert.equal(Array.isArray(providerEvents), true);
  assert.equal(storedEvents.length > 0, true);
  assert.equal((finalizedTurn as { providerResponseId?: string } | null)?.providerResponseId, "text-fallback-1");
  assert.equal((finalizedTurn as { turnType?: string } | null)?.turnType, "presentation");
  assert.equal((finalizedTurn as { phaseBefore?: string } | null)?.phaseBefore, "user_presenting");
  assert.equal((finalizedTurn as { phaseAfter?: string } | null)?.phaseAfter, "teacher_followup");

  client.close();
  await server.close();
  await new Promise<void>((resolve) => providerWss.close(() => resolve()));
});

async function getFreePort() {
  const { createServer } = await import("node:net");
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to allocate port."));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitFor(assertion: () => boolean, timeoutMs = 2_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (assertion()) return;
    await delay(20);
  }
  throw new Error("Condition timed out.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
