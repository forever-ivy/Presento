import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import { createTrainingFocusRepository } from "@db/repositories/training-focuses";
import { apiError, apiOk } from "../../../../_utils";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; knowledgeNodeId: string }> },
) {
  try {
    const { projectId, knowledgeNodeId } = await params;
    await createTrainingFocusRepository().deleteFocus(projectId, knowledgeNodeId);
    const focuses = await createTrainingFocusRepository().listByProject(projectId);
    const map = await createKnowledgeMapRepository().read(projectId);
    const nodesById = new Map(map.nodes.map((node) => [node.id, node] as const));
    return apiOk({
      focuses: focuses.map((focus) => {
        const node = nodesById.get(focus.knowledgeNodeId);
        return {
          ...focus,
          ...(node
            ? {
                knowledgeNode: {
                  id: node.id,
                  kind: node.kind,
                  title: node.title,
                  summary: node.summary,
                },
              }
            : {}),
        };
      }),
    });
  } catch (error) {
    return apiError(
      500,
      "training_focus_delete_failed",
      error instanceof Error ? error.message : "Failed to delete training focus.",
    );
  }
}
