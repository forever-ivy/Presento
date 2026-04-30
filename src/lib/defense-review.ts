import type { DefenseTeacherRole } from "./defense-chat-skill.ts";

export type DefensePracticeTurn = {
  id: string;
  projectId: string;
  sessionId?: string;
  slideId?: string | null;
  slideIndex: number;
  slideTitle: string;
  knowledgeNodeId?: string | null;
  teacherRole: DefenseTeacherRole;
  userAnswer: string;
  aiMessage: string;
  score: number;
  strengths: string[];
  risks: string[];
  improvedAnswer: string;
  followUps: string[];
  retrievedSourceIds?: string[];
  speech?: Record<string, unknown> | null;
  citations: Array<{
    source: string;
    fileName: string;
    lineStart: number;
    lineEnd: number;
  }>;
  createdAt: string;
};

export type DefenseReview = {
  projectName: string;
  totalTurns: number;
  averageScore: number;
  scoreLabel: string;
  clarityScore: number;
  evidenceScore: number;
  pressureScore: number;
  summary: string;
  strengths: string[];
  weaknesses: Array<{
    title: string;
    count: number;
    evidence: string;
  }>;
  betterAnswers: Array<{
    title: string;
    answer: string;
    slideTitle: string;
  }>;
  nextActions: string[];
  recommendedSkills: string[];
  citations: DefensePracticeTurn["citations"];
  deepDiveRefs?: Array<{
    weaknessId: string;
    deepDiveId: string;
    title: string;
  }>;
  generatedAt: string;
};

export function generateDefenseReview({
  projectName,
  turns,
  generatedAt = new Date().toISOString(),
}: {
  projectName: string;
  turns: DefensePracticeTurn[];
  generatedAt?: string;
}): DefenseReview {
  if (turns.length === 0) {
    return {
      projectName,
      totalTurns: 0,
      averageScore: 0,
      scoreLabel: "还没有训练记录",
      clarityScore: 0,
      evidenceScore: 0,
      pressureScore: 0,
      summary: "还没有同屏答辩训练记录。先完成一轮回答，系统会沉淀薄弱点和复盘建议。",
      strengths: [],
      weaknesses: [
        {
          title: "先完成一轮同屏答辩",
          count: 1,
          evidence: "暂无训练记录",
        },
      ],
      betterAnswers: [],
      nextActions: ["进入 PPT 同屏答辩，至少回答 3 个老师追问。"],
      recommendedSkills: ["current_slide_followup"],
      citations: [],
      generatedAt,
    };
  }

  const averageScore = Math.round(
    turns.reduce((total, turn) => total + turn.score, 0) / turns.length,
  );
  const weaknesses = groupRisks(turns);
  const strengths = unique(turns.flatMap((turn) => turn.strengths)).slice(0, 4);
  const clarityScore = scoreTurnAspect(turns, (turn) => (
    turn.userAnswer.length >= 40 ? 80 : 60
  ) + (turn.strengths.some((item) => item.includes("主流程")) ? 8 : 0));
  const evidenceScore = scoreTurnAspect(turns, (turn) => (
    turn.citations.length > 0 ? 78 : 56
  ) + (turn.risks.some((risk) => risk.includes("资料")) ? -10 : 0));
  const pressureScore = scoreTurnAspect(turns, (turn) => (
    Math.max(45, turn.score) - (turn.risks.some((risk) => risk.includes("异常")) ? 6 : 0)
  ));

  return {
    projectName,
    totalTurns: turns.length,
    averageScore,
    scoreLabel: labelForScore(averageScore),
    clarityScore,
    evidenceScore,
    pressureScore,
    summary: `${projectName} 已完成 ${turns.length} 轮同屏答辩训练，平均分 ${averageScore}/100。`,
    strengths,
    weaknesses,
    betterAnswers: buildBetterAnswers(turns),
    nextActions: nextActionsForWeaknesses(weaknesses),
    recommendedSkills: recommendedSkillsForWeaknesses(weaknesses),
    citations: uniqueCitations(turns.flatMap((turn) => turn.citations)),
    generatedAt,
  };
}

function groupRisks(turns: DefensePracticeTurn[]) {
  const counts = new Map<string, { count: number; evidence: string }>();
  for (const turn of turns) {
    for (const risk of turn.risks) {
      const normalized = normalizeRisk(risk);
      const current = counts.get(normalized);
      counts.set(normalized, {
        count: (current?.count ?? 0) + 1,
        evidence: current?.evidence ?? `第 ${turn.slideIndex} 页「${turn.slideTitle}」`,
      });
    }
  }

  return Array.from(counts.entries())
    .map(([title, value]) => ({
      title,
      count: value.count,
      evidence: value.evidence,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function normalizeRisk(risk: string) {
  if (risk.includes("订单状态")) return "订单状态流转没有讲完整";
  if (risk.includes("数据库")) return "数据库设计解释不够具体";
  if (risk.includes("个人贡献")) return "个人贡献没有说清楚";
  if (risk.includes("资料")) return "资料依据不足";
  if (risk.includes("回答偏短")) return "回答偏短，缺少流程和边界情况";
  return risk;
}

function nextActionsForWeaknesses(weaknesses: DefenseReview["weaknesses"]) {
  const actions = weaknesses.map((weakness) => {
    if (weakness.title.includes("订单状态")) {
      return "补一版订单状态流转 30 秒回答，包含创建、接单、取消和异常处理。";
    }
    if (weakness.title.includes("数据库")) {
      return "整理数据库表关系说明，重点解释 orders 与 order_items 的关系。";
    }
    if (weakness.title.includes("个人贡献")) {
      return "补充个人贡献回答，明确自己负责的接口、表设计和可现场解释的代码路径。";
    }
    return `针对「${weakness.title}」补一条可引用资料的答辩回答。`;
  });

  return unique(actions).slice(0, 5);
}

function labelForScore(score: number) {
  if (score >= 85) return "答得稳，可以加强表达";
  if (score >= 70) return "基本能答，但需要补证据链";
  if (score >= 50) return "能开口，但薄弱点明显";
  return "风险较高，需要先钻研项目";
}

function scoreTurnAspect(
  turns: DefensePracticeTurn[],
  scoreTurn: (turn: DefensePracticeTurn) => number,
) {
  return Math.round(
    turns.reduce((total, turn) => total + scoreTurn(turn), 0) / turns.length,
  );
}

function buildBetterAnswers(turns: DefensePracticeTurn[]) {
  return turns
    .filter((turn) => turn.improvedAnswer.trim())
    .slice()
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((turn) => ({
      title: turn.risks[0] ?? `${turn.slideTitle} 改答`,
      answer: turn.improvedAnswer,
      slideTitle: turn.slideTitle,
    }));
}

function recommendedSkillsForWeaknesses(weaknesses: DefenseReview["weaknesses"]) {
  if (weaknesses.length === 0) return ["current_slide_followup"];
  return unique(
    weaknesses.map((weakness) =>
      weakness.title.includes("个人贡献") || weakness.title.includes("数据库")
        ? "weakness_deep_dive"
        : "current_slide_followup"
    ),
  );
}

function unique(items: string[]) {
  return Array.from(new Set(items));
}

function uniqueCitations(citations: DefensePracticeTurn["citations"]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.source}-${citation.lineStart}-${citation.lineEnd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
