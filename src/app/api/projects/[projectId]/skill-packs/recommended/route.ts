import { recommendProjectSkillPacks } from "@/lib/skills-runtime";
import { apiError, apiOk, notFound } from "../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const recommendations = await recommendProjectSkillPacks(projectId);
    if (!recommendations) return notFound("Project");
    return apiOk({ skillPacks: recommendations });
  } catch (error) {
    return apiError(500, "recommended_skill_packs_failed", error instanceof Error ? error.message : "Failed to recommend project skill packs.");
  }
}
