import { createFileExplanationSessionStream } from "@/lib/file-explanation-service";
import type { NotebookExplanationMode } from "@shared/domain";
import { z } from "zod";
import { apiError } from "../../../../../../../_utils";

export const runtime = "nodejs";

const createExplanationSchema = z.object({
  focusNodeId: z.string().min(1).optional(),
  mode: z.enum(["quick", "mastery"]).default("quick"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; nodeId: string }> },
) {
  try {
    const { projectId, nodeId } = await params;
    const payload = createExplanationSchema.parse(await request.json().catch(() => ({})));
    return await createFileExplanationSessionStream({
      projectId,
      nodeId,
      focusNodeId: payload.focusNodeId,
      mode: payload.mode as NotebookExplanationMode,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_file_explanation_payload", "Invalid file explanation payload.", error.flatten());
    }
    return apiError(
      500,
      "file_explanation_stream_create_failed",
      error instanceof Error ? error.message : "Failed to stream file explanation.",
    );
  }
}
