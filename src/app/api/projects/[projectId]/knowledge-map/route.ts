import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const knowledgeMap = await createKnowledgeMapRepository().read(projectId);
    return apiOk(knowledgeMap);
  } catch (error) {
    return apiError(500, "knowledge_map_read_failed", error instanceof Error ? error.message : "Failed to read knowledge map.");
  }
}
