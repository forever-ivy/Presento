import type { BuiltInSkillDefinition, SkillInvocationRecord, SkillStatus } from "@shared/domain";
import { createConfiguredSpeechProvider } from "./providers/speech.ts";
import { getBuiltInSkill } from "./skills/registry.ts";
import { runDefenseChatGraph, runDefenseReviewGraph, runProjectBriefGraph } from "../../../src/lib/skill-graph.ts";
import { createConfiguredLlmProvider } from "../../../src/lib/llm-provider.ts";
import { generateDefenseCoachTurn, type DefenseTeacherRole } from "../../../src/lib/defense-chat-skill.ts";
import { generateDefenseReview, type DefensePracticeTurn } from "../../../src/lib/defense-review.ts";
import { generateProjectBrief } from "../../../src/lib/project-brief-skill.ts";
import type { KnowledgeChunkRecord } from "../../../src/lib/knowledge-chunks.ts";

export async function invokeBuiltInSkill({
  projectName,
  skillId,
  payload,
}: {
  projectName: string;
  skillId: BuiltInSkillDefinition["id"];
  payload: Record<string, unknown>;
}) {
  const skill = getBuiltInSkill(skillId);
  if (!skill) {
    throw new Error(`Unknown built-in skill: ${skillId}`);
  }

  switch (skillId) {
    case "project_brief":
      return invokeProjectBrief(projectName, payload);
    case "current_slide_followup":
      return invokeCurrentSlideFollowup(projectName, payload);
    case "review_report":
      return invokeReviewReport(projectName, payload);
    case "slide_script":
      return invokeSlideScript(projectName, payload);
    case "risk_questions":
      return invokeRiskQuestions(projectName, payload);
    case "weakness_deep_dive":
      return invokeWeaknessDeepDive(projectName, payload);
    case "content_repurpose":
      return invokeContentRepurpose(projectName, payload);
    default:
      throw new Error(`Skill not implemented: ${skill.id}`);
  }
}

export async function invokeBuiltInSkillWithInvocation({
  projectId,
  projectName,
  skillId,
  trigger,
  payload,
  now = () => new Date().toISOString(),
  generateId = () => `skill-${crypto.randomUUID()}`,
}: {
  projectId: string;
  projectName: string;
  skillId: BuiltInSkillDefinition["id"];
  trigger: string;
  payload: Record<string, unknown>;
  now?: () => string;
  generateId?: () => string;
}) {
  const startedAt = now();
  const { status, output } = await invokeBuiltInSkill({
    projectName,
    skillId,
    payload,
  });
  const completedAt = now();
  const invocation: SkillInvocationRecord = {
    id: generateId(),
    projectId,
    skillName: skillId,
    trigger,
    status,
    input: payload,
    output,
    usedFallback: status !== "success",
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)),
  };

  return { output, invocation };
}

async function invokeProjectBrief(projectName: string, payload: Record<string, unknown>) {
  const provider = createConfiguredLlmProvider();
  const chunks = getChunks(payload);
  try {
    const brief = await runProjectBriefGraph({ provider, projectName, chunks });
    return { status: "success" as SkillStatus, output: brief };
  } catch {
    return {
      status: "fallback" as SkillStatus,
      output: generateProjectBrief({ projectName, chunks }),
    };
  }
}

async function invokeCurrentSlideFollowup(projectName: string, payload: Record<string, unknown>) {
  const provider = createConfiguredLlmProvider();
  const speechProvider = createConfiguredSpeechProvider();
  const chunks = getChunks(payload);
  const slideTitle = String(payload.slideTitle ?? "当前页");
  const slideIndex = Number(payload.slideIndex ?? 1);
  const teacherRole = (payload.teacherRole as DefenseTeacherRole | undefined) ?? "strict";
  const userAnswer = String(payload.userAnswer ?? "");

  let output;
  let status: SkillStatus = "success";

  try {
    output = await runDefenseChatGraph({
      provider,
      projectName,
      slideTitle,
      slideIndex,
      teacherRole,
      userAnswer,
      chunks,
    });
  } catch {
    output = generateDefenseCoachTurn({
      projectName,
      slideTitle,
      slideIndex,
      teacherRole,
      userAnswer,
      chunks,
    });
    status = "fallback";
  }

  const speech = speechProvider
    ? await speechProvider
        .synthesize({
          text: output.message,
        })
        .catch(() => null)
    : null;

  return {
    status,
    output: {
      ...output,
      speech,
    },
  };
}

