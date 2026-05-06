import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createProjectRepository } from "@db/repositories/projects";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { createUIMessageStreamResponse } from "ai";
import { z } from "zod";
import { createSlideDrillUIMessageStream } from "@/lib/slide-drill-stream";
import { apiError, notFound } from "../../../../../../../_utils";
import { readDrillSlide } from "../../_shared";

export const runtime = "nodejs";

const drillMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
  suggestedQuestions: z.array(z.string().min(1).max(2_000)).optional(),
  createdAt: z.string(),
});

const answerPayloadSchema = z.object({
  currentDraft: z.string().max(500_000).optional(),
  messages: z.array(drillMessageSchema).max(80).default([]),
  question: z.string().min(1).max(2_000),
});

type SlideScriptDrillOutput = {
  answerCard?: string;
  drillAnswer?: string;
  normal?: string;
  risks?: string[];
  suggestedQuestions?: string[];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; slideId: string }> },
) {
  try {
    const { projectId, slideId } = await params;
    const payload = answerPayloadSchema.parse(await request.json().catch(() => ({})));
    const [project, slide] = await Promise.all([
      createProjectRepository().read(projectId),
      readDrillSlide(projectId, slideId),
    ]);
    if (!project) return notFound("Project");
    if (!slide) return notFound("Slide");

    const skillPayload = {
      action: "drill_answer",
      currentDraft: payload.currentDraft,
      extractedText: slide.extractedText ?? "",
      fileId: slide.fileId ?? undefined,
      instruction: payload.question,
      messages: payload.messages,
      selectedText: payload.question,
      slideId: slide.id,
      slideIndex: slide.page,
      slideTitle: slide.title,
    };
    const { output, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName: project.name,
      skillId: "slide_script",
      trigger: "slide-drill-answer",
      payload: skillPayload,
    });
    await createSkillInvocationRepository().write(invocation).catch(() => undefined);

    const drillOutput = output as SlideScriptDrillOutput;
    const suggestedQuestions = readStringArray(drillOutput.suggestedQuestions).length
      ? readStringArray(drillOutput.suggestedQuestions)
      : readStringArray(drillOutput.risks).slice(0, 4);
    const stream = createSlideDrillUIMessageStream({
      answer: readString(
        drillOutput.drillAnswer,
        drillOutput.answerCard || drillOutput.normal || "这个问题可以从本页结论、资料依据和个人贡献三个角度回答。",
      ),
      messageId: `slide-drill-${crypto.randomUUID()}`,
      metadata: {
        skillInvocationId: invocation.id,
        skillStatus: invocation.status,
        usedFallback: invocation.usedFallback,
      },
      suggestedQuestions,
    });

    return createUIMessageStreamResponse({
      status: 201,
      stream,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_slide_drill_answer_payload", "Invalid slide drill answer payload.", error.flatten());
    }
    return apiError(
      500,
      "slide_drill_answer_failed",
      error instanceof Error ? error.message : "Failed to answer slide drill question.",
    );
  }
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item, "")).filter(Boolean);
}
