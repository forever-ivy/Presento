import { createFileExplanationRepository } from "@db/repositories/file-explanations";
import { apiError, apiOk, notFound } from "../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const session = await createFileExplanationRepository().readSession(projectId, sessionId);
    if (!session) return notFound("File explanation session");
    return apiOk({ session });
  } catch (error) {
    return apiError(
      500,
      "file_explanation_read_failed",
      error instanceof Error ? error.message : "Failed to read file explanation.",
    );
  }
}
