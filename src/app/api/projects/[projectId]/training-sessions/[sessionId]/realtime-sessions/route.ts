import { createProjectRepository } from "@db/repositories/projects";
import { createRealtimeSessionRepository } from "@db/repositories/realtime-sessions";
import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import { z } from "zod";
import {
  buildRealtimeContextSnapshot,
  createRealtimeSessionRecord,
  createRealtimeSessionToken,
  hashRealtimeSessionToken,
} from "@/lib/realtime-training";
import { apiError, apiOk, notFound } from "../../../../../_utils";

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

const createRealtimeSessionSchema = z.object({
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const payload = createRealtimeSessionSchema.parse(await request.json().catch(() => ({})));
    const [project, sessionResult] = await Promise.all([
      createProjectRepository().read(projectId),
      createTrainingSessionRepository().readSession(sessionId),
    ]);
    if (!project) return notFound("Project");
    if (!sessionResult.session || sessionResult.session.projectId !== projectId) {
      return notFound("Training session");
    }

    const currentSlideId = payload.currentSlideId ?? sessionResult.session.currentSlideId ?? null;
    const currentSlideIndex = payload.currentSlideIndex ?? sessionResult.session.currentSlideIndex ?? 0;
    const currentKnowledgeNodeId =
      payload.currentKnowledgeNodeId ?? sessionResult.session.currentKnowledgeNodeId ?? null;
    const focusKnowledgeNodeIds = payload.focusKnowledgeNodeIds ?? sessionResult.session.focusKnowledgeNodeIds ?? [];
    const contextSnapshot = await buildRealtimeContextSnapshot({
      projectId,
      currentPhase: payload.currentPhase ?? sessionResult.session.currentPhase,
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

    if (
      currentSlideId !== sessionResult.session.currentSlideId
      || currentSlideIndex !== sessionResult.session.currentSlideIndex
      || currentKnowledgeNodeId !== sessionResult.session.currentKnowledgeNodeId
      || !sameStringList(focusKnowledgeNodeIds, sessionResult.session.focusKnowledgeNodeIds ?? [])
    ) {
      await createTrainingSessionRepository().updateSession(sessionId, {
        currentPhase: payload.currentPhase ?? sessionResult.session.currentPhase,
        currentSlideId,
        currentSlideIndex,
        currentKnowledgeNodeId,
        focusKnowledgeNodeIds,
      });
    }

    const sessionToken = createRealtimeSessionToken();
    const realtimeSession = createRealtimeSessionRecord({
      projectId,
      trainingSession: {
        ...sessionResult.session,
        currentPhase: payload.currentPhase ?? sessionResult.session.currentPhase,
        currentSlideId,
        currentSlideIndex,
        currentKnowledgeNodeId,
        focusKnowledgeNodeIds,
      },
      tokenHash: hashRealtimeSessionToken(sessionToken),
      contextSnapshot,
    });
    await createRealtimeSessionRepository().createSession(realtimeSession);

    const port = process.env.DEFENSE_REALTIME_PORT ?? "3021";
    const wsUrl = process.env.DEFENSE_REALTIME_WS_URL ?? `ws://127.0.0.1:${port}`;

    return apiOk({
      realtimeSessionId: realtimeSession.id,
      wsUrl,
      sessionToken,
      expiresAt: realtimeSession.tokenExpiresAt,
      contextSnapshot,
      activeRealtimeSession: realtimeSession,
      progress: {
        currentPhase: realtimeSession.currentPhase,
        currentSlideIndex: sessionResult.session.currentSlideIndex,
        completedSlideIds: sessionResult.session.completedSlideIds,
        currentFollowupCount: sessionResult.session.currentFollowupCount,
        finalQuestionIndex: sessionResult.session.finalQuestionIndex,
        lastPhaseAt: sessionResult.session.lastPhaseAt,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(
        400,
        "invalid_realtime_session_payload",
        "Invalid realtime session payload.",
        error.flatten(),
      );
    }
    return apiError(
      500,
      "realtime_session_create_failed",
      error instanceof Error ? error.message : "Failed to create realtime session.",
    );
  }
}

function sameStringList(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}
