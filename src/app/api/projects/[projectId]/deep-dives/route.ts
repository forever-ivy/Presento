import { createDeepDiveRepository } from "@db/repositories/deep-dives";
import { createReviewRepository } from "@db/repositories/reviews";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const [weaknesses, deepDives] = await Promise.all([
      createReviewRepository().listWeaknesses(projectId),
      createDeepDiveRepository().listByProject(projectId),
    ]);
    return apiOk({ deepDives, weaknesses });
  } catch (error) {
    return apiError(500, "deep_dives_read_failed", error instanceof Error ? error.message : "Failed to read deep dives.");
  }
}
