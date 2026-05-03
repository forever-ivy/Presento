import { buildDocxPreview } from "@/lib/docx-preview";
import { FileContentError, readProjectFileContent } from "@/lib/file-content";
import { apiError } from "../../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> },
) {
  try {
    const { projectId, fileId } = await params;
    const fileContent = await readProjectFileContent({ projectId, fileId });
    const contentType = fileContent.contentType.toLowerCase();
    if (!contentType.includes("wordprocessingml") && !fileContent.fileName.toLowerCase().endsWith(".docx")) {
      return apiError(415, "unsupported_docx_preview_type", "Only DOCX files can be previewed with this endpoint.");
    }

    return Response.json(buildDocxPreview(fileContent.body, fileContent.fileName), {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof FileContentError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "docx_preview_failed", error instanceof Error ? error.message : "Failed to render DOCX preview.");
  }
}
