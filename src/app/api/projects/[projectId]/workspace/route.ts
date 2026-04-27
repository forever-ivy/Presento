import { createProjectRepository } from "@db/repositories/projects";
import { apiError, apiOk, notFound } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const workspace = await createProjectRepository().readWorkspace(projectId);
    if (!workspace) return notFound("Project workspace");
    return apiOk({ workspace });
  } catch (error) {
    return apiError(500, "workspace_read_failed", error instanceof Error ? error.message : "Failed to read workspace.");
  }
}
