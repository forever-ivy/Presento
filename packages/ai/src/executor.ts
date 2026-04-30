import type {
  BuiltInSkillDefinition,
  BuiltInSkillId,
  SkillInvocationRecord,
  SkillResolvedBy,
  SkillStatus,
  SkillToolCallRecord,
} from "@shared/domain";
import { createConfiguredSpeechProvider } from "./providers/speech.ts";
import { traceSkillExecution } from "./langfuse.ts";
import { getBuiltInSkill } from "./skills/registry.ts";
import { getSkillSchema } from "./skills/schemas.ts";
import { createSkillToolLayer } from "./tools.ts";
import { runDefenseChatGraph, runDefenseReviewGraph, runProjectBriefGraph } from "../../../src/lib/skill-graph.ts";
import { createConfiguredLlmProvider } from "../../../src/lib/llm-provider.ts";
import { generateDefenseCoachTurn, type DefenseCoachTurn, type DefenseTeacherRole } from "../../../src/lib/defense-chat-skill.ts";
import { generateDefenseReview, type DefensePracticeTurn, type DefenseReview } from "../../../src/lib/defense-review.ts";
import { generateProjectBrief, type ProjectBrief } from "../../../src/lib/project-brief-skill.ts";
import type { KnowledgeChunkRecord } from "../../../src/lib/knowledge-chunks.ts";
import type { TrainingReviewTurn } from "../../../src/lib/training-session.ts";

type SkillExecutionResult = {
  status: SkillStatus;
  output: unknown;
  usedFallback: boolean;
  error?: string;
  retrievalSummary?: SkillInvocationRecord["retrievalSummary"];
  toolCalls: SkillToolCallRecord[];
  outputSummary?: unknown;
};

type SkillHandlerContext = {
  projectId: string;
  projectName: string;
  manifest: BuiltInSkillDefinition;
  payload: Record<string, unknown>;
  parsedPayload: Record<string, unknown>;
  toolLayer: ReturnType<typeof createSkillToolLayer>;
};

export async function invokeBuiltInSkill({
  projectId,
  projectName,
  skillId,
  payload,
}: {
  projectId: string;
  projectName: string;
  skillId: BuiltInSkillId;
  payload: Record<string, unknown>;
}) {
  const toolCalls: SkillToolCallRecord[] = [];
  const manifest = getBuiltInSkill(skillId);
  if (!manifest) {
    throw new Error(`Unknown built-in skill: ${skillId}`);
  }

  const parsedPayload = getSkillSchema(
    manifest.inputSchemaName as Parameters<typeof getSkillSchema>[0],
  ).parse(payload) as Record<string, unknown>;
  const toolLayer = createSkillToolLayer({
    projectId,
    allowedTools: manifest.allowedTools,
    recordToolCall: (call) => {
      toolCalls.push(call);
    },
  });

  const result = await executeBuiltInSkill({
    projectId,
    projectName,
    manifest,
    payload,
    parsedPayload,
    toolLayer,
  });

  return {
    ...result,
    toolCalls,
  };
}

export async function invokeBuiltInSkillWithInvocation({
  projectId,
  projectName,
  skillId,
  trigger,
  payload,
  resolvedBy = "explicit",
  now = () => new Date().toISOString(),
  generateId = () => `skill-${crypto.randomUUID()}`,
}: {
  projectId: string;
  projectName: string;
  skillId: BuiltInSkillId;
  trigger: string;
  payload: Record<string, unknown>;
  resolvedBy?: SkillResolvedBy;
  now?: () => string;
  generateId?: () => string;
}) {
  const manifest = getBuiltInSkill(skillId);
  if (!manifest) {
    throw new Error(`Unknown built-in skill: ${skillId}`);
  }

  const startedAt = now();
  const execution = await traceSkillExecution(
    {
      projectId,
      skillId,
      skillVersion: manifest.version,
      trigger,
      resolvedBy,
      inputSummary: summarizeInput(payload),
      traceTags: manifest.traceTags,
      metadata: {
        skillName: manifest.name,
      },
    },
    async ({ traceId, observationId }) => {
      const result = await invokeBuiltInSkill({
        projectId,
        projectName,
        skillId,
        payload,
      });

      return {
        ...result,
        traceId,
        observationId,
      };
    },
  );
  const completedAt = now();

  const invocation: SkillInvocationRecord = {
    id: generateId(),
    projectId,
    skillName: skillId,
    skillVersion: manifest.version,
    trigger,
    resolvedBy,
    status: execution.status,
    input: payload,
    output: execution.output,
    error: execution.error,
    traceId: execution.traceId ?? undefined,
    langfuseTraceId: execution.traceId ?? undefined,
    langfuseObservationId: execution.observationId ?? undefined,
    usedFallback: execution.usedFallback,
    retrievalSummary: execution.retrievalSummary ?? null,
    toolCalls: execution.toolCalls,
    outputSummary: execution.outputSummary ?? summarizeOutput(execution.output),
    feedbackStatus: "none",
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
  };

  return { output: execution.output, invocation };
}

