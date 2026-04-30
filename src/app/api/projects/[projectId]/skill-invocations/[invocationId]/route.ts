import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { apiError, apiOk, notFound } from "../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; invocationId: string }> },
) {
  try {
    const { projectId, invocationId } = await params;
    const details = await createSkillInvocationRepository().read(projectId, invocationId);
    if (!details.invocation) return notFound("Skill invocation");
    return apiOk(details);
  } catch (error) {
    return apiError(500, "skill_invocation_read_failed", error instanceof Error ? error.message : "Failed to read skill invocation.");
  }
}
