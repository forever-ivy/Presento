import { createProjectRepository } from "@db/repositories/projects";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../_utils";
import { projectPayloadSchema } from "../helpers";

export const runtime = "nodejs";

const projectPatchSchema = projectPayloadSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  "At least one field is required.",
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const project = await createProjectRepository().read(projectId);
    if (!project) return notFound("Project");
    return apiOk({ project });
  } catch (error) {
    return apiError(500, "project_read_failed", error instanceof Error ? error.message : "Failed to read project.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = projectPatchSchema.parse(await request.json());
    const project = await createProjectRepository().update(projectId, payload);
    if (!project) return notFound("Project");
    return apiOk({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_project_patch", "Invalid project patch.", error.flatten());
    }
    return apiError(500, "project_patch_failed", error instanceof Error ? error.message : "Failed to update project.");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    await createProjectRepository().remove(projectId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(500, "project_delete_failed", error instanceof Error ? error.message : "Failed to delete project.");
  }
}