async function executeBuiltInSkill(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  switch (context.manifest.id) {
    case "project_brief":
      return invokeProjectBrief(context);
    case "slide_script":
      return invokeSlideScript(context);
    case "risk_questions":
      return invokeRiskQuestions(context);
    case "current_slide_followup":
      return invokeCurrentSlideFollowup(context);
    case "teacher_style_followup":
      return invokeTeacherStyleFollowup(context);
    case "rubric_scoring":
      return invokeRubricScoring(context);
    case "member_scope_defense":
      return invokeMemberScopeDefense(context);
    case "evidence_gap_check":
      return invokeEvidenceGapCheck(context);
    case "review_report":
      return invokeReviewReport(context);
    case "weakness_deep_dive":
      return invokeWeaknessDeepDive(context);
    case "content_repurpose":
      return invokeContentRepurpose(context);
    case "fallback_answer":
      return invokeFallbackAnswer(context);
    case "file_outline_explainer":
      return invokeOutlineExplainer(context);
    case "architecture_explainer":
      return invokeArchitectureExplainer(context);
    case "dataset_explainer":
    case "data_survey_explainer":
      return invokeDatasetExplainer(context);
    case "code_explainer":
    case "code_walkthrough":
      return invokeCodeExplainer(context);
    default:
      throw new Error(`Skill not implemented: ${context.manifest.id}`);
  }
}

async function invokeProjectBrief(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const provider = createConfiguredLlmProvider();
  const chunks = await ensureProjectChunks(context);
  try {
    const brief = await runProjectBriefGraph({ provider, projectName: context.projectName, chunks });
    return buildSkillResult("success", brief, {
      toolCalls: [],
      retrievalSummary: createChunkSummary(chunks, "project"),
    });
  } catch (error) {
    return buildSkillResult("fallback", generateProjectBrief({
      projectName: context.projectName,
      chunks,
    }), {
      toolCalls: [],
      retrievalSummary: createChunkSummary(chunks, "project"),
      error,
    });
  }
}

async function invokeSlideScript(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureSlideChunks(context);
  const slideTitle = String(context.parsedPayload.slideTitle ?? "当前页");
  const lines = flattenLines(chunks);
  const keyLines = lines.slice(0, 3);
  const normal = keyLines.length
    ? `这一页主要讲 ${slideTitle}。先说 ${keyLines[0]}。接着补充 ${keyLines[1] ?? "实现路径和证据"}。最后落到 ${keyLines[2] ?? "效果、边界和个人负责范围"}。`
    : `这一页主要讲 ${slideTitle}。建议按“问题背景、实现方式、结果与个人贡献”三步来讲。`;
  const short = keyLines.length
    ? `${slideTitle} 这页的核心是 ${keyLines[0]}，最后要落到你自己的实现和结果。`
    : `${slideTitle} 这页请先讲结论，再讲你的负责范围。`;
  const keywords = Array.from(new Set([
    slideTitle,
    ...keyLines.flatMap((line) => line.split(/[，。；、,\s]+/u)),
  ]))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);

  return buildSkillResult("success", {
    projectName: context.projectName,
    slideTitle,
    normal,
    short,
    keywords,
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "slide", {
      query: slideTitle,
      fileId: readOptionalString(context.parsedPayload.fileId) ?? undefined,
    }),
  });
}

