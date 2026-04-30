import { createServer } from "node:http";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import type { RealtimeEventRecord, RealtimeSessionRecord } from "@shared/domain";
import { buildFinalizedTurn } from "./turn-finalizer.ts";

type StoredRealtimeSession = RealtimeSessionRecord;

type RealtimeRepository = {
  readByToken(sessionId: string, tokenHash: string): Promise<StoredRealtimeSession | null>;
  updateSession(sessionId: string, patch: Partial<StoredRealtimeSession>): Promise<unknown>;
  addEvent(event: RealtimeEventRecord): Promise<unknown>;
};

type ServerDependencies = {
  port: number;
  providerFactory: () => WebSocket;
  realtimeRepository: RealtimeRepository;
  hashToken: (token: string) => string;
  finalizeTurn?: (payload: ReturnType<typeof buildFinalizedTurn>) => Promise<unknown>;
};

type AppClientEvent =
  | { type: "session.init"; realtimeSessionId: string; sessionToken: string }
  | { type: "input_text.submit"; text: string }
  | { type: "input_audio.append"; audioBase64: string; format?: string; sampleRate?: number }
  | { type: "input_audio.commit" }
  | { type: "context.update"; currentSlideId?: string | null; currentKnowledgeNodeId?: string | null; contextSnapshot?: Record<string, unknown> }
  | { type: "assistant.interrupt" }
  | { type: "session.end" };

type AppServer = {
  close(): Promise<void>;
};

