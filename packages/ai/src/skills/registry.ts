import type { BuiltInSkillDefinition } from "@shared/domain";

const builtInSkills: BuiltInSkillDefinition[] = [
  {
    id: "project_brief",
    name: "项目速记卡",
    description: "基于项目资料生成答辩速记卡。",
    trigger: { mode: "workspace", event: "page_load" },
    output: { type: "project_brief" },
    projectTypes: ["software_ai_data", "general"],
  },
  {
    id: "slide_script",
    name: "逐页讲稿",
    description: "基于当前页资料生成讲稿、30 秒版和关键词版。",
    trigger: { mode: "workspace", event: "page_load" },
    output: { type: "slide_script" },
    projectTypes: ["software_ai_data", "general"],
  },
  {
    id: "risk_questions",
    name: "高危追问",
    description: "提炼老师最可能追问的高风险问题。",
    trigger: { mode: "workspace", event: "page_load" },
    output: { type: "risk_questions" },
    projectTypes: ["software_ai_data", "general"],
  },
  {
    id: "current_slide_followup",
    name: "当前页追问",
    description: "围绕当前 PPT 页持续追问并给出提示。",
    trigger: { mode: "defense", event: "user_finished_slide" },
    output: { type: "teacher_followup" },
    projectTypes: ["software_ai_data", "course_presentation", "general"],
  },
  {
    id: "weakness_deep_dive",
    name: "薄弱点钻研",
    description: "把答不上来的问题转成证据链和学习清单。",
    trigger: { mode: "deep_dive", event: "request_followup" },
    output: { type: "deep_dive" },
    projectTypes: ["software_ai_data", "general"],
  },
  {
    id: "review_report",
    name: "复盘报告",
    description: "结束训练后提炼薄弱点、得分和下一轮建议。",
    trigger: { mode: "review", event: "review_generate" },
    output: { type: "review_report" },
    projectTypes: ["software_ai_data", "general"],
  },
  {
    id: "content_repurpose",
    name: "内容二次创作",
    description: "把训练结果转成 QQ 空间摘要和视频口播稿。",
    trigger: { mode: "export", event: "content_export" },
    output: { type: "content_export" },
    projectTypes: ["software_ai_data", "competition_pitch", "general"],
  },
];

export function listBuiltInSkills() {
  return [...builtInSkills];
}

export function getBuiltInSkill(skillId: BuiltInSkillDefinition["id"]) {
  return builtInSkills.find((skill) => skill.id === skillId) ?? null;
}