async function invokeRiskQuestions(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const query = readOptionalString(context.parsedPayload.question)
    ?? readOptionalString(context.parsedPayload.slideTitle)
    ?? context.projectName;
  const result = await context.toolLayer.call<Record<string, unknown>, { chunks: KnowledgeChunkRecord[] }>(
    "retrieveRiskQuestions",
    {
      query,
      limit: 8,
    },
  );
  const chunks = result.chunks;
  const lines = flattenLines(chunks);
  const questions = Array.from(new Set([
    `如果老师追问 ${context.projectName} 的核心价值，你会先拿哪条证据回答？`,
    lines.find((line) => line.includes("数据库") || line.includes("字段"))
      ? "如果继续追问数据库或数据字段设计，你会怎么证明这是你负责的？"
      : null,
    lines.find((line) => line.includes("接口") || line.includes("API") || line.includes("service"))
      ? "如果老师继续问接口或主流程，你能不能顺着调用链讲清楚？"
      : null,
    lines.find((line) => line.includes("模型") || line.includes("指标") || line.includes("准确率"))
      ? "如果老师质疑效果指标或实验设计，你准备拿什么数据回应？"
      : null,
    "如果老师继续追问个人贡献和职责边界，你准备怎么证明不是泛泛参与？",
  ].filter((item): item is string => Boolean(item)))).slice(0, 6);

  return buildSkillResult("success", {
    projectName: context.projectName,
    questions,
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "project", {
      query,
    }),
  });
}

async function invokeCurrentSlideFollowup(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const provider = createConfiguredLlmProvider();
  const speechProvider = createConfiguredSpeechProvider();
  const chunks = await ensureSlideChunks(context);
  const parsed = context.parsedPayload;
  let output: DefenseCoachTurn;
  let status: SkillStatus = "success";
  let error: unknown;

  try {
    output = await runDefenseChatGraph({
      provider,
      projectName: context.projectName,
      slideTitle: String(parsed.slideTitle ?? "当前页"),
      slideIndex: Number(parsed.slideIndex ?? 1),
      teacherRole: String(parsed.teacherRole ?? "strict") as DefenseTeacherRole,
      userAnswer: String(parsed.userAnswer ?? ""),
      chunks,
      currentSlideId: readOptionalString(parsed.currentSlideId),
      currentKnowledgeNodeId: readOptionalString(parsed.currentKnowledgeNodeId),
      memberScope: readOptionalString(parsed.memberScope) ?? undefined,
      previousTurns: Array.isArray(parsed.previousTurns)
        ? parsed.previousTurns as Array<{ aiMessage: string; userAnswer: string; score?: number | null }>
        : [],
      sessionState: isRecord(parsed.sessionState) ? parsed.sessionState : undefined,
      retrievedSources: Array.isArray(parsed.retrievedSources)
        ? parsed.retrievedSources as Array<Record<string, unknown>>
        : [],
    });
  } catch (caughtError) {
    output = generateDefenseCoachTurn({
      projectName: context.projectName,
      slideTitle: String(parsed.slideTitle ?? "当前页"),
      slideIndex: Number(parsed.slideIndex ?? 1),
      teacherRole: String(parsed.teacherRole ?? "strict") as DefenseTeacherRole,
      userAnswer: String(parsed.userAnswer ?? ""),
      chunks,
    });
    status = "fallback";
    error = caughtError;
  }

  const speech = speechProvider
    ? await speechProvider.synthesize({ text: output.message }).catch(() => null)
    : null;

  return buildSkillResult(status, {
    ...output,
    speech,
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "slide", {
      query: `${parsed.slideTitle ?? ""}\n${parsed.userAnswer ?? ""}`.trim(),
      fileId: readOptionalString(parsed.fileId) ?? undefined,
      nodeId: readOptionalString(parsed.knowledgeNodeId) ?? undefined,
    }),
    error,
  });
}

