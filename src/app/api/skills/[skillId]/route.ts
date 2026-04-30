import { hasBuiltInSkill } from "@ai/skills/registry";
import { getBuiltInSkillCatalog } from "@/lib/skills-runtime";
import { apiOk, notFound } from "../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { skillId } = await params;
  if (!hasBuiltInSkill(skillId)) {
    return notFound("Skill");
  }

  const skill = getBuiltInSkillCatalog(skillId);
  if (!skill) {
    return notFound("Skill");
  }

  return apiOk({ skill });
}
