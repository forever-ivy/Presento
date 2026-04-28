import { addFileExplanationTurn } from "@/lib/file-explanation-service";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

const createTurnSchema = z.object({
  question: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const payload = createTurnSchema.parse(await request.json().catch(() => ({})));
    const session = await addFileExplanationTurn({
      projectId,
      sessionId,
      question: payload.question,
    });
    if (!session) return notFound("File explanation session");
    return apiOk({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_file_explanation_turn", "Invalid file explanation turn.", error.flatten());
    }
    return apiError(
      500,
      "file_explanation_turn_failed",
      error instanceof Error ? error.message : "Failed to add file explanation turn.",
    );
  }
}