async function invokeTeacherStyleFollowup(context: SkillHandlerContext) {
  const parsedPayload = {
    ...context.parsedPayload,
    teacherRole: "strict",
  };
  return invokeCurrentSlideFollowup({
    ...context,
    parsedPayload,
  });
}

async function invokeRubricScoring(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureSlideChunks(context);
  const answer = String(context.parsedPayload.userAnswer ?? "").trim();
  const dimensions = [
    {
      name: "表达清晰度",
      score: answer.length >= 60 ? 84 : answer.length >= 30 ? 72 : 58,
      comment: answer.length >= 30 ? "有基本结构，但还能更紧凑。" : "回答偏短，结论和流程还不够完整。",
    },
    {
      name: "证据支撑度",
      score: chunks.length >= 3 ? 82 : chunks.length >= 1 ? 70 : 52,
      comment: chunks.length >= 1 ? "已经能回到资料依据。" : "暂时没有足够证据来源支撑回答。",
    },
    {
      name: "抗压追问",
      score: answer.includes("异常") || answer.includes("边界") ? 80 : 66,
      comment: answer.includes("异常") || answer.includes("边界")
        ? "已经主动提到异常或边界。"
        : "还可以主动补一句异常场景或边界条件。",
    },
  ];
  const overallScore = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  return buildSkillResult("success", {
    overallScore,
    dimensions,
    summary: overallScore >= 80 ? "评分较稳，重点补表达压缩。" : "评分还有提升空间，优先补证据链和个人负责范围。",
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "slide"),
  });
}

async function invokeMemberScopeDefense(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const answer = String(context.parsedPayload.userAnswer ?? "");
  const memberScope = String(context.parsedPayload.memberScope ?? "");
  const mentionsScope = Boolean(memberScope && answer.includes("我负责"));
  const risks = mentionsScope
    ? []
    : ["个人负责范围没有讲清楚，容易被老师继续追问具体贡献。"];

  return buildSkillResult("success", {
    scopeStatement: memberScope
      ? `建议直接说：${memberScope}`
      : "建议补一句“我负责的部分主要是接口、数据流和落库逻辑”。",
    scopeClarityScore: mentionsScope ? 86 : 60,
    risks,
    followUp: mentionsScope
      ? "如果继续追问，实现细节优先落到你负责的接口或代码路径。"
      : "下一句请先明确自己负责的模块，再解释该模块的输入、处理和结果。",
  }, {
    toolCalls: [],
  });
}

async function invokeEvidenceGapCheck(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureSlideChunks(context);
  const answer = String(context.parsedPayload.userAnswer ?? "");
  const gaps = [
    !answer.includes("数据库") && chunks.some((chunk) => chunk.content.includes("数据库"))
      ? "回答没有解释数据库或数据存储设计。"
      : null,
    !answer.includes("我负责") && !answer.includes("个人")
      ? "回答没有明确个人负责范围。"
      : null,
    answer.length < 30 ? "回答偏短，结论与证据链不够完整。" : null,
  ].filter(Boolean) as string[];

  return buildSkillResult("success", {
    summary: gaps.length ? `发现 ${gaps.length} 处证据或表达缺口。` : "当前回答没有明显证据缺口。",
    gaps,
    missingEvidence: gaps.length
      ? ["建议补一条 PPT / README / 代码路径 / 数据字段依据。"]
      : [],
    citations: citationsForChunks(chunks),
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "slide"),
  });
}

async function invokeReviewReport(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const provider = createConfiguredLlmProvider();
  const turns = (context.parsedPayload.turns as TrainingReviewTurn[] | DefensePracticeTurn[] | undefined) ?? [];
  try {
    const review = await runDefenseReviewGraph({
      provider,
      projectName: context.projectName,
      turns: turns as DefensePracticeTurn[],
      sessionState: isRecord(context.parsedPayload.sessionState) ? context.parsedPayload.sessionState : undefined,
    });
    return buildSkillResult("success", review, { toolCalls: [] });
  } catch (error) {
    return buildSkillResult("fallback", generateDefenseReview({
      projectName: context.projectName,
      turns: turns as DefensePracticeTurn[],
    }), {
      toolCalls: [],
      error,
    });
  }
}

