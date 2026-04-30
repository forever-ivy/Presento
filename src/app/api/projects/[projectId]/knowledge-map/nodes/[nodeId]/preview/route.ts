import { getFileNodePreview } from "@/lib/file-explanation-service";
import { mockKnowledgeNodes } from "@/lib/knowledge-map-mock";
import { apiError, apiOk } from "../../../../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; nodeId: string }> },
) {
  let nodeId = "";
  let projectId = "";
  try {
    ({ projectId, nodeId } = await params);
    const preview = await getFileNodePreview(projectId, nodeId);
    return apiOk(preview);
  } catch (error) {
    const mockNode = projectId === "demo" ? mockKnowledgeNodes.find((node) => node.id === nodeId) : null;
    if (mockNode) {
      return apiOk({
        chunks: Array.isArray(mockNode.metadata.chunks) ? mockNode.metadata.chunks : [],
        file: {
          id: stringFromMetadata(mockNode.metadata, "fileId") ?? mockNode.id,
          kind: stringFromMetadata(mockNode.metadata, "fileKind") ?? mockNode.kind,
          mimeType: stringFromMetadata(mockNode.metadata, "mimeType"),
        },
        preview: isRecord(mockNode.metadata.preview) ? mockNode.metadata.preview : {},
        viewer: stringFromMetadata(mockNode.metadata, "viewer") ?? stringFromMetadata(mockNode.metadata, "fileKind") ?? mockNode.kind,
      });
    }
    return apiError(
      404,
      "file_node_preview_failed",
      error instanceof Error ? error.message : "Failed to read file preview.",
    );
  }
}

function stringFromMetadata(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
