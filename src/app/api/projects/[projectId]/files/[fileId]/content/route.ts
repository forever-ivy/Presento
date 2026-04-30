import { FileContentError, contentDispositionHeader, readProjectFileContent } from "@/lib/file-content";
import { apiError } from "../../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> },
) {
  try {
    const { projectId, fileId } = await params;
    const fileContent = await readProjectFileContent({ projectId, fileId });
    return new Response(fileContent.body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": contentDispositionHeader(fileContent.fileName),
        "Content-Type": fileContent.contentType,
      },
    });
  } catch (error) {
    if (error instanceof FileContentError) {
      return apiError(error.status, error.code, error.message);
    }
    return apiError(500, "file_content_read_failed", error instanceof Error ? error.message : "Failed to read file content.");
  }
}
