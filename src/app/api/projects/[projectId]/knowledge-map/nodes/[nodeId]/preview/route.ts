import { getFileNodePreview } from "@/lib/file-explanation-service";
import { apiError, apiOk } from "../../../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; nodeId: string }> },
) {
  try {
    const { projectId, nodeId } = await params;
    const focusNodeId = new URL(request.url).searchParams.get("focusNodeId") ?? undefined;
    const preview = await getFileNodePreview(projectId, nodeId, { focusNodeId });
    return apiOk(preview);
  } catch (error) {
    return apiError(
      404,
      "file_node_preview_failed",
      error instanceof Error ? error.message : "Failed to read file preview.",
    );
  }
}
