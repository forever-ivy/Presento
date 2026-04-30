import { getFileNodePreview } from "@/lib/file-explanation-service";
import { apiError, apiOk } from "../../../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; nodeId: string }> },
) {
  try {
    const { projectId, nodeId } = await params;
    const preview = await getFileNodePreview(projectId, nodeId);
    return apiOk(preview);
  } catch (error) {
    return apiError(
      404,
      "file_node_preview_failed",
      error instanceof Error ? error.message : "Failed to read file preview.",
    );
  }
}
