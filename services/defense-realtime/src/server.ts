import { createServer } from "node:http";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import type {
  DefensePhase,
  RealtimeBusinessClientEvent,
  RealtimeEventRecord,
  RealtimeSessionRecord,
  TurnType,
} from "@shared/domain";
import { getNextPhaseAfterTurn, getTurnTypeForCommit } from "../../../src/lib/defense-session-machine.ts";
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

type TransportClientEvent =
  | { type: "session.init"; realtimeSessionId: string; sessionToken: string }
  | { type: "input_text.submit"; text: string }
  | { type: "input_audio.append"; audioBase64: string; format?: string; sampleRate?: number }
  | { type: "input_audio.commit" }
  | {
      type: "context.update";
      currentSlideId?: string | null;
      currentSlideIndex?: number | null;
      currentKnowledgeNodeId?: string | null;
      currentPhase?: DefensePhase;
      contextSnapshot?: Record<string, unknown>;
    }
  | { type: "assistant.interrupt" }
  | { type: "session.end" };

type AppClientEvent =
  | TransportClientEvent
  | RealtimeBusinessClientEvent;

type AppServer = {
  close(): Promise<void>;
};

type LocalTurnEvent = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type SessionState = {
  client: WebSocket;
  provider: WebSocket;
  persisted: StoredRealtimeSession;
  sequence: number;
  turnIndex: number;
  currentTurnEvents: LocalTurnEvent[];
  assistantResponding: boolean;
  pendingTurnType: TurnType | null;
  pendingPhaseBefore: DefensePhase | null;
  pendingPhaseAfter: DefensePhase | null;
  finalQuestionLimit: number;
  closingIntent: boolean;
};

type FinalizedTurnWithPatch = ReturnType<typeof buildFinalizedTurn> & {
  followUps?: unknown;
  sessionPatch?: Record<string, unknown>;
  slideFeedbackSummary?: string | null;
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
        if (!state.closingIntent) {
          await deps.realtimeRepository.updateSession(state.persisted.id, {
            status: "failed",
            currentPhase: "failed",
            endedAt: new Date().toISOString(),
          });
        }
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
      await new Promise<void>((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve()))
      );
    },
  };
}

