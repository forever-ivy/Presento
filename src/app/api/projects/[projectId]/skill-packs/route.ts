import { z } from "zod";
import { listProjectSkillPacks, replaceProjectSkillPacks } from "@/lib/skills-runtime";
import { apiError, apiOk, notFound } from "../../../_utils";

export const runtime = "nodejs";

const updateSkillPacksSchema = z.object({
  packs: z.array(z.object({
    packId: z.string().min(1),
    enabled: z.boolean(),
    reason: z.string().optional(),
  })).default([]),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const packs = await listProjectSkillPacks(projectId);
    if (!packs) return notFound("Project");
    return apiOk({ skillPacks: packs });
  } catch (error) {
    return apiError(500, "project_skill_packs_read_failed", error instanceof Error ? error.message : "Failed to read project skill packs.");
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const body = updateSkillPacksSchema.parse(await request.json().catch(() => ({})));
    const packs = await replaceProjectSkillPacks(projectId, body.packs as Array<{
      packId: "core-training" | "deep-dive" | "defense-advanced" | "file-explainers";
      enabled: boolean;
      reason?: string | null;
    }>);
    if (!packs) return notFound("Project");
    return apiOk({ skillPacks: packs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_project_skill_packs_payload", "Invalid project skill packs payload.", error.flatten());
    }
    return apiError(500, "project_skill_packs_update_failed", error instanceof Error ? error.message : "Failed to update project skill packs.");
  }
}