async function invokeWeaknessDeepDive(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureKnowledgeNodeChunks(context);
  const title = String(context.parsedPayload.title ?? "待补强问题");
  return buildSkillResult("success", {
    projectName: context.projectName,
    title,
    explanation: `${title} 需要补充“业务流程 + 证据链 + 个人负责范围”三层说明。`,
    checklist: [
      "补一版 30 秒口头回答。",
      "补一个能落到代码或数据库的证据点。",
      "补一句明确个人负责范围的话术。",
    ],
    evidence: chunks.slice(0, 3).map((chunk) => chunk.content),
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "knowledge-node"),
  });
}

async function invokeContentRepurpose(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const summary = String(context.parsedPayload.summary ?? `${context.projectName} 是一个课程项目答辩案例。`);
  return buildSkillResult("success", {
    projectName: context.projectName,
    qqSpaceSummary: `${context.projectName}：${summary} 今天完成了一轮答辩训练，重点补强系统架构和个人贡献表达。`,
    weishiScript: `大家好，今天用 30 秒介绍一下 ${context.projectName}。它解决的问题是……我负责的部分是……最后我们通过一轮 AI 模拟答辩把高危追问补齐了。`,
    tencentVideoScript: `${context.projectName} 是一个面向课程答辩的项目。视频将按“背景、方案、实现、结果、个人贡献”五段展开。`,
  }, {
    toolCalls: [],
  });
}

async function invokeFallbackAnswer(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureProjectChunks(context);
  const reason = String(context.parsedPayload.reason ?? "当前资料不足或主技能执行失败。");
  return buildSkillResult("success", {
    answer: chunks.length
      ? `我先基于现有资料给你一个保守回答：${chunks[0]?.content.slice(0, 90) ?? "请补充更多资料。"}`
      : "我暂时没有足够资料给出可靠回答，建议先补充 PPT、README、代码或数据库资料。",
    nextStep: reason,
    citations: citationsForChunks(chunks),
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "project"),
  });
}

async function invokeOutlineExplainer(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureFileChunks(context);
  const title = String(context.parsedPayload.title ?? "当前资料");
  const bullets = chunks
    .slice(0, 5)
    .flatMap((chunk) => chunk.content.split(/\r?\n/u))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
  return buildSkillResult("success", {
    title,
    summary: `${title} 目前最值得先讲的重点是大纲、关键结论和能落到证据的部分。`,
    bullets,
    citations: citationsForChunks(chunks),
    followUps: bullets.length ? ["如果老师追问，实现或数据依据在哪里？"] : [],
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "file"),
  });
}

async function invokeArchitectureExplainer(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureKnowledgeNodeChunks(context);
  const title = String(context.parsedPayload.title ?? "架构节点");
  return buildSkillResult("success", {
    title,
    summary: `${title} 这部分建议按“角色 -> 模块 -> 数据流 -> 落地证据”来讲。`,
    bullets: deriveArchitectureBullets(chunks),
    citations: citationsForChunks(chunks),
    followUps: ["如果继续追问，请补充调用链和状态流转。"],
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "knowledge-node"),
  });
}

async function invokeDatasetExplainer(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureFileChunks(context);
  const title = String(context.parsedPayload.title ?? "数据资料");
  const bullets = deriveDatasetBullets(chunks);
  return buildSkillResult("success", {
    title,
    summary: `${title} 这部分建议重点讲字段含义、数据口径和异常处理。`,
    bullets,
    citations: citationsForChunks(chunks),
    followUps: ["如果老师追问，请补充数据来源和清洗边界。"],
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "file"),
  });
}

