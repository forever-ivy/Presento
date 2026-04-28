import assert from "node:assert/strict";
import test from "node:test";
import type { LlmProvider } from "./llm-provider.ts";
import {
  runDefenseChatGraph,
  runDefenseReviewGraph,
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
