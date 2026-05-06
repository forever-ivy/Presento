import { createJsonRepositoryHelpers, runDockerComposePsql } from "@db/runner";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../../../_utils";
import { saveSlideDrillStatePayload } from "@/lib/slide-drill-state-persistence";
import { ensureSlideDrillStateTable, readDrillSlide, readSlideDrillState } from "./_shared";

export const runtime = "nodejs";

const drillQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1).max(2_000),
  source: z.enum(["ai", "user"]),
  createdAt: z.string(),
  queuedAt: z.string().optional(),
  queuedForTraining: z.boolean().optional(),
});

const drillMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
  suggestedQuestions: z.array(z.string().min(1).max(2_000)).optional(),
  createdAt: z.string(),
});

const drillStatePayloadSchema = z.object({
  questions: z.array(drillQuestionSchema).max(80),
  messages: z.array(drillMessageSchema).max(200),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; slideId: string }> },
) {
  try {
    const { projectId, slideId } = await params;
    const slide = await readDrillSlide(projectId, slideId);
    if (!slide) return notFound("Slide");
    const state = await readSlideDrillState(projectId, slideId);
    return apiOk({ state });
  } catch (error) {
    return apiError(
      500,
      "slide_drill_read_failed",
      error instanceof Error ? error.message : "Failed to read slide drill state.",
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string; slideId: string }> },
) {
  try {
    const { projectId, slideId } = await params;
    const payload = drillStatePayloadSchema.parse(await request.json().catch(() => ({})));
    const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
    await ensureSlideDrillStateTable(helpers);
    const slide = await readDrillSlide(projectId, slideId);
    if (!slide) return notFound("Slide");

    const state = await saveSlideDrillStatePayload(projectId, slideId, payload);

    return apiOk({ state });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_slide_drill_payload", "Invalid slide drill payload.", error.flatten());
    }
    return apiError(
      500,
      "slide_drill_save_failed",
      error instanceof Error ? error.message : "Failed to save slide drill state.",
    );
  }
}
