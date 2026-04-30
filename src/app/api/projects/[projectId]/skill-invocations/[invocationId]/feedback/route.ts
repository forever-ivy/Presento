import {
  createSkillInvocationRepository,
  type SkillFeedbackRecord,
} from "@db/repositories/skill-invocations";
import { createLangfuseSkillFeedbackScore } from "@ai/langfuse";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../../../_utils";

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
    const repository = createSkillInvocationRepository();
    const details = await repository.read(projectId, invocationId);
    if (!details.invocation) return notFound("Skill invocation");
    const payload = feedbackSchema.parse(await request.json());
    const feedback: SkillFeedbackRecord = {
      id: `skill-feedback-${crypto.randomUUID()}`,
      projectId,
      invocationId,
      rating: payload.rating,
      comment: payload.comment ?? null,
      createdAt: new Date().toISOString(),
      syncedAt: null,
    };
    await repository.writeFeedback(feedback);
    const synced = await createLangfuseSkillFeedbackScore({
      id: feedback.id,
      traceId: details.invocation.langfuseTraceId ?? details.invocation.traceId,
      observationId: details.invocation.langfuseObservationId,
      sessionId: details.invocation.projectId,
      rating: feedback.rating,
      comment: feedback.comment,
    });
    if (synced) {
      await repository.markFeedbackSynced(invocationId, new Date().toISOString());
      feedback.syncedAt = new Date().toISOString();
    }
    return apiOk({ feedback }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_skill_feedback_payload", "Invalid skill feedback payload.", error.flatten());
    }
    return apiError(500, "skill_feedback_failed", error instanceof Error ? error.message : "Failed to save skill feedback.");
  }
}
