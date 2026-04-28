import { createFileExplanationRepository } from "@db/repositories/file-explanations";
import { createReviewRepository } from "@db/repositories/reviews";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

const createWeaknessSchema = z.object({
  title: z.string().min(1),
  reason: z.string().min(1).optional(),
  citations: z.array(z.unknown()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const session = await createFileExplanationRepository().readSession(projectId, sessionId);
    if (!session) return notFound("File explanation session");

    const payload = createWeaknessSchema.parse(await request.json().catch(() => ({})));
    const weakness = {
      id: `weakness-${crypto.randomUUID()}`,
      projectId,
      sessionId: null,
      trainingTurnId: null,
      title: payload.title,
      reason: payload.reason ?? `来自文件讲解 ${session.summary} 的薄弱点候选。`,
      status: "open",
      citations: payload.citations ?? session.citations,
      createdAt: new Date().toISOString(),
    };

    await createReviewRepository().createWeakness(weakness);
    return apiOk({ weakness }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_weakness_payload", "Invalid weakness payload.", error.flatten());
    }
    return apiError(
      500,
      "file_explanation_weakness_failed",
      error instanceof Error ? error.message : "Failed to create weakness.",
    );
  }
}
