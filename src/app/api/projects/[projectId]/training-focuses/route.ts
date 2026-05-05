import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import { createProjectRepository } from "@db/repositories/projects";
import { createTrainingFocusRepository } from "@db/repositories/training-focuses";
import type { KnowledgeNodeKind } from "@shared/domain";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../_utils";

export const runtime = "nodejs";

const createTrainingFocusSchema = z.object({
  knowledgeNodeId: z.string().min(1),
});

const eligibleFocusKinds = new Set<KnowledgeNodeKind>(["project", "module", "risk", "weakness"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const project = await createProjectRepository().read(projectId);
    if (!project) return notFound("Project");

    const focuses = await createTrainingFocusRepository().listByProject(projectId);
    return apiOk({ focuses: await attachFocusNodes(projectId, focuses) });
  } catch (error) {
    return apiError(
      500,
      "training_focuses_read_failed",
      error instanceof Error ? error.message : "Failed to read training focuses.",
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = createTrainingFocusSchema.parse(await request.json().catch(() => ({})));
    const [project, node] = await Promise.all([
      createProjectRepository().read(projectId),
      createKnowledgeMapRepository().readNode(projectId, payload.knowledgeNodeId),
    ]);
    if (!project) return notFound("Project");
    if (!node) return notFound("Knowledge node");
    if (!eligibleFocusKinds.has(node.kind)) {
      return apiError(
        400,
        "training_focus_ineligible_node",
        "Only project, module, risk, and weakness nodes can be added as training focuses.",
      );
    }

    const focus = await createTrainingFocusRepository().upsertFocus({
      projectId,
      knowledgeNodeId: payload.knowledgeNodeId,
    });
    const focuses = await createTrainingFocusRepository().listByProject(projectId);
    return apiOk({ focus, focuses: await attachFocusNodes(projectId, focuses) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_training_focus_payload", "Invalid training focus payload.", error.flatten());
    }
    return apiError(
      500,
      "training_focus_create_failed",
      error instanceof Error ? error.message : "Failed to create training focus.",
    );
  }
}

async function attachFocusNodes(
  projectId: string,
  focuses: Array<{ knowledgeNodeId: string } & Record<string, unknown>>,
) {
  if (!focuses.length) return focuses;
  const map = await createKnowledgeMapRepository().read(projectId);
  const nodesById = new Map(map.nodes.map((node) => [node.id, node] as const));
  return focuses.map((focus) => {
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
  });
}
