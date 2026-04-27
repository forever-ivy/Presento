import { createReviewRepository } from "@db/repositories/reviews";
import { apiError, apiOk, notFound } from "../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const review = await createReviewRepository().readBySession(sessionId);
    if (!review || review.projectId !== projectId) return notFound("Review report");
    return apiOk({ review });
  } catch (error) {
    return apiError(500, "review_read_failed", error instanceof Error ? error.message : "Failed to read review.");
  }
}
