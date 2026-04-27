import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

const voiceCaptureSchema = z.object({
  turnId: z.string().optional(),
  filePath: z.string().min(1),
  mimeType: z.string().min(1),
  durationMs: z.number().int().nonnegative().optional(),
  transcriptText: z.string().optional(),
  state: z.string().default("thinking"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const payload = voiceCaptureSchema.parse(await request.json());
    const result = await createTrainingSessionRepository().readSession(sessionId);
    if (!result.session || result.session.projectId !== projectId) return notFound("Training session");

    const capture = {
      id: `voice-${crypto.randomUUID()}`,
      sessionId,
      projectId,
      turnId: payload.turnId ?? null,
      filePath: payload.filePath,
      mimeType: payload.mimeType,
      durationMs: payload.durationMs ?? null,
      transcriptText: payload.transcriptText ?? null,
      state: payload.state,
      metadata: payload.metadata,
      createdAt: new Date().toISOString(),
    };

    await createTrainingSessionRepository().addVoiceCapture(capture);
    return apiOk({ voiceCapture: capture }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_voice_capture_payload", "Invalid voice capture payload.", error.flatten());
    }
    return apiError(500, "voice_capture_create_failed", error instanceof Error ? error.message : "Failed to create voice capture.");
  }
}
