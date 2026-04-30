import { createFileExplanationSession } from "@/lib/file-explanation-service";
import { createMockFileExplanationSession, mockKnowledgeNodes } from "@/lib/knowledge-map-mock";
import type { NotebookExplanationMode } from "@shared/domain";
import { z } from "zod";
import { apiError, apiOk } from "../../../../../../_utils";

export const runtime = "nodejs";

const createExplanationSchema = z.object({
  mode: z.enum(["quick", "mastery"]).default("quick"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; nodeId: string }> },
) {
  let mode: NotebookExplanationMode = "quick";
  let nodeId = "";
  let projectId = "";
  try {
    ({ projectId, nodeId } = await params);
    const payload = createExplanationSchema.parse(await request.json().catch(() => ({})));
    mode = payload.mode as NotebookExplanationMode;
    const session = await createFileExplanationSession({
      projectId,
      nodeId,
      mode,
    });
    return apiOk({ session }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_file_explanation_payload", "Invalid file explanation payload.", error.flatten());
    }
    const mockNode = projectId === "demo" ? mockKnowledgeNodes.find((node) => node.id === nodeId) : null;
    if (mockNode) {
      return apiOk({ session: createMockFileExplanationSession(projectId, mockNode, mode) }, { status: 201 });
    }
    return apiError(
      500,
      "file_explanation_create_failed",
      error instanceof Error ? error.message : "Failed to create file explanation.",
    );
  }
}
