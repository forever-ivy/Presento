import { createFileRepository } from "@db/repositories/files";
import { createProjectRepository } from "@db/repositories/projects";
import { z } from "zod";
import { apiError, apiOk } from "../_utils";
import { buildPersistedFileBatch, createProjectRecord, projectPayloadSchema, uploadedFileSchema } from "./helpers";

export const runtime = "nodejs";

const createProjectPayloadSchema = projectPayloadSchema.extend({
  uploadedFiles: z.array(uploadedFileSchema).optional(),
});

export async function GET() {
  try {
    const projects = await createProjectRepository().list();
    return apiOk({ projects });
  } catch (error) {
    return apiError(500, "projects_list_failed", error instanceof Error ? error.message : "Failed to list projects.");
  }
}

export async function POST(request: Request) {
  try {
    const payload = createProjectPayloadSchema.parse(await request.json());
    const project = createProjectRecord(payload);
    await createProjectRepository().create(project);
    let batch:
      | ReturnType<typeof buildPersistedFileBatch>
      | undefined;

    if (payload.uploadedFiles?.length) {
      batch = buildPersistedFileBatch(project.id, payload.uploadedFiles);
      await createFileRepository().createBatch(batch);
    }

    return apiOk({ project, ...(batch ? batch : {}) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_project_payload", "Invalid project payload.", error.flatten());
    }

    return apiError(500, "project_create_failed", error instanceof Error ? error.message : "Failed to create project.");
  }
}
