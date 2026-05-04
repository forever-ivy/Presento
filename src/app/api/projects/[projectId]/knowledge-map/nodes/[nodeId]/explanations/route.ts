import { createFileExplanationSession } from "@/lib/file-explanation-service";
import { z } from "zod";
import { apiError, apiOk } from "../../../../../../_utils";

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
    const session = await createFileExplanationSession({
      projectId,
      nodeId,
      focusNodeId: payload.focusNodeId,
      mode: payload.mode,
    });
    return apiOk({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_file_explanation_payload", "Invalid file explanation payload.", error.flatten());
    }
    return apiError(
      500,
      "file_explanation_create_failed",
      error instanceof Error ? error.message : "Failed to create file explanation.",
    );
  }
}