async function invokeCodeExplainer(context: SkillHandlerContext): Promise<SkillExecutionResult> {
  const chunks = await ensureCodeChunks(context);
  const title = String(context.parsedPayload.title ?? "代码实现");
  const codePath = chunks.find((chunk) => typeof chunk.metadata?.codePath === "string")?.metadata.codePath;
  return buildSkillResult("success", {
    title,
    summary: codePath
      ? `建议从 ${codePath} 这条路径开始讲，先说明入口，再说明主流程和异常处理。`
      : "建议先说明代码入口、主流程和异常处理。",
    bullets: deriveCodeBullets(chunks),
    citations: citationsForChunks(chunks),
    followUps: ["如果现场看代码，请先从入口文件和主逻辑开始解释。"],
  }, {
    toolCalls: [],
    retrievalSummary: createChunkSummary(chunks, "file"),
  });
}

async function ensureProjectChunks(context: SkillHandlerContext) {
  const payloadChunks = getChunks(context.payload);
  if (payloadChunks.length) return payloadChunks;
  const result = await context.toolLayer.call<Record<string, unknown>, { chunks: KnowledgeChunkRecord[] }>(
    "retrieveProjectContext",
    {
      query: readOptionalString(context.parsedPayload.query) ?? context.projectName,
      limit: 8,
    },
  );
  return result.chunks;
}

async function ensureSlideChunks(context: SkillHandlerContext) {
  const payloadChunks = getChunks(context.payload);
  if (payloadChunks.length) return payloadChunks;
  const result = await context.toolLayer.call<Record<string, unknown>, { chunks: KnowledgeChunkRecord[] }>(
    "retrieveSlideContext",
    {
      query: `${context.parsedPayload.slideTitle ?? ""}\n${context.parsedPayload.userAnswer ?? ""}`.trim(),
      limit: 6,
      fileId: readOptionalString(context.parsedPayload.fileId),
      sourceId: readOptionalString(context.parsedPayload.sourceId),
      slideId: readOptionalString(context.parsedPayload.slideId) ?? readOptionalString(context.parsedPayload.currentSlideId),
    },
  );
  return result.chunks;
}

async function ensureKnowledgeNodeChunks(context: SkillHandlerContext) {
  const payloadChunks = getChunks(context.payload);
  if (payloadChunks.length) return payloadChunks;
  const result = await context.toolLayer.call<Record<string, unknown>, { chunks: KnowledgeChunkRecord[] }>(
    "retrieveKnowledgeNodeContext",
    {
      nodeId: readOptionalString(context.parsedPayload.nodeId) ?? readOptionalString(context.parsedPayload.knowledgeNodeId),
      query: readOptionalString(context.parsedPayload.question) ?? readOptionalString(context.parsedPayload.title),
      limit: 6,
    },
  );
  return result.chunks;
}

async function ensureFileChunks(context: SkillHandlerContext) {
  const payloadChunks = getChunks(context.payload);
  if (payloadChunks.length) return payloadChunks;
  const result = await context.toolLayer.call<Record<string, unknown>, { chunks: KnowledgeChunkRecord[] }>(
    "retrieveFileContext",
    {
      fileId: readOptionalString(context.parsedPayload.fileId),
      query: readOptionalString(context.parsedPayload.question) ?? readOptionalString(context.parsedPayload.title),
      limit: 6,
    },
  );
  return result.chunks;
}

async function ensureCodeChunks(context: SkillHandlerContext) {
  const payloadChunks = getChunks(context.payload);
  if (payloadChunks.length) return payloadChunks;
  const result = await context.toolLayer.call<Record<string, unknown>, { chunks: KnowledgeChunkRecord[] }>(
    "retrieveCodeContext",
    {
      fileId: readOptionalString(context.parsedPayload.fileId),
      query: readOptionalString(context.parsedPayload.question) ?? readOptionalString(context.parsedPayload.title),
      limit: 6,
    },
  );
  return result.chunks;
}

function buildSkillResult(
  status: SkillStatus,
  output: unknown,
  options: {
    toolCalls: SkillToolCallRecord[];
    retrievalSummary?: SkillInvocationRecord["retrievalSummary"];
    error?: unknown;
  },
): SkillExecutionResult {
  return {
    status,
    output,
    usedFallback: status !== "success",
    error: options.error instanceof Error ? options.error.message : undefined,
    retrievalSummary: options.retrievalSummary ?? null,
    toolCalls: options.toolCalls,
    outputSummary: summarizeOutput(output),
  };
}

