import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { DefenseCoachTurn, DefenseTeacherRole } from "./defense-chat-skill";
import type { DefensePracticeTurn, DefenseReview } from "./defense-review";
import type { KnowledgeChunkRecord } from "./knowledge-chunks";
import type { LlmProvider } from "./llm-provider";
import type { ProjectBrief } from "./project-brief-skill";

export type KnowledgeMapGraphSemanticType = "feature" | "api" | "table" | "flow" | "architecture";

export type KnowledgeMapGraphCitation = {
  fileName?: string;
  fileId?: string;
  sourceId?: string;
  page?: number;
  slide?: number;
  sheet?: string;
  codePath?: string;
  lineStart?: number;
  lineEnd?: number;
  text?: string;
};

export type KnowledgeMapGraphSemanticNode = {
  id?: string;
  title: string;
  summary?: string;
  semanticType?: KnowledgeMapGraphSemanticType;
  evidence?: string[];
  citations?: KnowledgeMapGraphCitation[];
  relatedIds?: string[];
  riskQuestions?: string[];
};

export type KnowledgeMapGraphRisk = {
  id?: string;
  title: string;
  summary?: string;
  riskLevel?: "low" | "medium" | "high";
  evidence?: string[];
  citations?: KnowledgeMapGraphCitation[];
  relatedIds?: string[];
  actions?: string[];
};

export type KnowledgeMapGraphWeakness = {
  id?: string;
  title: string;
  summary?: string;
  evidence?: string[];
  citations?: KnowledgeMapGraphCitation[];
  relatedIds?: string[];
  actions?: string[];
};

export type KnowledgeMapGraphTrainingPath = {
  id?: string;
  title: string;
  summary?: string;
  evidence?: string[];
  citations?: KnowledgeMapGraphCitation[];
  relatedIds?: string[];
  actions?: string[];
};

export type KnowledgeMapGraphOutput = {
  projectSummary: string;
  modules: KnowledgeMapGraphSemanticNode[];
  apis: KnowledgeMapGraphSemanticNode[];
  tables: KnowledgeMapGraphSemanticNode[];
  risks: KnowledgeMapGraphRisk[];
  weaknesses: KnowledgeMapGraphWeakness[];
  trainingPaths: KnowledgeMapGraphTrainingPath[];
  citations: KnowledgeMapGraphCitation[];
  generatedAt?: string;
};

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

export async function runKnowledgeMapGraph({
  provider,
  projectName,
  fileName,
  fileKind,
  chunks,
  parsedSummary,
  generatedAt = new Date().toISOString(),
}: {
  provider: LlmProvider | null;
  projectName: string;
  fileName: string;
  fileKind: string;
  chunks: KnowledgeChunkRecord[];
  parsedSummary?: string;
  generatedAt?: string;
}) {
  return runStructuredSkillGraph<KnowledgeMapGraphOutput>({
    provider,
    schemaName: "KnowledgeMapGraph",
    generatedAt,
    systemPrompt:
      "你是课程项目资料解析后的知识图谱生成器。只能基于给定资料片段生成中文 JSON，禁止编造。每个节点必须有 fileId、sourceId 或 citations 证据。",
    userPrompt: [
      `项目名称：${projectName}`,
      `当前资料：${fileName}`,
      `资料类型：${fileKind}`,
      `解析摘要：${parsedSummary || "未提供"}`,
      "请输出 JSON，字段必须包含 projectSummary、modules、apis、tables、risks、weaknesses、trainingPaths、citations。",
      "modules 表示功能模块、流程或架构点，semanticType 只能是 feature、flow、architecture；apis 的 semanticType 固定 api；tables 的 semanticType 固定 table。",
      "risks 是答辩高危追问，weaknesses 是预测薄弱点，trainingPaths 是对应讲练入口。",
      "所有节点必须带 citations，citation 中尽量给出 fileId、sourceId、fileName、lineStart、lineEnd、page、slide、sheet 或 codePath。",
      "不要生成没有资料依据的节点；无法判断时输出空数组。",
      "资料片段：",
      formatKnowledgeChunks(chunks),
    ].join("\n"),
    normalize: normalizeKnowledgeMapGraphOutput,
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

function normalizeKnowledgeMapGraphOutput(
  output: Partial<KnowledgeMapGraphOutput> | null | undefined,
  generatedAt: string,
): KnowledgeMapGraphOutput {
  const record = output ?? {};
  return {
    projectSummary: typeof record.projectSummary === "string" ? record.projectSummary : "",
    modules: normalizeSemanticNodes(record.modules, "feature"),
    apis: normalizeSemanticNodes(record.apis, "api"),
    tables: normalizeSemanticNodes(record.tables, "table"),
    risks: Array.isArray(record.risks) ? record.risks : [],
    weaknesses: Array.isArray(record.weaknesses) ? record.weaknesses : [],
    trainingPaths: Array.isArray(record.trainingPaths) ? record.trainingPaths : [],
    citations: Array.isArray(record.citations) ? record.citations : [],
    generatedAt: record.generatedAt ?? generatedAt,
  };
}

function normalizeSemanticNodes(
  nodes: KnowledgeMapGraphSemanticNode[] | undefined,
  fallbackSemanticType: KnowledgeMapGraphSemanticType,
) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => ({
    ...node,
    semanticType: normalizeSemanticType(node.semanticType, fallbackSemanticType),
  }));
}

function normalizeSemanticType(
  value: KnowledgeMapGraphSemanticType | undefined,
  fallback: KnowledgeMapGraphSemanticType,
): KnowledgeMapGraphSemanticType {
  if (value === "feature" || value === "api" || value === "table" || value === "flow" || value === "architecture") {
    return value;
  }
  return fallback;
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
