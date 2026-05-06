import { createRealtimeSessionRepository } from "@db/repositories/realtime-sessions";
import { createTrainingSessionRepository, type TrainingTurnRecord } from "@db/repositories/training-sessions";
import type { DefensePhase } from "@shared/domain";
import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { createDefenseTurnUIMessageStream } from "@/lib/defense-session-stream";
import { getNextPhaseAfterTurn, getTurnTypeForCommit } from "@/lib/defense-session-machine";
import { finalizeRealtimeTurnAndAnalyze } from "@/lib/realtime-training";
import { apiError, notFound } from "../../../../../../_utils";

export const runtime = "nodejs";

const defensePhaseValues = [
  "idle",
  "initializing",
  "opening",
  "slide_intro",
  "user_presenting",
  "teacher_followup",
  "user_answering",
  "slide_feedback",
  "slide_transition",
  "final_questions",
  "finishing",
  "review_ready",
  "finished",
  "failed",
] as const;

const voiceTurnPayloadSchema = z.object({
  commitType: z.enum(["presentation.commit", "followup.answer.commit"]),
  phaseBefore: z.enum(defensePhaseValues).optional(),
  realtimeSessionId: z.string().min(1),
  transcript: z.string().trim().min(1).max(60_000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const payload = voiceTurnPayloadSchema.parse(await request.json().catch(() => ({})));
    const trainingRepository = createTrainingSessionRepository();
    const realtimeRepository = createRealtimeSessionRepository();
    const [sessionResult, realtimeSession] = await Promise.all([
      trainingRepository.readSession(sessionId),
      realtimeRepository.readSession(payload.realtimeSessionId),
    ]);

    if (!sessionResult.session || sessionResult.session.projectId !== projectId) {
      return notFound("Training session");
    }
    if (
      !realtimeSession
      || realtimeSession.projectId !== projectId
      || realtimeSession.trainingSessionId !== sessionId
    ) {
      return notFound("Realtime session");
    }

    const phaseBefore = payload.phaseBefore ?? realtimeSession.currentPhase ?? sessionResult.session.currentPhase;
    const turnType = phaseBefore === "final_questions"
      ? "final_question"
      : getTurnTypeForCommit(payload.commitType);
    const phaseAfter = getNextPhaseAfterTurn({
      currentPhase: phaseBefore,
      finalQuestionIndex: sessionResult.session.finalQuestionIndex,
      finalQuestionLimit: 3,
      turnType,
    });
    const contextSnapshot = readRecord(realtimeSession.contextSnapshot);
    const slideIndex = readNumber(contextSnapshot, "slideIndex")
      ?? realtimeSession.currentSlideIndex
      ?? sessionResult.session.currentSlideIndex
      ?? null;
    const slideTitle = readString(contextSnapshot, "slideTitle")
      ?? `第 ${slideIndex ?? 1} 页`;
    const retrievedSourceIds = readRetrievedSourceIds(contextSnapshot);
    const turnId = `turn-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const turnDraft: TrainingTurnRecord = {
      id: turnId,
      sessionId,
      projectId,
      realtimeSessionId: realtimeSession.id,
      turnIndex: sessionResult.turns.length + 1,
      turnType,
      phaseBefore,
      phaseAfter,
      slideId: realtimeSession.currentSlideId ?? sessionResult.session.currentSlideId ?? null,
      slideIndex,
      slideTitle,
      knowledgeNodeId: realtimeSession.currentKnowledgeNodeId ?? sessionResult.session.currentKnowledgeNodeId ?? null,
      teacherRole: realtimeSession.teacherRole ?? sessionResult.session.teacherRole,
      userAnswer: payload.transcript,
      aiMessage: "",
      inputTranscript: payload.transcript,
      assistantTranscript: null,
      providerResponseId: `ai-sdk-defense-${crypto.randomUUID()}`,
      providerTraceId: null,
      latencyMs: null,
      mode: "ai-sdk-stream",
      score: null,
      strengths: [],
      risks: [],
      improvedAnswer: null,
      followUps: [],
      slideFeedbackSummary: null,
      citations: [],
      retrievedSourceIds,
      speech: {
        input: "browser-speech-recognition",
      },
      createdAt: now,
    };

    const stream = createDefenseTurnUIMessageStream({
      answer: async () => {
        const result = await finalizeRealtimeTurnAndAnalyze(turnDraft);
        await realtimeRepository.updateSession(realtimeSession.id, {
          currentPhase: result.sessionPatch.currentPhase,
          currentSlideId: result.sessionPatch.currentSlideId,
          currentSlideIndex: result.sessionPatch.currentSlideIndex,
          currentKnowledgeNodeId: result.sessionPatch.currentKnowledgeNodeId,
          status: "active",
        });

        const answer = chooseTeacherAnswer({
          phaseAfter,
          slideTitle,
          turn: result.turn,
        });

        return {
          answer,
          metadata: {
            phaseAfter,
            phaseBefore,
            realtimeSessionId: realtimeSession.id,
            sessionId,
            turnType,
          },
          result: {
            currentFollowupCount: readNumber(result.sessionPatch, "currentFollowupCount") ?? undefined,
            phaseAfter,
            sessionPatch: result.sessionPatch,
            turn: result.turn,
          },
        };
      },
      messageId: turnId,
      metadata: {
        phaseAfter,
        phaseBefore,
        realtimeSessionId: realtimeSession.id,
        sessionId,
        turnType,
      },
    });

    return createUIMessageStreamResponse({
      status: 201,
      stream,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_defense_voice_turn_payload", "Invalid defense voice turn payload.", error.flatten());
    }
    return apiError(
      500,
      "defense_voice_turn_failed",
      error instanceof Error ? error.message : "Failed to stream defense voice turn.",
    );
  }
}

function chooseTeacherAnswer({
  phaseAfter,
  slideTitle,
  turn,
}: {
  phaseAfter: DefensePhase;
  slideTitle: string;
  turn: TrainingTurnRecord;
}) {
  if (phaseAfter === "teacher_followup") {
    const followUps = stringArrayFromUnknown(turn.followUps);
    return followUps[0] ?? turn.aiMessage
      ?? `围绕“${slideTitle}”，请补一句材料支撑和你负责的部分。`;
  }

  if (phaseAfter === "slide_feedback") {
    return turn.slideFeedbackSummary
      ?? turn.aiMessage
      ?? "这页已经记录下来。下一页继续保持结论、证据和个人职责三段式。";
  }

  return turn.aiMessage || "我已经收到这段回答，会继续推进本轮讲练。";
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRetrievedSourceIds(contextSnapshot: Record<string, unknown>) {
  const items = contextSnapshot.retrievedSources;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (item && typeof item === "object" && !Array.isArray(item) && typeof item.id === "string"
      ? item.id
      : null))
    .filter((item): item is string => Boolean(item));
}

function stringArrayFromUnknown(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}