function summarizeInput(payload: Record<string, unknown>) {
  return {
    keys: Object.keys(payload).sort(),
    chunkCount: Array.isArray(payload.chunks) ? payload.chunks.length : 0,
    hasQuestion: typeof payload.question === "string",
    hasTurns: Array.isArray(payload.turns) ? payload.turns.length : 0,
  };
}

function summarizeOutput(output: unknown) {
  if (isRecord(output)) {
    if (typeof output.summary === "string") {
      return { summary: output.summary.slice(0, 200) };
    }
    if (typeof output.message === "string") {
      return { message: output.message.slice(0, 200) };
    }
    if (typeof output.answer === "string") {
      return { answer: output.answer.slice(0, 200) };
    }
  }
  return output;
}

function createChunkSummary(
  chunks: KnowledgeChunkRecord[],
  scope: string,
  extra: Partial<NonNullable<SkillInvocationRecord["retrievalSummary"]>> = {},
): NonNullable<SkillInvocationRecord["retrievalSummary"]> {
  const sourceIds = chunks
    .map((chunk) => readOptionalString(chunk.metadata?.sourceId))
    .filter((value): value is string => Boolean(value));
  return {
    scope,
    chunkCount: chunks.length,
    mode: "hybrid",
    sourceIds: Array.from(new Set(sourceIds)),
    ...extra,
  };
}

function getChunks(payload: Record<string, unknown>) {
  return Array.isArray(payload.chunks) ? payload.chunks as KnowledgeChunkRecord[] : [];
}

function citationsForChunks(chunks: KnowledgeChunkRecord[]) {
  return chunks.slice(0, 6).map((chunk) => ({
    source: chunk.source,
    fileName: readOptionalString(chunk.metadata?.fileName) ?? undefined,
    lineStart: readOptionalNumber(chunk.metadata?.lineStart) ?? undefined,
    lineEnd: readOptionalNumber(chunk.metadata?.lineEnd) ?? undefined,
    codePath: readOptionalString(chunk.metadata?.codePath) ?? undefined,
    page: readOptionalNumber(chunk.metadata?.page) ?? undefined,
    slide: readOptionalNumber(chunk.metadata?.slide) ?? undefined,
  }));
}

function deriveArchitectureBullets(chunks: KnowledgeChunkRecord[]) {
  const lines = flattenLines(chunks);
  return [
    lines.find((line) => line.includes("前端") || line.includes("客户端")) ?? "先说明前端或调用方入口。",
    lines.find((line) => line.includes("后端") || line.includes("服务")) ?? "再说明后端服务或核心模块。",
    lines.find((line) => line.includes("数据库") || line.includes("数据")) ?? "最后说明数据库或数据流去向。",
  ];
}

function deriveDatasetBullets(chunks: KnowledgeChunkRecord[]) {
  const lines = flattenLines(chunks);
  return Array.from(new Set([
    lines.find((line) => line.includes("字段") || line.includes("列")) ?? "说明关键字段和指标含义。",
    lines.find((line) => line.includes("来源")) ?? "说明数据来源和口径。",
    lines.find((line) => line.includes("异常") || line.includes("缺失")) ?? "说明异常值、缺失值和清洗边界。",
  ]));
}

function deriveCodeBullets(chunks: KnowledgeChunkRecord[]) {
  const lines = flattenLines(chunks);
  return Array.from(new Set([
    lines.find((line) => line.includes("function") || line.includes("export")) ?? "先说明入口函数或控制器。",
    lines.find((line) => line.includes("service") || line.includes("handler")) ?? "再说明主逻辑处理步骤。",
    lines.find((line) => line.includes("error") || line.includes("catch")) ?? "最后说明异常处理或边界条件。",
  ]));
}

function flattenLines(chunks: KnowledgeChunkRecord[]) {
  return chunks
    .flatMap((chunk) => chunk.content.split(/\r?\n/u))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
