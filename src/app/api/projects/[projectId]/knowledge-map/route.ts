import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import { createJobRunRepository } from "@db/repositories/job-runs";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const [knowledgeMap, jobs] = await Promise.all([
      createKnowledgeMapRepository().read(projectId),
      createJobRunRepository().list(projectId),
    ]);
    const generationJob = jobs.find((job) => job.kind === "knowledge_map");
    return apiOk({
      ...knowledgeMap,
      generation: generationJob
        ? {
          status: generationJob.status,
          jobId: generationJob.id,
          error: generationJob.error,
          updatedAt: generationJob.updatedAt,
          completedAt: generationJob.completedAt,
          nodeCount: readNumber(generationJob.result?.nodeCount),
          edgeCount: readNumber(generationJob.result?.edgeCount),
        }
        : { status: "idle" },
    });
  } catch (error) {
    return apiError(500, "knowledge_map_read_failed", error instanceof Error ? error.message : "Failed to read knowledge map.");
  }
}

function readNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
