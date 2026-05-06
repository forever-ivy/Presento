import type { DefensePhase, TurnType } from "@shared/domain";
import type { TrainingTurnRecord } from "@db/repositories/training-sessions";

type RealtimeEventLike = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type FinalizerInput = {
  projectId: string;
  trainingSessionId: string;
  realtimeSessionId: string;
  turnIndex: number;
  turnType: TurnType;
  phaseBefore: DefensePhase;
  phaseAfter: DefensePhase;
  teacherRole: string;
  currentSlideId?: string | null;
  currentKnowledgeNodeId?: string | null;
  contextSnapshot: Record<string, unknown>;
  events: RealtimeEventLike[];
};

export function buildFinalizedTurn(input: FinalizerInput): TrainingTurnRecord {
  const userTranscriptEvent = [...input.events]
    .reverse()
    .find((event) => event.eventType === "user.transcript.final");
  const assistantResponseEvent = [...input.events]
    .reverse()
    .find((event) => event.eventType === "assistant.response.final");

  const inputTranscript = readString(userTranscriptEvent?.payload, "transcriptText");
  const assistantTranscript = readString(assistantResponseEvent?.payload, "transcriptText");

  if (!inputTranscript) {
    throw new Error("Cannot finalize realtime turn without a completed user transcript.");
  }

  if (!assistantTranscript) {
    throw new Error("Cannot finalize realtime turn without a completed assistant response.");
  }

  const slideIndex = readNumber(input.contextSnapshot, "slideIndex");
  const slideTitle = readString(input.contextSnapshot, "slideTitle");
  const retrievedSourceIds = readRetrievedSourceIds(input.contextSnapshot);
  const createdAt = assistantResponseEvent?.createdAt ?? userTranscriptEvent?.createdAt ?? new Date().toISOString();

  return {
    id: `turn-${crypto.randomUUID()}`,
    sessionId: input.trainingSessionId,
    projectId: input.projectId,
    realtimeSessionId: input.realtimeSessionId,
    turnIndex: input.turnIndex,
    turnType: input.turnType,
    phaseBefore: input.phaseBefore,
    phaseAfter: input.phaseAfter,
    slideId: input.currentSlideId ?? null,
    slideIndex,
    slideTitle,
    knowledgeNodeId: input.currentKnowledgeNodeId ?? null,
    teacherRole: input.teacherRole,
    userAnswer: inputTranscript,
    aiMessage: assistantTranscript,
    inputTranscript,
    assistantTranscript,
    providerResponseId: readString(assistantResponseEvent?.payload, "responseId"),
    providerTraceId: readString(assistantResponseEvent?.payload, "traceId"),
    latencyMs: readNumber(assistantResponseEvent?.payload, "latencyMs"),
    mode: "realtime",
    score: null,
    strengths: [],
    risks: [],
    improvedAnswer: null,
    followUps: [],
    slideFeedbackSummary: null,
    citations: [],
    retrievedSourceIds,
    speech: null,
    createdAt,
  };
}

function readString(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRetrievedSourceIds(contextSnapshot: Record<string, unknown>) {
  const items = contextSnapshot.retrievedSources;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : null))
    .filter((item): item is string => Boolean(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
