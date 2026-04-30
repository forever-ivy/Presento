import { readTrainingSessionAggregate } from "@/lib/realtime-training";
import { apiError, apiOk, notFound } from "../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const result = await readTrainingSessionAggregate(projectId, sessionId);
    if (!result) return notFound("Training session");
    return apiOk(result);
  } catch (error) {
    return apiError(500, "training_session_read_failed", error instanceof Error ? error.message : "Failed to read training session.");
  }
}
