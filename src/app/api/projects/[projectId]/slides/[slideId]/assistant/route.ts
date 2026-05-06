import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createProjectRepository } from "@db/repositories/projects";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { createJsonRepositoryHelpers, runDockerComposePsql } from "@db/runner";
import { sqlText } from "@db/sql";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

const slideAssistantActionSchema = z.enum([
  "overview",
  "short",
  "conversational",
  "contribution",
  "transition",
  "teacher_question",
  "answer_card",
  "keywords",
  "rewrite",
  "rewrite_draft",
  "drill_answer",
]);

const slideAssistantRequestSchema = z.object({
  action: slideAssistantActionSchema.default("overview"),
  currentDraft: z.string().optional(),
  instruction: z.string().optional(),
  selectedText: z.string().optional(),
});

type SlideAssistantAction = z.infer<typeof slideAssistantActionSchema>;

type SlideAssistantSkillOutput = {
  projectName?: string;
  slideTitle?: string;
  task?: string;
  normal?: string;
  short?: string;
  conversational?: string;
  contribution?: string;
  transition?: string;
  answerCard?: string;
  keywords?: string[];
  risks?: string[];
  basis?: {
    topics?: string[];
    materials?: string[];
  };
  rewrite?: string;
  drillAnswer?: string;
  suggestedQuestions?: string[];
};

type SlideRow = {
  id: string;
  deckId: string;
  projectId: string;
  fileId?: string | null;
  page: number;
  title: string;
  extractedText?: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; slideId: string }> },
) {
  try {
    const { projectId, slideId } = await params;
    const payload = slideAssistantRequestSchema.parse(await request.json().catch(() => ({})));
    const [project, slide] = await Promise.all([
      createProjectRepository().read(projectId),
      readSlide(projectId, slideId),
    ]);
    if (!project) return notFound("Project");
    if (!slide) return notFound("Slide");

    const skillPayload = {
      action: payload.action,
      currentDraft: payload.currentDraft,
      instruction: payload.instruction,
      selectedText: payload.selectedText,
      slideId: slide.id,
      slideTitle: slide.title,
      slideIndex: slide.page,
      fileId: slide.fileId ?? undefined,
      extractedText: slide.extractedText ?? "",
    };
    const invocationRepository = createSkillInvocationRepository();
    const trigger = `slide-assistant:${payload.action}`;
    const shouldReadCachedResult = payload.action === "overview";
    const cachedInvocation = shouldReadCachedResult
      ? await invocationRepository.readReusable(projectId, "slide_script", trigger, skillPayload).catch(() => null)
      : null;
    if (cachedInvocation) {
      return apiOk({
        result: toAssistantResult(payload.action, cachedInvocation.output as SlideAssistantSkillOutput),
        skillInvocationId: cachedInvocation.id,
        skillStatus: cachedInvocation.status,
        usedFallback: cachedInvocation.usedFallback,
        cached: true,
      });
    }

    const { output, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName: project.name,
      skillId: "slide_script",
      trigger,
      payload: skillPayload,
    });
    await invocationRepository.write(invocation).catch(() => undefined);

    return apiOk({
      result: toAssistantResult(payload.action, output as SlideAssistantSkillOutput),
      skillInvocationId: invocation.id,
      skillStatus: invocation.status,
      usedFallback: invocation.usedFallback,
      cached: false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_slide_assistant_payload", "Invalid slide assistant payload.", error.flatten());
    }
    return apiError(
      500,
      "slide_assistant_failed",
      error instanceof Error ? error.message : "Failed to run slide assistant.",
    );
  }
}

async function readSlide(projectId: string, slideId: string) {
  const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
  return helpers.readJson<SlideRow | null>(
    `
SELECT COALESCE(
  (
    SELECT row_to_json(slide_rows)
    FROM "Slide" slide_rows
    WHERE slide_rows."projectId" = ${sqlText(projectId)}
      AND slide_rows."id" = ${sqlText(slideId)}
    LIMIT 1
  ),
  'null'::json
)::text;`,
    null,
  );
}

function toAssistantResult(action: SlideAssistantAction, output: SlideAssistantSkillOutput) {
  const overview = normalizeOverview(output);
  if (action === "overview") return overview;
  if (action === "short") return createInsertResult("30 秒稿", overview.short, "card");
  if (action === "conversational") return createInsertResult("口语化", overview.conversational, "card");
  if (action === "contribution") return createInsertResult("个人贡献", overview.contribution, "card");
  if (action === "transition") return createInsertResult("转场句", overview.transition, "pause");
  if (action === "teacher_question") {
    const question = overview.risks[0] ?? `老师可能追问 ${overview.slideTitle} 的依据。`;
    const referenceAnswer = overview.answerCard || overview.contribution || overview.normal;
    return createInsertResult(
      "追问应答",
      [
        question,
        "回答框架：先用一句话回应问题，再补充本页依据，最后落到我的个人负责范围。",
        `参考答案：${referenceAnswer}`,
      ].join("\n"),
      "question",
    );
  }
  if (action === "answer_card") return createInsertResult("答辩卡", overview.answerCard, "card");
  if (action === "keywords") return createInsertResult("关键词", overview.keywords.join(" / "), "card");
  if (action === "drill_answer") return createInsertResult("深挖回答", output.drillAnswer || overview.answerCard, "question");
  if (action === "rewrite_draft") return createInsertResult("整稿改写", output.rewrite || overview.normal, "card");
  return createInsertResult("AI改稿", output.rewrite || overview.normal, "card");
}

function normalizeOverview(output: SlideAssistantSkillOutput) {
  const slideTitle = readString(output.slideTitle, "当前页");
  const keywords = readStringArray(output.keywords);
  const risks = readStringArray(output.risks);
  const basis = {
    topics: readStringArray(output.basis?.topics),
    materials: readStringArray(output.basis?.materials),
  };
  return {
    projectName: readString(output.projectName, "课程项目"),
    slideTitle,
    task: readTask(output.task, slideTitle),
    normal: readString(output.normal, `这一页主要讲 ${slideTitle}。`),
    short: readString(output.short, `${slideTitle} 这页先讲结论，再讲依据。`),
    conversational: readString(output.conversational, `这页我会先用一句话讲清 ${slideTitle}。`),
    contribution: readString(output.contribution, "补一句我负责的部分和可验证的结果。"),
    transition: readString(output.transition, `讲完 ${slideTitle} 后，继续进入下一页。`),
    answerCard: readString(output.answerCard, "答辩卡：结论、依据、个人贡献。"),
    keywords,
    risks: risks.length ? risks : [`老师可能追问「${slideTitle}」这一页的资料依据、边界和个人贡献。`],
    basis: {
      topics: basis.topics.length ? basis.topics : [slideTitle],
      materials: basis.materials.length ? basis.materials : [slideTitle],
    },
  };
}

function createInsertResult(label: string, content: string, tone: "pause" | "question" | "card") {
  return { label, content, tone };
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readTask(value: unknown, slideTitle: string) {
  const task = readString(value, "");
  if (!task || task === "overview" || task.length < 8) {
    return `讲清「${slideTitle}」这一页的核心意思，并补充资料依据和个人负责范围。`;
  }
  return task;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item, "")).filter(Boolean);
}
