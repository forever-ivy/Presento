import type {
  BuiltInSkillId,
  BuiltInSkillPackId,
  ProjectType,
  SkillResolutionResult,
  SkillTrigger,
} from "@shared/domain";
import { getBuiltInSkill, listBuiltInSkills } from "./registry.ts";

export type SkillResolutionInput = {
  explicitSkillId?: BuiltInSkillId | null;
  enabledPackIds: BuiltInSkillPackId[];
  projectType?: ProjectType;
  mode: SkillTrigger["mode"];
  event: string;
  fileKind?: string;
  pageKind?: string;
  trainingState?: Record<string, unknown>;
};

export function resolveBuiltInSkill(input: SkillResolutionInput): SkillResolutionResult {
  if (input.explicitSkillId) {
    const skill = getBuiltInSkill(input.explicitSkillId);
    if (!skill) {
      throw new Error(`Unknown built-in skill: ${input.explicitSkillId}`);
    }
    return {
      resolvedBy: "explicit",
      selectedSkillId: skill.id,
      reason: "业务侧明确指定了 skillId。",
      recommendations: buildRecommendations(input),
    };
  }

  const recommendations = buildRecommendations(input);
  const first = recommendations[0];
  if (!first) {
    return {
      resolvedBy: "router",
      selectedSkillId: "fallback_answer",
      reason: "没有匹配到更具体的技能，退回统一兜底技能。",
      recommendations: [
        {
          skillId: "fallback_answer",
          reason: "当前上下文没有命中更明确的技能触发条件。",
          packId: "deep-dive",
          priority: 1,
        },
      ],
    };
  }

  return {
    resolvedBy: "router",
    selectedSkillId: first.skillId,
    reason: first.reason,
    recommendations,
  };
}

function buildRecommendations(input: SkillResolutionInput) {
  const allowedSkills = listBuiltInSkills().filter((skill) =>
    skill.packIds.some((packId) => input.enabledPackIds.includes(packId))
    && (!input.projectType || skill.projectTypes.includes(input.projectType) || skill.projectTypes.includes("general"))
  );

  const scored = allowedSkills.map((skill) => ({
    skillId: skill.id,
    packId: skill.packIds.find((packId) => input.enabledPackIds.includes(packId)),
    priority: scoreSkill(skill.id, input),
    reason: reasonForSkill(skill.id, input),
  }))
    .filter((item) => item.priority > 0)
    .sort((left, right) => right.priority - left.priority);

  return scored;
}

function scoreSkill(skillId: BuiltInSkillId, input: SkillResolutionInput) {
  const { mode, event, fileKind, trainingState } = input;

  if (mode === "defense" && event === "user_finished_slide") {
    if (skillId === "current_slide_followup") return 100;
    if (skillId === "rubric_scoring") return 92;
    if (skillId === "evidence_gap_check") return 90;
    if (skillId === "member_scope_defense") return 88;
    if (skillId === "teacher_style_followup") return 86;
  }

  if (mode === "review" && event === "review_generate") {
    if (skillId === "review_report") return 100;
    if (skillId === "weakness_deep_dive") return 95;
  }

  if (mode === "workspace" && event === "page_load") {
    if (skillId === "project_brief") return 95;
    if (skillId === "slide_script") return 90;
    if (skillId === "risk_questions") return 86;
  }

  if (mode === "file_explanation") {
    if (fileKind === "code") {
      if (skillId === "code_walkthrough") return 100;
      if (skillId === "code_explainer") return 96;
    }
    if (fileKind === "dataset" || fileKind === "database") {
      if (skillId === "dataset_explainer") return 100;
      if (skillId === "data_survey_explainer") return 96;
    }
    if (skillId === "file_outline_explainer") return 88;
    if (skillId === "architecture_explainer") return 84;
  }

  if (mode === "deep_dive" && event === "request_followup" && skillId === "weakness_deep_dive") {
    return 100;
  }

  if (mode === "export" && event === "content_export" && skillId === "content_repurpose") {
    return 100;
  }

  if (skillId === "fallback_answer") {
    return typeof trainingState?.shouldFinish === "boolean" ? 10 : 5;
  }

  return 0;
}

function reasonForSkill(skillId: BuiltInSkillId, input: SkillResolutionInput) {
  const { mode, fileKind } = input;

  switch (skillId) {
    case "current_slide_followup":
      return "当前是模拟答辩回合结束，优先进入当前页追问分析。";
    case "rubric_scoring":
      return "当前是答辩回合分析，补充结构化评分量表。";
    case "evidence_gap_check":
      return "当前需要检查回答里的证据缺口。";
    case "member_scope_defense":
      return "当前需要单独检查个人负责范围是否说清楚。";
    case "teacher_style_followup":
      return "当前需要更强老师风格的追加追问。";
    case "review_report":
      return "当前是训练结束复盘场景，优先生成复盘报告。";
    case "weakness_deep_dive":
      return "当前需要把薄弱点转成深挖任务。";
    case "project_brief":
      return "当前在工作台首页，优先生成项目速记卡。";
    case "slide_script":
      return "当前在工作台页面加载场景，适合生成逐页讲稿。";
    case "risk_questions":
      return "当前页面适合预生成高危追问。";
    case "code_walkthrough":
      return fileKind === "code"
        ? "当前文件是代码来源，优先做代码走查。"
        : "当前上下文更适合代码走查。";
    case "code_explainer":
      return "当前问题更偏代码解释。";
    case "dataset_explainer":
      return "当前文件是数据或数据库资料，优先做数据集讲解。";
    case "data_survey_explainer":
      return "当前问题更偏数据说明。";
    case "file_outline_explainer":
      return "当前资料适合先给出大纲和重点。";
    case "architecture_explainer":
      return "当前资料更偏架构节点说明。";
    case "content_repurpose":
      return "当前需要把训练结果转成内容导出。";
    case "fallback_answer":
      return `当前 ${mode} 场景没有命中更明确的技能，退回统一兜底。`;
  }
}