async function invokeReviewReport(projectName: string, payload: Record<string, unknown>) {
  const provider = createConfiguredLlmProvider();
  const turns = (payload.turns as DefensePracticeTurn[] | undefined) ?? [];
  try {
    const review = await runDefenseReviewGraph({ provider, projectName, turns });
    return { status: "success" as SkillStatus, output: review };
  } catch {
    return {
      status: "fallback" as SkillStatus,
      output: generateDefenseReview({ projectName, turns }),
    };
  }
}

async function invokeSlideScript(projectName: string, payload: Record<string, unknown>) {
  const slideTitle = String(payload.slideTitle ?? "当前页");
  const evidence = getChunks(payload).slice(0, 3).map((chunk) => chunk.content).join("\n");
  return {
    status: "fallback" as SkillStatus,
    output: {
      projectName,
      slideTitle,
      normal: `${slideTitle} 这一页先交代结论，再讲流程，最后强调你个人负责的实现部分。${evidence ? ` 证据：${evidence}` : ""}`.trim(),
      short: `${slideTitle}：先讲结论，再讲你负责的实现。`,
      keywords: buildKeywords(evidence || slideTitle),
    },
  };
}

async function invokeRiskQuestions(projectName: string, payload: Record<string, unknown>) {
  const evidence = getChunks(payload).map((chunk) => chunk.content).join("\n");
  return {
    status: "fallback" as SkillStatus,
    output: {
      projectName,
      questions: [
        evidence.includes("订单")
          ? "订单状态流转怎么设计？异常取消怎么处理？"
          : "这一页最核心的业务流程是什么？",
        evidence.includes("数据库")
          ? "数据库为什么这样拆表？冗余字段的理由是什么？"
          : "这部分的数据依据来自哪里？",
        "这一块是不是你负责的？如果现场看代码，你会从哪个文件开始解释？",
      ],
    },
  };
}

async function invokeWeaknessDeepDive(projectName: string, payload: Record<string, unknown>) {
  const title = String(payload.title ?? "待补强问题");
  const evidence = getChunks(payload).slice(0, 2).map((chunk) => chunk.content);
  return {
    status: "fallback" as SkillStatus,
    output: {
      projectName,
      title,
      explanation: `${title} 需要补充“业务流程 + 证据链 + 个人负责范围”三层说明。`,
      checklist: [
        "补一版 30 秒口头回答。",
        "补一个能落到代码或数据库的证据点。",
        "补一句明确个人负责范围的话术。",
      ],
      evidence,
    },
  };
}

async function invokeContentRepurpose(projectName: string, payload: Record<string, unknown>) {
  const summary = String(payload.summary ?? `${projectName} 是一个课程项目答辩案例。`);
  return {
    status: "fallback" as SkillStatus,
    output: {
      projectName,
      qqSpaceSummary: `${projectName}：${summary} 今天完成了一轮答辩训练，重点补强系统架构和个人贡献表达。`,
      weishiScript: `大家好，今天用 30 秒介绍一下 ${projectName}。它解决的问题是……我负责的部分是……最后我们通过一轮 AI 模拟答辩把高危追问补齐了。`,
      tencentVideoScript: `${projectName} 是一个面向课程答辩的项目。视频将按“背景、方案、实现、结果、个人贡献”五段展开。`,
    },
  };
}

function getChunks(payload: Record<string, unknown>) {
  return (payload.chunks as KnowledgeChunkRecord[] | undefined) ?? [];
}

function buildKeywords(text: string) {
  return Array.from(new Set(text.match(/[\p{L}\p{N}_]{2,}/gu) ?? []))
    .slice(0, 6);
}
