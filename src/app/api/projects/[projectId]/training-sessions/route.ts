import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import { z } from "zod";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

const createTrainingSessionSchema = z.object({
  title: z.string().min(1).default("课程项目答辩训练"),
  teacherRole: z.string().default("strict"),
  difficulty: z.string().default("normal"),
  currentSlideId: z.string().optional(),
  currentKnowledgeNodeId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = createTrainingSessionSchema.parse(await request.json().catch(() => ({})));
    const now = new Date().toISOString();
    const session = {
      id: `session-${crypto.randomUUID()}`,
      projectId,
      title: payload.title,
      teacherRole: payload.teacherRole,
      difficulty: payload.difficulty,
      currentSlideId: payload.currentSlideId ?? null,
      currentKnowledgeNodeId: payload.currentKnowledgeNodeId ?? null,
      status: "active",
      voiceState: "idle",
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await createTrainingSessionRepository().createSession(session);
    return apiOk({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_training_session_payload", "Invalid training session payload.", error.flatten());
    }
    return apiError(500, "training_session_create_failed", error instanceof Error ? error.message : "Failed to create training session.");
  }
}
