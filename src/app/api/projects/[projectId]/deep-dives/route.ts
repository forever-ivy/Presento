import { createReviewRepository } from "@db/repositories/reviews";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const weaknesses = await createReviewRepository().listWeaknesses(projectId);
    const deepDives = weaknesses.map((weakness) => ({
      id: `deep-dive-${weakness.id}`,
      weaknessId: weakness.id,
      title: weakness.title,
      summary: weakness.reason,
      checklist: [
        "补一版 30 秒口头回答。",
        "补一条可以引用的证据链。",
        "再进行一次围绕此点的模拟追问。",
      ],
      citations: weakness.citations,
      createdAt: weakness.createdAt,
    }));
    return apiOk({ deepDives, weaknesses });
  } catch (error) {
    return apiError(500, "deep_dives_read_failed", error instanceof Error ? error.message : "Failed to read deep dives.");
  }
}
