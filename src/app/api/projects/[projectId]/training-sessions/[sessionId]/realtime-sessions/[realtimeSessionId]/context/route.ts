import { createRealtimeSessionRepository } from "@db/repositories/realtime-sessions";
import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import { z } from "zod";
import { buildRealtimeContextSnapshot } from "@/lib/realtime-training";
import { apiError, apiOk, notFound } from "../../../../../../../_utils";

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

const updateContextSchema = z.object({
  currentPhase: z.enum(defensePhaseValues).optional(),
  currentSlideId: z.string().nullable().optional(),
  currentSlideIndex: z.number().int().nonnegative().optional(),
  currentKnowledgeNodeId: z.string().nullable().optional(),
  focusKnowledgeNodeIds: z.array(z.string().min(1)).optional(),
  slideTitle: z.string().optional(),
  slideIndex: z.number().int().positive().optional(),
  slideGoal: z.string().optional(),
  cueKeywords: z.array(z.string().min(1)).optional(),
  previousSlideFeedback: z.string().nullable().optional(),
  followUpBudget: z.number().int().positive().optional(),
  memberScope: z.string().optional(),
  seedQuestions: z.array(z.object({
    slideId: z.string(),
    source: z.enum(["ai", "user"]),
    text: z.string().min(1).max(2_000),
  })).max(80).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string; realtimeSessionId: string }> },
) {
  try {
    const { projectId, sessionId, realtimeSessionId } = await params;
    const payload = updateContextSchema.parse(await request.json());
    const trainingRepository = createTrainingSessionRepository();
    const realtimeRepository = createRealtimeSessionRepository();
    const [sessionResult, realtimeSession] = await Promise.all([
      trainingRepository.readSession(sessionId),
      realtimeRepository.readSession(realtimeSessionId),
    ]);

    if (!sessionResult.session || sessionResult.session.projectId !== projectId) {
      return notFound("Training session");
    }
    if (!realtimeSession || realtimeSession.trainingSessionId !== sessionId || realtimeSession.projectId !== projectId) {
      return notFound("Realtime session");
    }

    const currentSlideId = payload.currentSlideId ?? realtimeSession.currentSlideId ?? null;
    const currentSlideIndex = payload.currentSlideIndex ?? realtimeSession.currentSlideIndex ?? 0;
    const currentKnowledgeNodeId =
      payload.currentKnowledgeNodeId ?? realtimeSession.currentKnowledgeNodeId ?? null;
    const focusKnowledgeNodeIds = payload.focusKnowledgeNodeIds ?? sessionResult.session.focusKnowledgeNodeIds ?? [];
    const contextSnapshot = await buildRealtimeContextSnapshot({
      projectId,
      currentPhase: payload.currentPhase ?? realtimeSession.currentPhase,
      currentSlideId,
      currentSlideIndex,
      currentKnowledgeNodeId,
      focusKnowledgeNodeIds,
      slideTitle: payload.slideTitle ?? null,
      slideIndex: payload.slideIndex ?? null,
      slideGoal: payload.slideGoal ?? null,
      cueKeywords: payload.cueKeywords ?? [],
      previousSlideFeedback: payload.previousSlideFeedback ?? null,
      followUpBudget: payload.followUpBudget ?? null,
      memberScope: payload.memberScope ?? null,
      seedQuestions: payload.seedQuestions ?? [],
    });

    const [sessionPatch, realtimeSessionPatch] = await Promise.all([
      trainingRepository.updateSession(sessionId, {
        currentPhase: payload.currentPhase ?? realtimeSession.currentPhase,
        currentSlideId,
        currentSlideIndex,
        currentKnowledgeNodeId,
        focusKnowledgeNodeIds,
      }),
      realtimeRepository.updateSession(realtimeSessionId, {
        currentPhase: payload.currentPhase ?? realtimeSession.currentPhase,
        currentSlideId,
        currentSlideIndex,
        currentKnowledgeNodeId,
        contextSnapshot,
      }),
    ]);

    return apiOk({
      sessionPatch,
      realtimeSessionPatch,
      contextSnapshot,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_realtime_context_payload", "Invalid realtime context payload.", error.flatten());
    }
    return apiError(
      500,
      "realtime_context_update_failed",
      error instanceof Error ? error.message : "Failed to update realtime context.",
    );
  }
}
