import { apiOk } from "../_utils";

export const runtime = "nodejs";

const skillPacks = [
  {
    id: "core-training",
    name: "Core Training",
    description: "项目速记、逐页讲稿、当前页追问、复盘报告。",
    scope: "system",
    skills: ["project_brief", "slide_script", "current_slide_followup", "review_report"],
  },
  {
    id: "deep-dive",
    name: "Deep Dive",
    description: "高危追问、薄弱点钻研、内容再创作。",
    scope: "system",
    skills: ["risk_questions", "weakness_deep_dive", "content_repurpose"],
  },
];

export async function GET() {
  return apiOk({ skillPacks });
}
