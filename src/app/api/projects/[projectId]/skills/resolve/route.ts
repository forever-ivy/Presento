import { hasBuiltInSkill } from "@ai/skills/registry";
import { z } from "zod";
import { resolveProjectSkill } from "@/lib/skills-runtime";
import { apiError, apiOk, notFound } from "../../../../_utils";

export const runtime = "nodejs";

const resolveSkillSchema = z.object({
  skillId: z.string().optional(),
  mode: z.enum(["workspace", "defense", "deep_dive", "review", "export", "file_explanation", "knowledge_node"]),
  event: z.string().min(1),
  fileKind: z.string().optional(),
  pageKind: z.string().optional(),
  trainingState: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const body = resolveSkillSchema.parse(await request.json().catch(() => ({})));
    if (body.skillId && !hasBuiltInSkill(body.skillId)) {
      return apiError(404, "skill_not_found", "Skill not found.");
    }
    const resolution = await resolveProjectSkill({
      projectId,
      explicitSkillId: body.skillId && hasBuiltInSkill(body.skillId) ? body.skillId : null,
      mode: body.mode,
      event: body.event,
      fileKind: body.fileKind,
      pageKind: body.pageKind,
      trainingState: body.trainingState,
    });
    if (!resolution) return notFound("Project");
    return apiOk({ resolution });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_skill_resolve_payload", "Invalid skill resolve payload.", error.flatten());
    }
    return apiError(500, "skill_resolve_failed", error instanceof Error ? error.message : "Failed to resolve skill.");
  }
}
