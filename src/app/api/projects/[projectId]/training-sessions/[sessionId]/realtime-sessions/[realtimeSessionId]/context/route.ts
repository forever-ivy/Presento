import { createRealtimeSessionRepository } from "@db/repositories/realtime-sessions";
import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import { z } from "zod";
import { buildRealtimeContextSnapshot } from "@/lib/realtime-training";
import { apiError, apiOk, notFound } from "../../../../../../../_utils";

export const runtime = "nodejs";

const updateContextSchema = z.object({
  currentSlideId: z.string().nullable().optional(),
  currentKnowledgeNodeId: z.string().nullable().optional(),
  slideTitle: z.string().optional(),
  slideIndex: z.number().int().positive().optional(),
  memberScope: z.string().optional(),
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
    const currentKnowledgeNodeId =
      payload.currentKnowledgeNodeId ?? realtimeSession.currentKnowledgeNodeId ?? null;
    const contextSnapshot = await buildRealtimeContextSnapshot({
      projectId,
      currentSlideId,
      currentKnowledgeNodeId,
      slideTitle: payload.slideTitle ?? null,
      slideIndex: payload.slideIndex ?? null,
      memberScope: payload.memberScope ?? null,
    });

    const [sessionPatch, realtimeSessionPatch] = await Promise.all([
      trainingRepository.updateSession(sessionId, {
        currentSlideId,
        currentKnowledgeNodeId,
      }),
      realtimeRepository.updateSession(realtimeSessionId, {
        currentSlideId,
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
