import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { z } from "zod";
import { apiError, apiOk } from "../../../../../_utils";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  rating: z.string().min(1),
  comment: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; invocationId: string }> },
) {
  try {
    const { projectId, invocationId } = await params;
    const payload = feedbackSchema.parse(await request.json());
    const feedback = {
      id: `skill-feedback-${crypto.randomUUID()}`,
      projectId,
      invocationId,
      rating: payload.rating,
      comment: payload.comment ?? null,
      createdAt: new Date().toISOString(),
    };
    await createSkillInvocationRepository().writeFeedback(feedback);
    return apiOk({ feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_skill_feedback_payload", "Invalid skill feedback payload.", error.flatten());
    }
    return apiError(500, "skill_feedback_failed", error instanceof Error ? error.message : "Failed to save skill feedback.");
  }
}
