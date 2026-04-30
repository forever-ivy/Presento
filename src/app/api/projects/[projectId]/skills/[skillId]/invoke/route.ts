import { hasBuiltInSkill } from "@ai/skills/registry";
import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createProjectRepository } from "@db/repositories/projects";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

const invokeSkillSchema = z.object({
  trigger: z.string().min(1),
  resolvedBy: z.enum(["explicit", "router", "system"]).default("explicit"),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; skillId: string }> },
) {
  try {
    const { projectId, skillId } = await params;
    if (!hasBuiltInSkill(skillId)) {
      return notFound("Skill");
    }
    const project = await createProjectRepository().read(projectId);
    if (!project) return notFound("Project");

    const body = invokeSkillSchema.parse(await request.json().catch(() => ({})));
    const { output, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName: project.name,
      skillId,
      trigger: body.trigger,
      resolvedBy: body.resolvedBy,
      payload: body.payload,
    });
    await createSkillInvocationRepository().write(invocation);

    return apiOk({ output, invocation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_skill_invoke_payload", "Invalid skill invoke payload.", error.flatten());
    }
    return apiError(500, "skill_invoke_failed", error instanceof Error ? error.message : "Failed to invoke skill.");
  }
}
