import { createReviewRepository } from "@db/repositories/reviews";
import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import { apiError, apiOk, notFound } from "../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const [bundle, sessionResult] = await Promise.all([
      createReviewRepository().readSessionBundle(projectId, sessionId),
      createTrainingSessionRepository().readSession(sessionId),
    ]);
    if (!bundle.review || !sessionResult.session || sessionResult.session.projectId !== projectId) {
      return notFound("Review report");
    }
    return apiOk({
      review: bundle.review,
      weaknesses: bundle.weaknesses,
      deepDiveRefs: bundle.deepDiveRefs,
      sessionSummary: sessionResult.session,
    });
  } catch (error) {
    return apiError(500, "review_read_failed", error instanceof Error ? error.message : "Failed to read review.");
  }
}
