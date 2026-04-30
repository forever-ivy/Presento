import { createFileRepository } from "@db/repositories/files";
import { z } from "zod";
import { apiError, apiOk } from "../../../_utils";
import { buildPersistedFileBatch, uploadedFileSchema } from "../../helpers";

export const runtime = "nodejs";

const filesPayloadSchema = z.object({
  uploadedFiles: z.array(uploadedFileSchema).min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const files = await createFileRepository().list(projectId);
    return apiOk({ files });
  } catch (error) {
    return apiError(500, "files_read_failed", error instanceof Error ? error.message : "Failed to read files.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = filesPayloadSchema.parse(await request.json());
    const batch = buildPersistedFileBatch(projectId, payload.uploadedFiles);
    await createFileRepository().createBatch(batch);
    return apiOk(batch, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_files_payload", "Invalid files payload.", error.flatten());
    }
    if (error instanceof Error && error.message.includes("GitHub 公开仓库")) {
      return apiError(400, "unsupported_code_upload", error.message);
    }
    return apiError(500, "files_create_failed", error instanceof Error ? error.message : "Failed to attach files.");
  }
}
