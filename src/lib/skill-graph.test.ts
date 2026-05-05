import assert from "node:assert/strict";
import test from "node:test";
import type { LlmProvider } from "./llm-provider.ts";
import {
  runDefenseChatGraph,
  runDefenseReviewGraph,
  runKnowledgeMapGraph,
  runProjectBriefGraph,
} from "./skill-graph.ts";

const chunks = [
  {
    id: "chunk-1",
    projectId: "project-1",
    fileId: "file-1",
    artifactId: "artifact-1",
    source: "README.md · document",
    content: "项目目标：解决食堂高峰期排队。技术路线：Next.js + PostgreSQL。",
    embedding: [],
    metadata: {
      fileName: "README.md",
      kind: "document" as const,
      artifactTitle: "README 解析结果",
      contentType: "text/markdown",
      lineStart: 1,
      lineEnd: 2,
    },
    createdAt: "2026-04-25T00:00:00.000Z",
  },
];

function fakeProvider(output: unknown): LlmProvider {
  return {
    async generateJson<T>() {
      return output as T;
    },
  };
}

test("project brief graph requires a configured model provider", async () => {
  await assert.rejects(
    () => runProjectBriefGraph({ provider: null, projectName: "课程项目", chunks }),
    /模型未配置/,
  );
});

test("project brief graph returns llm structured output", async () => {
  const brief = await runProjectBriefGraph({
    provider: fakeProvider({
      projectName: "智能点餐系统",
      oneSentence: "智能点餐系统：解决食堂排队。",
      cards: [{ title: "技术路线", items: ["Next.js + PostgreSQL"] }],
      citations: [],
    }),
    projectName: "智能点餐系统",
    chunks,
    generatedAt: "2026-04-25T00:00:00.000Z",
  });

  assert.equal(brief.projectName, "智能点餐系统");
  assert.equal(brief.generatedAt, "2026-04-25T00:00:00.000Z");
  assert.match(brief.cards[0].items[0], /PostgreSQL/);
});

test("knowledge map graph returns normalized deep graph output", async () => {
  const graph = await runKnowledgeMapGraph({
    provider: fakeProvider({
      projectSummary: "点餐系统围绕订单提交、支付和取餐提醒展开。",
      modules: [{ title: "订单中心", summary: "处理订单创建和状态流转。", citations: [{ fileId: "file-1" }] }],
      apis: [{ title: "POST /api/orders", summary: "创建订单。", citations: [{ fileId: "file-1", lineStart: 1 }] }],
      tables: [{ title: "orders", summary: "订单主表。", citations: [{ fileId: "file-1" }] }],
      risks: [{ title: "并发下单如何防重", summary: "需要说明幂等策略。", riskLevel: "high", citations: [{ fileId: "file-1" }] }],
      weaknesses: [{ title: "数据库关系解释薄弱", summary: "需要补强表关系。", citations: [{ fileId: "file-1" }] }],
      trainingPaths: [{ title: "订单链路讲练", summary: "围绕下单链路追问。", citations: [{ fileId: "file-1" }] }],
      citations: [{ fileName: "README.md", fileId: "file-1", lineStart: 1, lineEnd: 2 }],
    }),
    projectName: "智能点餐系统",
    fileName: "README.md",
    fileKind: "document",
    chunks,
    generatedAt: "2026-04-25T00:00:00.000Z",
  });

  assert.equal(graph.generatedAt, "2026-04-25T00:00:00.000Z");
  assert.equal(graph.modules[0].semanticType, "feature");
  assert.equal(graph.apis[0].semanticType, "api");
  assert.equal(graph.tables[0].semanticType, "table");
  assert.equal(graph.risks[0].riskLevel, "high");
  assert.equal(graph.citations[0].fileId, "file-1");
});

test("defense chat graph returns current-slide teacher feedback", async () => {
  const turn = await runDefenseChatGraph({
    provider: fakeProvider({
      role: "AI 老师",
      message: "请解释订单状态流转。",
      feedback: {
        score: 82,
        strengths: ["能说清主流程。"],
        risks: ["异常取消没有展开。"],
        improvedAnswer: "补充取消和重复提交。",
      },
      followUps: ["如果重复提交怎么办？"],
      citations: [],
    }),
    projectName: "智能点餐系统",
    slideTitle: "系统架构",
    slideIndex: 2,
    teacherRole: "strict",
    userAnswer: "订单写入数据库。",
    chunks,
    generatedAt: "2026-04-25T00:00:00.000Z",
  });

  assert.equal(turn.feedback.score, 82);
  assert.equal(turn.generatedAt, "2026-04-25T00:00:00.000Z");
});

test("defense review graph returns structured review", async () => {
  const review = await runDefenseReviewGraph({
    provider: fakeProvider({
      projectName: "智能点餐系统",
      totalTurns: 1,
      averageScore: 76,
      scoreLabel: "基本能答",
      summary: "数据库解释还需加强。",
      strengths: ["能说明主流程。"],
      weaknesses: [{ title: "数据库设计解释不够具体", count: 1, evidence: "第 2 页" }],
      nextActions: ["补充 orders 与 order_items 的关系。"],
      citations: [],
    }),
    projectName: "智能点餐系统",
    turns: [],
    generatedAt: "2026-04-25T00:00:00.000Z",
  });

  assert.equal(review.averageScore, 76);
  assert.equal(review.generatedAt, "2026-04-25T00:00:00.000Z");
});
