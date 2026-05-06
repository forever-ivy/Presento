import { addFileExplanationTurnStream } from "@/lib/file-explanation-service";
import { z } from "zod";
import { apiError, notFound } from "../../../../../../_utils";

export const runtime = "nodejs";

const createTurnSchema = z.object({
  question: z.string().min(1),
  selectedContext: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    fileName: z.string().optional(),
  })).max(3).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const payload = createTurnSchema.parse(await request.json().catch(() => ({})));
    const response = await addFileExplanationTurnStream({
      projectId,
      sessionId,
      question: payload.question,
      selectedContext: payload.selectedContext,
    });
    if (!response) return notFound("File explanation session");
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_file_explanation_turn", "Invalid file explanation turn.", error.flatten());
    }
    return apiError(
      500,
      "file_explanation_turn_stream_failed",
      error instanceof Error ? error.message : "Failed to stream file explanation turn.",
    );
  }
}
