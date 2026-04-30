import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "20");

    if (!projectId) {
      return apiError(400, "missing_project_id", "Missing project id.");
    }

    const invocations = await createSkillInvocationRepository().list(projectId, limit);
    return apiOk({ invocations });
  } catch (error) {
    return apiError(500, "skill_invocation_query_failed", error instanceof Error ? error.message : "Skill invocation query failed.");
  }
}
