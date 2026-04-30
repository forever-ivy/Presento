import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import { mockKnowledgeEdges, mockKnowledgeNodes } from "@/lib/knowledge-map-mock";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let projectId = "";
  try {
    ({ projectId } = await params);
    const knowledgeMap = await createKnowledgeMapRepository().read(projectId);
    return apiOk(knowledgeMap);
  } catch (error) {
    if (projectId === "demo") {
      return apiOk({
        edges: mockKnowledgeEdges,
        nodes: mockKnowledgeNodes,
      });
    }
    return apiError(500, "knowledge_map_read_failed", error instanceof Error ? error.message : "Failed to read knowledge map.");
  }
}
