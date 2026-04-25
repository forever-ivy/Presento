import assert from "node:assert/strict";
import { test } from "node:test";
import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";
import { generateProjectBrief } from "./project-brief-skill.ts";

const chunks: KnowledgeChunkRecord[] = [
  {
    id: "chunk-readme-1",
    projectId: "project-defense",
    artifactId: "artifact-readme",
    fileId: "file-readme",
    content: [
      "项目背景：解决食堂高峰期排队和后厨接单效率问题。",
      "技术路线：Next.js 前端、Node API、PostgreSQL 数据库。",
      "功能模块：学生点餐、购物车、订单创建、后厨看板、管理员菜品管理。",
      "数据库设计：orders 表记录订单状态，order_items 表记录菜品明细。",
      "个人负责：后端订单接口、数据库表设计、订单状态流转。",
    ].join("\n"),
    source: "README.md · document",
    metadata: {
      fileName: "README.md",
      kind: "document",
      artifactTitle: "README.md 解析结果",
      lineStart: 1,
      lineEnd: 5,
    },
    createdAt: "2026-04-25T06:04:00.000Z",
  },
];

test("generates a course defense brief from knowledge chunks", () => {
  const brief = generateProjectBrief({
    projectName: "智能点餐系统课程答辩",
    chunks,
  });

  assert.equal(brief.projectName, "智能点餐系统课程答辩");
  assert.match(brief.oneSentence, /食堂高峰期排队/);
  assert.deepEqual(brief.cards.map((card) => card.title), [
    "项目一句话",
    "技术路线",
    "功能模块",
    "数据与数据库",
    "个人贡献",
    "高危追问",
  ]);
  assert.match(brief.cards[1].items.join("\n"), /Next\.js/);
  assert.match(brief.cards[3].items.join("\n"), /orders 表/);
  assert.match(brief.cards[4].items.join("\n"), /后端订单接口/);
  assert.ok(brief.citations.some((citation) => citation.source === "README.md · document"));
});

test("generates fallback brief when project has no knowledge chunks", () => {
  const brief = generateProjectBrief({
    projectName: "智能点餐系统课程答辩",
    chunks: [],
  });

  assert.equal(brief.oneSentence, "智能点餐系统课程答辩：资料还不足，需要先上传 PPT、README、代码或数据库文件。");
  assert.equal(brief.cards[0].items[0], "先上传课程项目资料，再生成可溯源速记卡。");
});
