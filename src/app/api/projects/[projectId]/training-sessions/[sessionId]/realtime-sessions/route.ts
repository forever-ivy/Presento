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

const createRealtimeSessionSchema = z.object({
  currentSlideId: z.string().nullable().optional(),
  currentKnowledgeNodeId: z.string().nullable().optional(),
  slideTitle: z.string().optional(),
  slideIndex: z.number().int().positive().optional(),
  memberScope: z.string().optional(),
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
    const currentKnowledgeNodeId =
      payload.currentKnowledgeNodeId ?? sessionResult.session.currentKnowledgeNodeId ?? null;
    const contextSnapshot = await buildRealtimeContextSnapshot({
      projectId,
      currentSlideId,
      currentKnowledgeNodeId,
      slideTitle: payload.slideTitle ?? null,
      slideIndex: payload.slideIndex ?? null,
      memberScope: payload.memberScope ?? null,
    });

    if (
      currentSlideId !== sessionResult.session.currentSlideId
      || currentKnowledgeNodeId !== sessionResult.session.currentKnowledgeNodeId
    ) {
      await createTrainingSessionRepository().updateSession(sessionId, {
        currentSlideId,
        currentKnowledgeNodeId,
      });
    }

    const sessionToken = createRealtimeSessionToken();
    const realtimeSession = createRealtimeSessionRecord({
      projectId,
      trainingSession: {
        ...sessionResult.session,
        currentSlideId,
        currentKnowledgeNodeId,
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