type SessionState = {
  client: WebSocket;
  provider: WebSocket;
  persisted: StoredRealtimeSession;
  sequence: number;
  turnIndex: number;
  currentTurnEvents: Array<{
    id: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
};

export async function createDefenseRealtimeServer(deps: ServerDependencies): Promise<AppServer> {
  const httpServer = createServer();
  const webSocketServer = new WebSocketServer({ server: httpServer });

  webSocketServer.on("connection", (client: WebSocket) => {
    let state: SessionState | null = null;

    client.on("message", async (raw: RawData) => {
      try {
        const payload = JSON.parse(String(raw)) as AppClientEvent;

        if (payload.type === "session.init") {
          if (state) {
            sendToClient(client, { type: "error", code: "session_already_initialized" });
            return;
          }

          state = await initializeSession(client, payload, deps);
          return;
        }

        if (!state) {
          sendToClient(client, { type: "error", code: "session_not_initialized" });
          return;
        }

        await handleClientEvent(state, payload, deps);
      } catch (error) {
        sendToClient(client, {
          type: "error",
          code: "bad_request",
          message: error instanceof Error ? error.message : "Unknown realtime error.",
        });
      }
    });

    client.on("close", async () => {
      if (!state) return;
      try {
        state.provider.close();
      } finally {
        await deps.realtimeRepository.updateSession(state.persisted.id, {
          status: "failed",
          endedAt: new Date().toISOString(),
        });
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(deps.port, "127.0.0.1", () => resolve());
  });

  return {
    async close() {
      await new Promise<void>((resolve) => webSocketServer.close(() => resolve()));
      await new Promise<void>((resolve, reject) => httpServer.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

async function initializeSession(
  client: WebSocket,
  payload: Extract<AppClientEvent, { type: "session.init" }>,
  deps: ServerDependencies,
) {
  const tokenHash = deps.hashToken(payload.sessionToken);
  const persisted = await deps.realtimeRepository.readByToken(payload.realtimeSessionId, tokenHash);
  if (!persisted) {
    sendToClient(client, { type: "error", code: "unauthorized_realtime_session" });
    client.close();
    throw new Error("Realtime session authorization failed.");
  }

  const provider = deps.providerFactory();
  const state: SessionState = {
    client,
    provider,
    persisted,
    sequence: 0,
    turnIndex: 1,
    currentTurnEvents: [],
  };

  provider.on("open", async () => {
    await deps.realtimeRepository.updateSession(persisted.id, {
      status: "connecting",
      startedAt: new Date().toISOString(),
    });
    provider.send(JSON.stringify({
      type: "session.update",
      session: {
        instructions: buildProviderInstructions(persisted),
      },
    }));
  });

  provider.on("message", async (raw: RawData) => {
    await handleProviderEvent(state, raw, deps);
  });

  provider.on("close", async () => {
    await deps.realtimeRepository.updateSession(persisted.id, {
      status: "ended",
      endedAt: new Date().toISOString(),
    });
    if (client.readyState === WebSocket.OPEN) {
      sendToClient(client, { type: "session.state", status: "ended" });
    }
  });

  provider.on("error", (error: Error) => {
    sendToClient(client, {
      type: "error",
      code: "provider_connection_failed",
      message: error instanceof Error ? error.message : "Provider connection failed.",
    });
  });

  return state;
}

async function handleClientEvent(
  state: SessionState,
  payload: Exclude<AppClientEvent, { type: "session.init" }>,
  deps: ServerDependencies,
) {
  if (payload.type === "input_text.submit") {
    await recordEvent(state, deps, "client", payload.type, { text: payload.text });
    state.provider.send(JSON.stringify({
      type: "input_text.submit",
      text: payload.text,
    }));
    return;
  }

  if (payload.type === "input_audio.append") {
    await recordEvent(state, deps, "client", payload.type, {
      bytes: payload.audioBase64.length,
      format: payload.format ?? "pcm16",
      sampleRate: payload.sampleRate ?? 16_000,
    });
    state.provider.send(JSON.stringify({
      type: "input_audio_buffer.append",
      audio: payload.audioBase64,
    }));
    return;
  }

  if (payload.type === "input_audio.commit") {
    await recordEvent(state, deps, "client", payload.type, {});
    state.provider.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    return;
  }

  if (payload.type === "context.update") {
    state.persisted = {
      ...state.persisted,
      currentSlideId: payload.currentSlideId ?? state.persisted.currentSlideId,
      currentKnowledgeNodeId: payload.currentKnowledgeNodeId ?? state.persisted.currentKnowledgeNodeId,
      contextSnapshot: payload.contextSnapshot ?? state.persisted.contextSnapshot,
    };
    await deps.realtimeRepository.updateSession(state.persisted.id, {
      currentSlideId: state.persisted.currentSlideId,
      currentKnowledgeNodeId: state.persisted.currentKnowledgeNodeId,
      contextSnapshot: state.persisted.contextSnapshot,
    });
    sendToClient(state.client, {
      type: "session.state",
      status: state.persisted.status,
      currentSlideId: state.persisted.currentSlideId,
      currentKnowledgeNodeId: state.persisted.currentKnowledgeNodeId,
    });
    return;
  }

  if (payload.type === "assistant.interrupt") {
    await recordEvent(state, deps, "client", payload.type, {});
    state.provider.send(JSON.stringify({ type: "response.cancel" }));
    return;
  }

  if (payload.type === "session.end") {
    await deps.realtimeRepository.updateSession(state.persisted.id, {
      status: "draining",
      endedAt: new Date().toISOString(),
    });
    state.provider.close();
    state.client.close();
  }
}

async function handleProviderEvent(state: SessionState, raw: RawData, deps: ServerDependencies) {
  const payload = JSON.parse(String(raw)) as Record<string, unknown>;
  await recordEvent(state, deps, "provider", String(payload.type ?? "provider.event"), payload);

  if (payload.type === "session.created") {
    state.persisted = {
      ...state.persisted,
      providerSessionId: readNestedString(payload, "session", "id"),
      status: "active",
    };
    await deps.realtimeRepository.updateSession(state.persisted.id, {
      providerSessionId: state.persisted.providerSessionId,
      status: "active",
    });
    sendToClient(state.client, {
      type: "session.ready",
      realtimeSessionId: state.persisted.id,
      providerSessionId: state.persisted.providerSessionId,
    });
    return;
  }

  if (payload.type === "conversation.item.input_audio_transcription.completed") {
    const transcriptText = readString(payload, "transcript");
    if (!transcriptText) return;
    const event = makeLocalTurnEvent("user.transcript.final", { transcriptText });
    state.currentTurnEvents.push(event);
    sendToClient(state.client, {
      type: "user.transcript.final",
      transcriptText,
    });
    return;
  }

  if (payload.type === "response.audio_transcript.delta") {
    const delta = readString(payload, "delta");
    if (!delta) return;
    const event = makeLocalTurnEvent("assistant.text.delta", { delta });
    state.currentTurnEvents.push(event);
    sendToClient(state.client, {
      type: "assistant.text.delta",
      delta,
    });
    return;
  }

  if (payload.type === "response.done") {
    const transcriptText =
      readNestedString(payload, "response", "output_text") ??
      collapseAssistantDelta(state.currentTurnEvents);
    const responseId = readNestedString(payload, "response", "id");
    const traceId = readNestedString(payload, "response", "trace_id");
    const latencyMs = readNumber(payload, "latency_ms");

    const finalAssistantEvent = makeLocalTurnEvent("assistant.response.final", {
      transcriptText,
      responseId,
      traceId,
      latencyMs,
    });
    state.currentTurnEvents.push(finalAssistantEvent);

    sendToClient(state.client, {
      type: "assistant.response.final",
      transcriptText,
      responseId,
      traceId,
      latencyMs,
    });

    const finalizedPayload = buildFinalizedTurn({
      projectId: state.persisted.projectId,
      trainingSessionId: state.persisted.trainingSessionId,
      realtimeSessionId: state.persisted.id,
      turnIndex: state.turnIndex,
      teacherRole: state.persisted.teacherRole,
      currentSlideId: state.persisted.currentSlideId,
      currentKnowledgeNodeId: state.persisted.currentKnowledgeNodeId,
      contextSnapshot: state.persisted.contextSnapshot,
      events: state.currentTurnEvents,
    });

    const finalizedTurn = deps.finalizeTurn
      ? await deps.finalizeTurn(finalizedPayload)
      : finalizedPayload;

    sendToClient(state.client, {
      type: "turn.finalized",
      turn: finalizedTurn,
    });

    state.turnIndex += 1;
    state.currentTurnEvents = [];
  }
}

async function recordEvent(
  state: SessionState,
  deps: ServerDependencies,
  source: RealtimeEventRecord["source"],
  eventType: string,
  payload: Record<string, unknown>,
) {
  state.sequence += 1;
  await deps.realtimeRepository.addEvent({
    id: `rt-event-${crypto.randomUUID()}`,
    projectId: state.persisted.projectId,
    trainingSessionId: state.persisted.trainingSessionId,
    realtimeSessionId: state.persisted.id,
    turnId: null,
    sequence: state.sequence,
    source,
    eventType,
    payload,
    createdAt: new Date().toISOString(),
  });
}

function sendToClient(client: WebSocket, payload: Record<string, unknown>) {
  if (client.readyState !== WebSocket.OPEN) return;
  client.send(JSON.stringify(payload));
}

function buildProviderInstructions(session: StoredRealtimeSession) {
  const snapshot = session.contextSnapshot ?? {};
  const slideTitle = readString(snapshot, "slideTitle");
  const slideIndex = readNumber(snapshot, "slideIndex");
  return [
    "你是一位严谨但支持式的模拟答辩老师。",
    `老师角色：${session.teacherRole}。`,
    `训练难度：${session.difficulty}。`,
    slideTitle ? `当前页：第 ${slideIndex ?? "?"} 页《${slideTitle}》。` : null,
    `请围绕当前页面内容进行追问，优先追问证据链、设计取舍和个人负责范围。`,
  ]
    .filter(Boolean)
    .join("\n");
}

function makeLocalTurnEvent(eventType: string, payload: Record<string, unknown>) {
  return {
    id: `local-${crypto.randomUUID()}`,
    eventType,
    payload,
    createdAt: new Date().toISOString(),
  };
}

function collapseAssistantDelta(events: Array<{ eventType: string; payload: Record<string, unknown> }>) {
  return events
    .filter((event) => event.eventType === "assistant.text.delta")
    .map((event) => readString(event.payload, "delta"))
    .filter((value): value is string => Boolean(value))
    .join("");
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNestedString(
  record: Record<string, unknown>,
  parentKey: string,
  childKey: string,
) {
  const parent = record[parentKey];
  if (!parent || typeof parent !== "object" || Array.isArray(parent)) return null;
  const value = (parent as Record<string, unknown>)[childKey];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