async function initializeSession(
  client: WebSocket,
  payload: Extract<TransportClientEvent, { type: "session.init" }>,
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
    assistantResponding: false,
    pendingTurnType: null,
    pendingPhaseBefore: null,
    pendingPhaseAfter: null,
    finalQuestionLimit: 3,
    closingIntent: false,
  };

  provider.on("open", async () => {
    const startedAt = new Date().toISOString();
    await updatePersistedSession(state, deps, {
      status: "connecting",
      startedAt,
    });
  });

  provider.on("message", async (raw: RawData) => {
    try {
      await handleProviderEvent(state, raw, deps);
    } catch (error) {
      await recordEvent(state, deps, "system", "realtime.server_error", {
        message: error instanceof Error ? error.message : "Unknown realtime server error.",
      }).catch(() => undefined);
      sendToClient(client, {
        type: "error",
        code: "realtime_server_error",
        message: error instanceof Error ? error.message : "Unknown realtime server error.",
      });
      await updatePersistedSession(state, deps, {
        status: "failed",
        currentPhase: "failed",
        endedAt: new Date().toISOString(),
      }).catch(() => undefined);
      sendSessionState(state);
    }
  });

  provider.on("close", async (code: number, reason: Buffer) => {
    if (!state.closingIntent) {
      await recordEvent(state, deps, "provider", "provider.close", {
        code,
        reason: reason.toString("utf8"),
      });
      await updatePersistedSession(state, deps, {
        status: "failed",
        currentPhase: "failed",
        endedAt: new Date().toISOString(),
      });
      sendToClient(client, {
        type: "error",
        code: "provider_connection_closed",
        message: "Realtime provider closed the session.",
      });
    }
    if (client.readyState === WebSocket.OPEN) {
      sendSessionState(state);
      if (!state.closingIntent) {
        client.close(1011, "provider_closed");
      }
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
  if (payload.type === "session.begin") {
    await recordEvent(state, deps, "client", payload.type, {});
    await emitOpeningSequence(state, deps);
    return;
  }

  if (payload.type === "slide.start") {
    await recordEvent(state, deps, "client", payload.type, {
      currentSlideId: payload.currentSlideId ?? state.persisted.currentSlideId ?? null,
      currentSlideIndex: payload.currentSlideIndex ?? state.persisted.currentSlideIndex,
    });
    await updatePersistedSession(state, deps, {
      currentPhase: "slide_intro",
      currentSlideId: payload.currentSlideId ?? state.persisted.currentSlideId ?? null,
      currentSlideIndex: payload.currentSlideIndex ?? state.persisted.currentSlideIndex,
      currentKnowledgeNodeId:
        payload.currentKnowledgeNodeId ?? state.persisted.currentKnowledgeNodeId ?? null,
    });
    sendProviderInstructions(state);
    sendSessionState(state);
    await emitCoachEvent(state, deps, {
      type: "coach.slide_intro",
      phase: state.persisted.currentPhase,
      slideId: state.persisted.currentSlideId,
      slideIndex: state.persisted.currentSlideIndex,
      message: buildSlideIntroMessage(state.persisted),
    });
    return;
  }

  if (payload.type === "final_questions.begin") {
    await recordEvent(state, deps, "client", payload.type, {});
    await updatePersistedSession(state, deps, {
      currentPhase: "final_questions",
      contextSnapshot: {
        ...state.persisted.contextSnapshot,
        finalQuestionIndex: 0,
      },
    });
    sendProviderInstructions(state);
    sendSessionState(state);
    await emitCoachEvent(state, deps, {
      type: "coach.final_questions_intro",
      phase: "final_questions",
      message: "PPT 部分已经讲完。下面进入综合追问，我会连续从整体价值、个人贡献和设计取舍三个方向施压。",
    });
    await emitCoachEvent(state, deps, {
      type: "coach.followup",
      phase: "final_questions",
      turnType: "final_question",
      finalQuestionIndex: 0,
      message: buildFinalQuestionPrompt(0, state.persisted),
    });
    return;
  }

  if (payload.type === "presentation.commit" || payload.type === "followup.answer.commit") {
    const turnType = getTurnTypeForCommit(payload.type);
    const phaseBefore = turnType === "presentation" ? "user_presenting" : "user_answering";
    await preparePendingTurn(state, turnType, phaseBefore);
    await recordEvent(state, deps, "client", payload.type, {
      text: payload.text ?? null,
    });
    await submitCommitPayload(state, payload.text, deps);
    return;
  }

  if (payload.type === "session.finish") {
    await recordEvent(state, deps, "client", payload.type, {});
    await closeSession(state, deps, true);
    return;
  }

  if (payload.type === "input_text.submit") {
    await preparePendingTurn(state, inferTurnTypeFromPhase(state.persisted.currentPhase), state.persisted.currentPhase);
    await recordEvent(state, deps, "client", payload.type, { text: payload.text });
    appendUserTranscript(state, payload.text);
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
    await preparePendingTurn(state, inferTurnTypeFromPhase(state.persisted.currentPhase), state.persisted.currentPhase);
    await recordEvent(state, deps, "client", payload.type, {});
    state.provider.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    return;
  }

  if (payload.type === "context.update") {
    await updatePersistedSession(state, deps, {
      currentPhase: payload.currentPhase ?? state.persisted.currentPhase,
      currentSlideId: payload.currentSlideId ?? state.persisted.currentSlideId,
      currentSlideIndex: payload.currentSlideIndex ?? state.persisted.currentSlideIndex,
      currentKnowledgeNodeId: payload.currentKnowledgeNodeId ?? state.persisted.currentKnowledgeNodeId,
      contextSnapshot: payload.contextSnapshot ?? state.persisted.contextSnapshot,
    });
    sendProviderInstructions(state);
    sendSessionState(state);
    return;
  }

  if (payload.type === "assistant.interrupt") {
    await recordEvent(state, deps, "client", payload.type, {});
    state.assistantResponding = false;
    state.provider.send(JSON.stringify({ type: "response.cancel" }));
    sendSessionState(state);
    return;
  }

  if (payload.type === "session.end") {
    await closeSession(state, deps, false);
  }
}

async function handleProviderEvent(state: SessionState, raw: RawData, deps: ServerDependencies) {
  const payload = JSON.parse(String(raw)) as Record<string, unknown>;
  await recordEvent(state, deps, "provider", String(payload.type ?? "provider.event"), payload);

  if (payload.type === "error") {
    const errorPayload = isRecord(payload.error) ? payload.error : payload;
    sendToClient(state.client, {
      type: "error",
      code: readString(errorPayload, "code") ?? "provider_error",
      message: readString(errorPayload, "message") ?? "Realtime provider returned an error.",
    });
    sendSessionState(state);
    return;
  }

  if (payload.type === "session.created") {
    await updatePersistedSession(state, deps, {
      providerSessionId: readNestedString(payload, "session", "id"),
      status: "active",
    });
    sendProviderInstructions(state);
    sendToClient(state.client, {
      type: "session.ready",
      realtimeSessionId: state.persisted.id,
      providerSessionId: state.persisted.providerSessionId,
    });
    sendSessionState(state);
    return;
  }

  if (payload.type === "conversation.item.input_audio_transcription.completed") {
    const transcriptText = readString(payload, "transcript");
    if (!transcriptText) return;
    appendUserTranscript(state, transcriptText);
    sendToClient(state.client, {
      type: "user.transcript.final",
      transcriptText,
    });
    return;
  }

  if (payload.type === "response.text.delta" || payload.type === "response.audio_transcript.delta") {
    const delta = readString(payload, "delta");
    if (!delta) return;
    state.assistantResponding = true;
    const event = makeLocalTurnEvent("assistant.text.delta", { delta });
    state.currentTurnEvents.push(event);
    sendToClient(state.client, {
      type: "assistant.text.delta",
      delta,
    });
    sendSessionState(state);
    return;
  }

  if (payload.type === "response.text.done" || payload.type === "response.audio_transcript.done") {
    const finalText = readString(payload, "text") ?? readString(payload, "transcript");
    if (!finalText || hasAssistantTextDelta(state)) return;
    state.currentTurnEvents.push(makeLocalTurnEvent("assistant.text.delta", { delta: finalText }));
    sendToClient(state.client, {
      type: "assistant.text.delta",
      delta: finalText,
    });
    sendSessionState(state);
    return;
  }

  if (payload.type === "response.done") {
    state.assistantResponding = false;
    const providerTranscript =
      readNestedString(payload, "response", "output_text") ??
      collapseAssistantDelta(state.currentTurnEvents);
    const transcriptText = providerTranscript || buildFallbackAssistantTranscript(state);
    const responseId = readNestedString(payload, "response", "id");
    const traceId = readNestedString(payload, "response", "trace_id");
    const latencyMs = readNumber(payload, "latency_ms");

    await finalizeCurrentTurn(state, deps, {
      transcriptText,
      responseId,
      traceId,
      latencyMs,
    });
  }
}

async function submitCommitPayload(
  state: SessionState,
  text: string | undefined,
  deps: ServerDependencies,
) {
  if (text && text.trim()) {
    appendUserTranscript(state, text);
    await recordEvent(state, deps, "system", "input_text.fallback", {
      reason: "glm_realtime_text_input_empty_response",
    });
    await finalizeCurrentTurn(state, deps, {
      transcriptText: buildFallbackAssistantTranscript(state),
      responseId: `text-fallback-${state.turnIndex}`,
      traceId: null,
      latencyMs: null,
    });
    return;
  }

  await recordEvent(state, deps, "system", "input_audio.commit.forwarded", {});
  state.provider.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
  state.provider.send(JSON.stringify({ type: "response.create" }));
}

async function finalizeCurrentTurn(
  state: SessionState,
  deps: ServerDependencies,
  input: {
    transcriptText: string;
    responseId?: string | null;
    traceId?: string | null;
    latencyMs?: number | null;
  },
) {
  state.assistantResponding = false;
  const finalAssistantEvent = makeLocalTurnEvent("assistant.response.final", {
    transcriptText: input.transcriptText,
    responseId: input.responseId,
    traceId: input.traceId,
    latencyMs: input.latencyMs,
  });
  state.currentTurnEvents.push(finalAssistantEvent);

  sendToClient(state.client, {
    type: "assistant.response.final",
    transcriptText: input.transcriptText,
    responseId: input.responseId,
    traceId: input.traceId,
    latencyMs: input.latencyMs,
  });

  const turnType = state.pendingTurnType ?? inferTurnTypeFromPhase(state.persisted.currentPhase);
  const phaseBefore = state.pendingPhaseBefore ?? state.persisted.currentPhase;
  const phaseAfter = state.pendingPhaseAfter ?? getNextPhaseAfterTurn({
    currentPhase: state.persisted.currentPhase,
    turnType,
    finalQuestionIndex: readFinalQuestionIndex(state.persisted.contextSnapshot),
    finalQuestionLimit: state.finalQuestionLimit,
  });

  const finalizedPayload = buildFinalizedTurn({
    projectId: state.persisted.projectId,
    trainingSessionId: state.persisted.trainingSessionId,
    realtimeSessionId: state.persisted.id,
    turnIndex: state.turnIndex,
    turnType,
    phaseBefore,
    phaseAfter,
    teacherRole: state.persisted.teacherRole,
    currentSlideId: state.persisted.currentSlideId,
    currentKnowledgeNodeId: state.persisted.currentKnowledgeNodeId,
    contextSnapshot: state.persisted.contextSnapshot,
    events: state.currentTurnEvents,
  });

  const finalizedTurn = deps.finalizeTurn
    ? await deps.finalizeTurn(finalizedPayload)
    : finalizedPayload;
  const finalizedWithPatch = finalizedTurn as FinalizedTurnWithPatch;

  if (isRecord(finalizedWithPatch.sessionPatch)) {
    await updatePersistedSession(state, deps, finalizedWithPatch.sessionPatch as Partial<StoredRealtimeSession>);
  } else {
    await updatePersistedSession(state, deps, {
      currentPhase: phaseAfter,
    });
  }

  if (turnType === "final_question") {
    await updatePersistedSession(state, deps, {
      contextSnapshot: {
        ...state.persisted.contextSnapshot,
        finalQuestionIndex: readFinalQuestionIndex(state.persisted.contextSnapshot) + 1,
      },
    });
  }

  sendToClient(state.client, {
    type: "turn.finalized",
    turn: {
      ...finalizedWithPatch,
      turnType,
      phaseBefore,
      phaseAfter,
    },
  });

  await emitPostTurnCoachEvent(state, deps, {
    transcriptText: input.transcriptText,
    turnType,
    phaseAfter,
    followUps: Array.isArray(finalizedWithPatch.followUps)
      ? finalizedWithPatch.followUps.filter((item): item is string => typeof item === "string")
      : [],
    slideFeedbackSummary: finalizedWithPatch.slideFeedbackSummary ?? null,
  });

  state.turnIndex += 1;
  state.currentTurnEvents = [];
  state.pendingTurnType = null;
  state.pendingPhaseBefore = null;
  state.pendingPhaseAfter = null;
  sendSessionState(state);
}

async function preparePendingTurn(
  state: SessionState,
  turnType: TurnType,
  phaseBefore: DefensePhase,
) {
  const phaseAfter = getNextPhaseAfterTurn({
    currentPhase: state.persisted.currentPhase,
    turnType,
    finalQuestionIndex: readFinalQuestionIndex(state.persisted.contextSnapshot),
    finalQuestionLimit: state.finalQuestionLimit,
  });
  state.pendingTurnType = turnType;
  state.pendingPhaseBefore = phaseBefore;
  state.pendingPhaseAfter = phaseAfter;
  await updatePersistedSessionFromMemory(state, {
    currentPhase: phaseBefore,
  });
  sendProviderInstructions(state);
  sendSessionState(state);
}

async function emitOpeningSequence(state: SessionState, deps: ServerDependencies) {
  await updatePersistedSession(state, deps, {
    currentPhase: "opening",
  });
  sendProviderInstructions(state);
  sendSessionState(state);
  await emitCoachEvent(state, deps, {
    type: "coach.opening",
    phase: "opening",
    message: buildOpeningMessage(state.persisted),
  });

  await updatePersistedSession(state, deps, {
    currentPhase: "slide_intro",
  });
  sendProviderInstructions(state);
  sendSessionState(state);
  await emitCoachEvent(state, deps, {
    type: "coach.slide_intro",
    phase: "slide_intro",
    slideId: state.persisted.currentSlideId,
    slideIndex: state.persisted.currentSlideIndex,
    message: buildSlideIntroMessage(state.persisted),
  });
}

async function emitPostTurnCoachEvent(
  state: SessionState,
  deps: ServerDependencies,
  input: {
    transcriptText: string | null;
    turnType: TurnType;
    phaseAfter: DefensePhase;
    followUps: string[];
    slideFeedbackSummary: string | null;
  },
) {
  if (input.turnType === "presentation") {
    await emitCoachEvent(state, deps, {
      type: "coach.followup",
      phase: "teacher_followup",
      turnType: "presentation",
      followupCount: readFollowupBudget(state.persisted.contextSnapshot),
      message: input.followUps[0] ?? input.transcriptText ?? "继续解释你刚才提到的关键实现和材料支撑。",
    });
    return;
  }

  if (input.turnType === "followup_answer") {
    await emitCoachEvent(state, deps, {
      type: "coach.slide_feedback",
      phase: "slide_feedback",
      slideId: state.persisted.currentSlideId,
      slideIndex: state.persisted.currentSlideIndex,
      message: input.slideFeedbackSummary ?? input.transcriptText ?? "这一页先到这里，下一页继续讲。",
      summary: input.slideFeedbackSummary,
    });
    return;
  }

  if (input.phaseAfter === "finishing") {
    await emitCoachEvent(state, deps, {
      type: "coach.session_finished",
      phase: "finishing",
      message: input.transcriptText ?? "本轮模拟答辩结束，现在可以生成整场复盘。",
    });
    return;
  }

  await emitCoachEvent(state, deps, {
    type: "coach.followup",
    phase: "final_questions",
    turnType: "final_question",
    finalQuestionIndex: readFinalQuestionIndex(state.persisted.contextSnapshot) + 1,
    message: input.transcriptText ?? buildFinalQuestionPrompt(readFinalQuestionIndex(state.persisted.contextSnapshot) + 1, state.persisted),
  });
}

async function closeSession(
  state: SessionState,
  deps: ServerDependencies,
  fromBusinessFinish: boolean,
) {
  state.closingIntent = true;
  await recordEvent(state, deps, "client", fromBusinessFinish ? "session.finish" : "session.end", {});
  await updatePersistedSession(state, deps, {
    status: "draining",
    currentPhase: "finishing",
    endedAt: new Date().toISOString(),
  });
  state.provider.close();
  state.client.close();
}

async function updatePersistedSession(
  state: SessionState,
  deps: ServerDependencies,
  patch: Partial<StoredRealtimeSession>,
) {
  await updatePersistedSessionFromMemory(state, patch);
  await deps.realtimeRepository.updateSession(state.persisted.id, patch);
}

async function updatePersistedSessionFromMemory(
  state: SessionState,
  patch: Partial<StoredRealtimeSession>,
) {
  state.persisted = {
    ...state.persisted,
    ...patch,
    contextSnapshot: patch.contextSnapshot ?? state.persisted.contextSnapshot,
  };
}

async function emitCoachEvent(
  state: SessionState,
  deps: ServerDependencies,
  payload: Record<string, unknown>,
) {
  await recordEvent(state, deps, "system", String(payload.type ?? "coach.event"), payload);
  sendToClient(state.client, payload);
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

function sendSessionState(state: SessionState) {
  sendToClient(state.client, {
    type: "session.state",
    status: state.persisted.status,
    phase: state.persisted.currentPhase,
    slideId: state.persisted.currentSlideId,
    slideIndex: state.persisted.currentSlideIndex,
    followupCount: readFollowupBudget(state.persisted.contextSnapshot),
    canInterrupt: state.assistantResponding,
    canAdvance: state.persisted.currentPhase === "slide_feedback" || state.persisted.currentPhase === "review_ready",
    reconnecting: false,
  });
}

function sendToClient(client: WebSocket, payload: Record<string, unknown>) {
  if (client.readyState !== WebSocket.OPEN) return;
  client.send(JSON.stringify(payload));
}

function sendProviderInstructions(state: SessionState) {
  if (state.provider.readyState !== WebSocket.OPEN) return;
  state.provider.send(JSON.stringify({
    type: "session.update",
    event_id: `session-update-${crypto.randomUUID()}`,
    client_timestamp: Date.now(),
    session: {
      model: "glm-realtime-flash",
      modalities: ["audio", "text"],
      instructions: buildProviderInstructions(state.persisted),
      voice: "tongtong",
      input_audio_format: "pcm16",
      output_audio_format: "pcm",
      input_audio_noise_reduction: {
        type: "near_field",
      },
      temperature: 0.2,
      max_response_output_tokens: "512",
      beta_fields: {
        chat_mode: "audio",
        tts_source: "e2e",
        auto_search: false,
      },
    },
  }));
}

function buildProviderInstructions(session: StoredRealtimeSession) {
  const snapshot = session.contextSnapshot ?? {};
  const slideTitle = readString(snapshot, "slideTitle");
  const slideGoal = readString(snapshot, "slideGoal");
  const slideIndex = readNumber(snapshot, "slideIndex");
  const previousSlideFeedback = readString(snapshot, "previousSlideFeedback");
  const cueKeywords = Array.isArray(snapshot.cueKeywords)
    ? snapshot.cueKeywords.filter((item): item is string => typeof item === "string")
    : [];
  const seedQuestions = Array.isArray(snapshot.seedQuestions)
    ? snapshot.seedQuestions
        .map((item) => isRecord(item) && typeof item.text === "string" ? item.text.trim() : "")
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return [
    "你是一位严谨但支持式的模拟答辩老师。",
    `老师角色：${session.teacherRole}。`,
    `训练难度：${session.difficulty}。`,
    `当前阶段：${session.currentPhase}。`,
    slideTitle ? `当前页：第 ${slideIndex ?? session.currentSlideIndex ?? "?"} 页《${slideTitle}》。` : null,
    slideGoal ? `本页目标：${slideGoal}` : null,
    previousSlideFeedback ? `上一页提醒：${previousSlideFeedback}` : null,
    cueKeywords.length ? `优先围绕这些关键词追问：${cueKeywords.join(" / ")}` : null,
    seedQuestions.length ? `用户已加入本轮训练的高危追问：${seedQuestions.join(" / ")}` : null,
    session.currentPhase === "user_presenting"
      ? "用户正在讲这一页。请在收到输入后只追问 1 个最关键的问题，优先使用用户已加入训练的高危追问；如果没有合适问题，再聚焦设计取舍、项目材料支撑或个人负责范围。"
      : null,
    session.currentPhase === "user_answering"
      ? "用户正在回答追问。请在收到输入后给出简短本页反馈，指出讲清楚了什么、风险点和下一页提醒，不要再追加新问题。"
      : null,
    session.currentPhase === "final_questions"
      ? "当前进入综合追问阶段。请在收到用户回答后继续提出下一个全局追问，保持简洁和压力感。"
      : null,
    "不要输出参考答案，不要离开当前阶段，不要把自己变成普通聊天机器人。",
  ]
    .filter(Boolean)
    .join("\n");
}

function appendUserTranscript(state: SessionState, transcriptText: string) {
  const event = makeLocalTurnEvent("user.transcript.final", { transcriptText });
  state.currentTurnEvents.push(event);
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

function hasAssistantTextDelta(state: SessionState) {
  return state.currentTurnEvents.some((event) => event.eventType === "assistant.text.delta");
}

function buildFallbackAssistantTranscript(state: SessionState) {
  const snapshot = state.persisted.contextSnapshot ?? {};
  const slideTitle = readString(snapshot, "slideTitle") ?? "当前页";
  const cueKeywords = Array.isArray(snapshot.cueKeywords)
    ? snapshot.cueKeywords.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const seedQuestion = Array.isArray(snapshot.seedQuestions)
    ? snapshot.seedQuestions
        .map((item) => isRecord(item) && typeof item.text === "string" ? item.text.trim() : "")
        .find(Boolean)
    : null;
  const turnType = state.pendingTurnType ?? inferTurnTypeFromPhase(state.persisted.currentPhase);

  if (turnType === "final_question") {
    return buildFinalQuestionPrompt(readFinalQuestionIndex(snapshot) + 1, state.persisted);
  }

  if (turnType === "followup_answer") {
    return `这一页先收住。请把《${slideTitle}》对应的资料依据、实现边界和个人负责范围再压实，下一页继续按“结论、证据、职责”来讲。`;
  }

  if (seedQuestion) return seedQuestion;

  const focus = cueKeywords[0] ?? slideTitle;
  return `你刚才提到了“${focus}”。请继续说明它在项目材料或代码里对应哪一处，以及这部分是不是你本人负责。`;
}

function buildOpeningMessage(session: StoredRealtimeSession) {
  const snapshot = session.contextSnapshot ?? {};
  const projectName = readString(snapshot, "projectName") ?? "当前项目";
  const focusNodeCount = Array.isArray(snapshot.focusKnowledgeNodes) ? snapshot.focusKnowledgeNodes.length : 0;
  return [
    `我是本轮《${projectName}》模拟答辩老师。`,
    "接下来我们会按 PPT 顺序完成一轮连续讲练。",
    `本轮难度为${session.difficulty}，老师风格为${session.teacherRole}。`,
    focusNodeCount ? `我会重点盯住 ${focusNodeCount} 个讲练重点和你的个人负责范围。` : null,
    "请先从当前页开始介绍，讲完后我会追问。",
  ]
    .filter(Boolean)
    .join("");
}

function buildSlideIntroMessage(session: StoredRealtimeSession) {
  const snapshot = session.contextSnapshot ?? {};
  const slideTitle = readString(snapshot, "slideTitle") ?? "当前页";
  const slideGoal = readString(snapshot, "slideGoal");
  const slideIndex = readNumber(snapshot, "slideIndex") ?? session.currentSlideIndex;
  return [
    `现在进入第 ${slideIndex || "?"} 页《${slideTitle}》。`,
    slideGoal ? `请你围绕“${slideGoal}”来讲，先讲主结论，再补材料支撑和个人负责范围。` : "请开始讲这一页。",
  ].join("");
}

function buildFinalQuestionPrompt(index: number, session: StoredRealtimeSession) {
  const memberScope = readString(session.contextSnapshot ?? {}, "memberScope");
  const prompts = [
    "如果老师质疑这个项目只是套壳 AI，你会怎么证明它有真正的系统设计和工程价值？",
    memberScope
      ? `如果老师追问“你的个人贡献到底是什么”，你会怎么围绕“${memberScope}”回答？`
      : "如果老师追问你的个人贡献到底是什么，你会怎么回答？",
    "如果让你用一句话概括 Presento 和普通 AI PPT 工具的差异，你会怎么讲？",
  ];
  return prompts[index] ?? prompts[prompts.length - 1];
}

function inferTurnTypeFromPhase(phase: DefensePhase): TurnType {
  if (phase === "final_questions") return "final_question";
  if (phase === "teacher_followup" || phase === "user_answering") return "followup_answer";
  return "presentation";
}

function readFollowupBudget(contextSnapshot: Record<string, unknown>) {
  const value = contextSnapshot.followUpBudget;
  return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

function readFinalQuestionIndex(contextSnapshot: Record<string, unknown>) {
  const value = contextSnapshot.finalQuestionIndex;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
