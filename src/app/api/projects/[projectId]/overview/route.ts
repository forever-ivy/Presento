import { readProjectOverview } from "@/lib/project-overview-db";
import { apiError, apiOk, notFound } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const overview = await readProjectOverview(projectId);
    if (!overview) return notFound("Project overview");
    return apiOk({ overview });
  } catch (error) {
    return apiError(
      500,
      "project_overview_read_failed",
      error instanceof Error ? error.message : "Failed to read project overview.",
    );
  }
}
