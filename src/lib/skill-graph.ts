import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { DefenseCoachTurn, DefenseTeacherRole } from "./defense-chat-skill";
import type { DefensePracticeTurn, DefenseReview } from "./defense-review";
import type { KnowledgeChunkRecord } from "./knowledge-chunks";
import type { LlmProvider } from "./llm-provider";
import type { ProjectBrief } from "./project-brief-skill";

const ModelOutputGraphState = Annotation.Root({
  prompt: Annotation<string>,
  schemaName: Annotation<string>,
  output: Annotation<unknown>,
});

type GraphInput<TOutput> = {
  provider: LlmProvider | null;
  schemaName: string;
  systemPrompt: string;
  userPrompt: string;
  generatedAt: string;
  normalize: (output: TOutput, generatedAt: string) => TOutput;
};

export async function runProjectBriefGraph({
  provider,
  projectName,
  chunks,
  generatedAt = new Date().toISOString(),
}: {
  provider: LlmProvider | null;
  projectName: string;
  chunks: KnowledgeChunkRecord[];
  generatedAt?: string;
}) {
  return runStructuredSkillGraph<ProjectBrief>({
    provider,
    schemaName: "ProjectBrief",
    generatedAt,
    systemPrompt:
      "你是课程项目答辩 AI 教练。只能基于给定资料生成中文项目速记卡，禁止编造，必须输出 JSON。",
    userPrompt: [
      `项目名称：${projectName}`,
      "请输出 projectName、oneSentence、cards、citations。",
      "cards 至少覆盖：项目一句话、技术路线、功能模块、数据与数据库、个人贡献、高危追问。",
      "资料片段：",
      formatKnowledgeChunks(chunks),
    ].join("\n"),
    normalize: (brief, timestamp) => ({
      ...brief,
      generatedAt: brief.generatedAt ?? timestamp,
    }),
  });
}

export async function runDefenseChatGraph({
  provider,
  projectName,
  slideTitle,
  slideIndex,
  teacherRole,
  userAnswer,
  chunks,
  currentSlideId,
  currentKnowledgeNodeId,
  memberScope,
  previousTurns = [],
  sessionState,
  retrievedSources = [],
  generatedAt = new Date().toISOString(),
}: {
  provider: LlmProvider | null;
  projectName: string;
  slideTitle: string;
  slideIndex: number;
  teacherRole: DefenseTeacherRole;
  userAnswer: string;
  chunks: KnowledgeChunkRecord[];
  currentSlideId?: string | null;
  currentKnowledgeNodeId?: string | null;
  memberScope?: string;
  previousTurns?: Array<{ aiMessage: string; userAnswer: string; score?: number | null }>;
  sessionState?: Record<string, unknown>;
  retrievedSources?: Array<Record<string, unknown>>;
  generatedAt?: string;
}) {
  return runStructuredSkillGraph<DefenseCoachTurn>({
    provider,
    schemaName: "DefenseCoachTurn",
    generatedAt,
    systemPrompt:
      "你是课程项目答辩现场的 AI 老师。围绕当前 PPT 页实时追问，输出中文 JSON，不要输出 Markdown。",
    userPrompt: [
      `项目名称：${projectName}`,
      `当前页：第 ${slideIndex} 页「${slideTitle}」`,
      `当前页 ID：${currentSlideId ?? "未提供"}`,
      `当前知识节点：${currentKnowledgeNodeId ?? "未提供"}`,
      `老师角色：${teacherRole}`,
      `我的负责范围：${memberScope || "未提供"}`,
      `学生回答：${userAnswer || "尚未回答"}`,
      `最近训练状态：${JSON.stringify(sessionState ?? {}, null, 2)}`,
      `最近已检索来源：${JSON.stringify(retrievedSources, null, 2)}`,
      `最近历史轮次：${JSON.stringify(previousTurns.slice(-3), null, 2)}`,
      "请输出 role、message、feedback、followUps、citations。",
      "feedback 必须包含 score、strengths、risks、improvedAnswer。",
      "资料片段：",
      formatKnowledgeChunks(chunks),
    ].join("\n"),
    normalize: (turn, timestamp) => ({
      ...turn,
      generatedAt: turn.generatedAt ?? timestamp,
    }),
  });
}

export async function runDefenseReviewGraph({
  provider,
  projectName,
  turns,
  sessionState,
  generatedAt = new Date().toISOString(),
}: {
  provider: LlmProvider | null;
  projectName: string;
  turns: DefensePracticeTurn[];
  sessionState?: Record<string, unknown>;
  generatedAt?: string;
}) {
  return runStructuredSkillGraph<DefenseReview>({
    provider,
    schemaName: "DefenseReview",
    generatedAt,
    systemPrompt:
      "你是课程项目答辩复盘教练。根据训练记录提炼薄弱点和下一步行动，输出中文 JSON。",
    userPrompt: [
      `项目名称：${projectName}`,
      "请输出 projectName、totalTurns、averageScore、scoreLabel、clarityScore、evidenceScore、pressureScore、summary、strengths、weaknesses、betterAnswers、nextActions、recommendedSkills、citations。",
      `训练状态：${JSON.stringify(sessionState ?? {}, null, 2)}`,
      "训练记录：",
      JSON.stringify(turns, null, 2),
    ].join("\n"),
    normalize: (review, timestamp) => ({
      ...review,
      generatedAt: review.generatedAt ?? timestamp,
    }),
  });
}

async function runStructuredSkillGraph<TOutput>({
  provider,
  schemaName,
  systemPrompt,
  userPrompt,
  generatedAt,
  normalize,
}: GraphInput<TOutput>) {
  if (!provider) {
    throw new Error("模型未配置：缺少 LLM_API_KEY，Skill Graph 暂时无法调用真实模型。");
  }

  const graph = new StateGraph(ModelOutputGraphState)
    .addNode("call_model", async (state) => {
      const output = await provider.generateJson<TOutput>({
        schemaName: state.schemaName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: state.prompt },
        ],
      });

      return { output };
    })
    .addEdge(START, "call_model")
    .addEdge("call_model", END)
    .compile();

  const result = await graph.invoke({
    prompt: userPrompt,
    schemaName,
  });

  return normalize(result.output as TOutput, generatedAt);
}

function formatKnowledgeChunks(chunks: KnowledgeChunkRecord[]) {
  if (chunks.length === 0) return "暂无资料片段。";

  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] ${chunk.source} L${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}\n${chunk.content}`,
    )
    .join("\n\n");
}
