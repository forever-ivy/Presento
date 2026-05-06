import { createProjectRepository } from "@db/repositories/projects";
import { createTrainingFocusRepository } from "@db/repositories/training-focuses";
import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import { z } from "zod";
import { createTrainingSessionRecord } from "@/lib/training-session";
import { readTrainingSessionAggregate } from "@/lib/realtime-training";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

const createTrainingSessionSchema = z.object({
  title: z.string().min(1).default("课程项目答辩训练"),
  teacherRole: z.string().default("strict"),
  difficulty: z.string().default("normal"),
  currentSlideId: z.string().optional(),
  currentSlideIndex: z.number().int().nonnegative().optional(),
  currentKnowledgeNodeId: z.string().optional(),
  focusKnowledgeNodeIds: z.array(z.string().min(1)).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = createTrainingSessionSchema.parse(await request.json().catch(() => ({})));
    const project = await createProjectRepository().read(projectId);
    if (!project) {
      return apiError(404, "project_not_found", "Project not found.");
    }
    const focusKnowledgeNodeIds = payload.focusKnowledgeNodeIds
      ?? (await createTrainingFocusRepository().listByProject(projectId)).map((focus) => focus.knowledgeNodeId);
    const repository = createTrainingSessionRepository();
    const session = createTrainingSessionRecord({
      projectId,
      title: payload.title,
      teacherRole: payload.teacherRole,
      difficulty: payload.difficulty,
      currentPhase: "idle",
      currentSlideId: payload.currentSlideId,
      currentSlideIndex: payload.currentSlideIndex ?? 0,
      currentKnowledgeNodeId: payload.currentKnowledgeNodeId,
      focusKnowledgeNodeIds,
    });

    await repository.createSession(session);
    const aggregate = await readTrainingSessionAggregate(projectId, session.id);
    return apiOk({
      ...aggregate,
      progress: aggregate?.session
        ? {
            currentPhase: aggregate.session.currentPhase,
            currentSlideIndex: aggregate.session.currentSlideIndex,
            completedSlideIds: aggregate.session.completedSlideIds,
            currentFollowupCount: aggregate.session.currentFollowupCount,
            finalQuestionIndex: aggregate.session.finalQuestionIndex,
            lastPhaseAt: aggregate.session.lastPhaseAt,
          }
        : null,
      nextStep: {
        provider: "glm-realtime-flash",
        createRealtimeSessionPath: `/api/projects/${projectId}/training-sessions/${session.id}/realtime-sessions`,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_training_session_payload", "Invalid training session payload.", error.flatten());
    }
    return apiError(500, "training_session_create_failed", error instanceof Error ? error.message : "Failed to create training session.");
  }
}
