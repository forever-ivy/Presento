import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";

export type DefenseTeacherRole = "normal" | "technical" | "strict";

export type DefenseCoachTurn = {
  role: "AI 老师";
  message: string;
  feedback: {
    score: number;
    strengths: string[];
    risks: string[];
    improvedAnswer: string;
  };
  followUps: string[];
  citations: Array<{
    source: string;
    fileName: string;
    lineStart: number;
    lineEnd: number;
  }>;
  generatedAt: string;
};

export function generateDefenseCoachTurn({
  projectName,
  slideTitle,
  slideIndex,
  teacherRole,
  userAnswer,
  chunks,
  generatedAt = new Date().toISOString(),
}: {
  projectName: string;
  slideTitle: string;
  slideIndex: number;
  teacherRole: DefenseTeacherRole;
  userAnswer: string;
  chunks: KnowledgeChunkRecord[];
  generatedAt?: string;
}): DefenseCoachTurn {
  const trimmedAnswer = userAnswer.trim();
  const evidence = selectEvidence(trimmedAnswer || slideTitle, chunks);
  const evidenceText = evidence.map((chunk) => chunk.content).join("\n");

  if (!trimmedAnswer) {
    return {
      role: "AI 老师",
      message: `你正在讲第 ${slideIndex} 页「${slideTitle}」。先用 30 秒说明这一页和「${projectName}」的关系，再说清楚你个人负责的部分。`,
      feedback: {
        score: 0,
        strengths: [],
        risks: [],
        improvedAnswer: "",
      },
      followUps: starterFollowUps(evidenceText),
      citations: citationsForChunks(evidence),
      generatedAt,
    };
  }

  if (chunks.length === 0) {
    return {
      role: "AI 老师",
      message: `你的回答还缺少资料依据。第 ${slideIndex} 页「${slideTitle}」里，请先说明结论来自 PPT、README、代码还是数据库文件。`,
      feedback: {
        score: 45,
        strengths: answerStrengths(trimmedAnswer),
        risks: ["当前项目资料还没有入库，追问无法溯源，容易被老师质疑真实性。"],
        improvedAnswer: `${trimmedAnswer}。补充：这个说法需要绑定到具体资料来源，比如 PPT 页、README 段落或代码路径。`,
      },
      followUps: ["你的资料依据在哪里？", "这部分是你本人实现，还是队友实现？"],
      citations: [],
      generatedAt,
    };
  }

  const risks = answerRisks(trimmedAnswer, evidenceText);
  const score = scoreAnswer(trimmedAnswer, risks, teacherRole);
  const followUps = followUpsForAnswer(trimmedAnswer, evidenceText, teacherRole);

  return {
    role: "AI 老师",
    message: `第 ${slideIndex} 页「${slideTitle}」我会继续追问：${followUps[0]}`,
    feedback: {
      score,
      strengths: answerStrengths(trimmedAnswer),
      risks,
      improvedAnswer: improvedAnswer(trimmedAnswer, evidenceText),
    },
    followUps,
    citations: citationsForChunks(evidence),
    generatedAt,
  };
}

function selectEvidence(query: string, chunks: KnowledgeChunkRecord[]) {
  const queryTokens = tokensFor(query);
  return [...chunks]
    .map((chunk) => ({
      chunk,
      score: tokensFor(chunk.content).filter((token) => queryTokens.includes(token)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.chunk);
}

function starterFollowUps(evidenceText: string) {
  const followUps = [
    "这页最核心的流程是什么？请按用户、后端、数据库三个角色讲。",
    "这一页里哪一块是你本人负责的？",
  ];
  if (evidenceText.includes("数据库") || evidenceText.includes("orders")) {
    followUps.push("订单状态为什么放在数据库里，而不是只存在前端状态里？");
  }
  return followUps;
}

function answerStrengths(answer: string) {
  const strengths: string[] = [];
  if (answer.includes("订单")) strengths.push("回答已经抓到了订单主流程。");
  if (answer.includes("后端") || answer.includes("接口")) strengths.push("提到了后端接口或服务职责。");
  if (answer.includes("数据库") || answer.includes("表")) strengths.push("能把说明落到数据存储层。");
  if (answer.includes("我负责") || answer.includes("个人")) strengths.push("开始说明个人贡献。");
  return strengths.length ? strengths : ["回答有基本方向，但还需要绑定资料依据。"];
}

function answerRisks(answer: string, evidenceText: string) {
  const risks: string[] = [];
  if (!answer.includes("数据库") && evidenceText.includes("数据库")) {
    risks.push("资料里有数据库设计，但回答没有解释数据库表和状态字段。");
  }
  if (!answer.includes("状态") && evidenceText.includes("状态")) {
    risks.push("订单状态流转没有讲完整，容易被追问异常场景。");
  }
  if (!answer.includes("我负责") && !answer.includes("个人") && evidenceText.includes("个人负责")) {
    risks.push("个人贡献没有说清楚，课程项目答辩里风险较高。");
  }
  if (answer.length < 30) risks.push("回答偏短，建议补充流程、依据和边界情况。");
  return risks.length ? risks : ["下一轮重点检查异常处理和技术选型依据。"];
}

function followUpsForAnswer(
  answer: string,
  evidenceText: string,
  teacherRole: DefenseTeacherRole,
) {
  const followUps: string[] = [];
  if (evidenceText.includes("订单") || answer.includes("订单")) {
    followUps.push("订单状态从创建到后厨接单，中间有哪些状态？谁有权限修改？");
  }
  if (evidenceText.includes("数据库") || answer.includes("数据库")) {
    followUps.push("为什么数据库这样设计？orders 表和 order_items 表是什么关系？");
  }
  if (evidenceText.includes("个人负责")) {
    followUps.push("你个人负责的后端订单接口，核心校验逻辑在哪里？");
  }
  if (teacherRole === "strict") {
    followUps.push("如果现场让你打开代码，你会从哪个文件开始解释？");
  }
  return followUps.length ? followUps : ["请把这一页内容和项目资料里的证据对应起来。"];
}

function improvedAnswer(answer: string, evidenceText: string) {
  const additions: string[] = [];
  if (evidenceText.includes("orders")) additions.push("补充 orders 表负责记录订单状态。");
  if (evidenceText.includes("order_items")) additions.push("补充 order_items 表负责记录菜品明细。");
  if (evidenceText.includes("个人负责")) additions.push("补充个人负责后端订单接口和状态流转。");
  return [answer, ...additions].join(" ");
}

function scoreAnswer(answer: string, risks: string[], teacherRole: DefenseTeacherRole) {
  let score = 68;
  if (answer.includes("订单")) score += 8;
  if (answer.includes("后端") || answer.includes("接口")) score += 6;
  if (answer.includes("数据库") || answer.includes("表")) score += 6;
  if (answer.includes("状态")) score += 6;
  if (answer.includes("我负责") || answer.includes("个人")) score += 6;
  score -= Math.max(0, risks.length - 1) * 4;
  if (teacherRole === "strict") score -= 4;
  if (teacherRole === "normal") score += 4;
  return Math.max(0, Math.min(100, score));
}

function citationsForChunks(chunks: KnowledgeChunkRecord[]) {
  return chunks.map((chunk) => ({
    source: chunk.source,
    fileName: chunk.metadata.fileName,
    lineStart: chunk.metadata.lineStart,
    lineEnd: chunk.metadata.lineEnd,
  }));
}

function tokensFor(text: string) {
  return Array.from(new Set(text.match(/[\p{L}\p{N}_]+/gu) ?? []));
}
