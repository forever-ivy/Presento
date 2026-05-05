import assert from "node:assert/strict";
import test from "node:test";

import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";
import {
  buildExpressionKnowledgeMapRecords,
  generateExpressionKnowledgeMapDraft,
  normalizeExpressionKnowledgeMapDraft,
  selectExpressionKnowledgeMapChunks,
} from "./expression-knowledge-map.ts";
import type { LlmMessage, LlmProvider } from "./llm-provider.ts";
import type { ProjectWorkspaceDto } from "../../packages/shared/src/domain.ts";

const createdAt = "2026-05-03T08:00:00.000Z";

const workspace: ProjectWorkspaceDto = {
  project: {
    id: "project-presento",
    name: "Presento",
    category: "软件 / AI / 数据类",
    ownerScope: "知识地图与答辩训练",
    teammateScope: "",
    createdAt,
    updatedAt: createdAt,
  },
  files: [
    {
      id: "file-ppt",
      name: "答辩稿.pptx",
      size: 1024,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      kind: "presentation",
      status: "已解析",
      source: "本地上传",
      storagePath: ".data/uploads/presento.pptx",
      addedAt: createdAt,
    },
    {
      id: "file-pipeline",
      name: "packages/ingest/src/pipeline.ts",
      size: 2048,
      mimeType: "text/typescript",
      kind: "code",
      status: "已解析",
      source: "文件夹上传",
      storagePath: ".data/uploads/pipeline.ts",
      addedAt: createdAt,
    },
  ],
  processingTasks: [],
  artifacts: [],
  jobRuns: [],
  trainingSessionCount: 0,
  latestReview: null,
};

const chunks: KnowledgeChunkRecord[] = [
  {
    id: "chunk-ppt-3",
    projectId: "project-presento",
    artifactId: "artifact-ppt",
    fileId: "file-ppt",
    content: "PPT 第 3 页：项目知识地图把资料、追问和训练入口组织成答辩路径。",
    source: "答辩稿.pptx · slide",
    metadata: {
      artifactTitle: "答辩稿解析结果",
      fileName: "答辩稿.pptx",
      kind: "presentation",
      lineEnd: 1,
      lineStart: 1,
      slide: 3,
      page: 3,
      chunkKind: "slide",
    },
    createdAt,
  },
  {
    id: "chunk-pipeline",
    projectId: "project-presento",
    artifactId: "artifact-code",
    fileId: "file-pipeline",
    content: "createStarterKnowledgeNodes 生成 project / source-category / module / file / training 节点。",
    source: "pipeline.ts · code",
    metadata: {
      artifactTitle: "pipeline.ts 解析结果",
      codePath: "packages/ingest/src/pipeline.ts",
      fileName: "packages/ingest/src/pipeline.ts",
      kind: "code",
      lineStart: 80,
      lineEnd: 150,
      chunkKind: "code",
    },
    createdAt,
  },
];

test("expression map prompt separates positioning from defense talk track", async () => {
  let userPrompt = "";
  const provider: LlmProvider = {
    async generateJson<T>(params: { schemaName: string; messages: LlmMessage[] }) {
      userPrompt = params.messages.find((message: LlmMessage) => message.role === "user")?.content ?? "";
      return {
        projectCenter: {
          title: "Presento",
          oneSentence: "AI 公共表达增强工具。",
          talkTrack: "先讲校园答辩，再讲表达训练闭环。",
        },
        mainlines: [
          {
            title: "产品功能主线",
            expressionNodes: [
              {
                title: "项目知识地图",
                oneSentence: "这是把项目材料组织成答辩讲点的表达模块。",
                talkTrack: "先讲资料分散的场景，再讲地图如何串联材料、追问和训练。",
                topQuestion: "和普通文件目录有什么区别？",
                riskLevel: "high",
                evidenceRefs: [{ fileId: "file-ppt", label: "PPT 第 3 页", reason: "展示产品路径。" }],
              },
            ],
          },
        ],
      } as T;
    },
  };

  await generateExpressionKnowledgeMapDraft({
    chunks,
    llmProvider: provider,
    workspace,
  });

  assert.match(userPrompt, /一句话定位/u);
  assert.match(userPrompt, /定义句|定位句/u);
  assert.match(userPrompt, /不展开实现过程/u);
  assert.match(userPrompt, /答辩讲法/u);
  assert.match(userPrompt, /上台讲述顺序/u);
});

test("normalizes LLM expression map output before writing graph records", () => {
  const draft = normalizeExpressionKnowledgeMapDraft({
    projectCenter: {
      title: "Presento",
      oneSentence: "AI 公共表达增强工具。",
      talkTrack: "先讲校园答辩，再讲表达训练闭环。",
    },
    mainlines: [
      {
        title: "产品功能主线",
        summary: "围绕资料到训练的产品路径。",
        expressionNodes: [
          {
            title: "项目知识地图",
            oneSentence: "把分散资料转成可讲、可追问、可训练的答辩地图。",
            talkTrack: "先讲资料分散，再讲地图组织答辩路径。",
            topQuestion: "和普通文件目录有什么区别？",
            riskLevel: "high",
            evidenceRefs: [
              {
                fileId: "file-ppt",
                label: "PPT 第 3 页",
                reason: "展示知识地图在产品路径中的位置。",
              },
              {
                fileId: "file-pipeline",
                label: "pipeline.ts",
                reason: "说明当前节点生成流程。",
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(draft.projectCenter.title, "Presento");
  assert.equal(draft.mainlines[0]?.expressionNodes[0]?.riskLevel, "high");
  assert.equal(draft.mainlines[0]?.expressionNodes[0]?.evidenceRefs.length, 2);
});

test("rejects invalid LLM expression map JSON instead of falling back to file catalog nodes", () => {
  assert.throws(
    () => normalizeExpressionKnowledgeMapDraft({
      projectCenter: { title: "" },
      mainlines: [{
        title: "产品功能主线",
        expressionNodes: [],
      }],
    }),
    /Invalid expression knowledge map/u,
  );
});

test("builds a defense expression graph where files are evidence leaves, not main nodes", () => {
  const draft = normalizeExpressionKnowledgeMapDraft({
    projectCenter: {
      title: "Presento",
      oneSentence: "AI 公共表达增强工具。",
      talkTrack: "从校园答辩切入，训练学生讲清项目。",
    },
    mainlines: [
      {
        title: "产品功能主线",
        summary: "从资料导入到复盘报告。",
        expressionNodes: [
          {
            title: "项目知识地图",
            oneSentence: "把 PPT、代码和报告组织成答辩讲点。",
            talkTrack: "先讲资料分散，再讲地图如何串联证据、追问和训练。",
            topQuestion: "这个知识地图和普通文件目录有什么区别？",
            riskLevel: "high",
            evidenceRefs: [
              {
                fileId: "file-ppt",
                label: "PPT 第 3 页",
                reason: "产品路径证据。",
              },
              {
                fileId: "file-pipeline",
                label: "pipeline.ts",
                reason: "节点生成流程证据。",
              },
            ],
          },
        ],
      },
    ],
  });

  const map = buildExpressionKnowledgeMapRecords({
    chunks,
    createdAt,
    draft,
    workspace,
  });

  const projectNode = map.nodes.find((node) => node.kind === "project");
  const mainlineNode = map.nodes.find((node) => node.title === "产品功能主线");
  const expressionNode = map.nodes.find((node) => node.title === "项目知识地图");
  const evidenceNode = map.nodes.find((node) => node.title === "PPT 第 3 页");
  const riskNode = map.nodes.find((node) => node.kind === "risk");

  assert.equal(projectNode?.metadata.nodeRole, "mainline");
  assert.equal(projectNode?.metadata.layer, 0);
  assert.equal(mainlineNode?.kind, "module");
  assert.equal(mainlineNode?.metadata.nodeRole, "mainline");
  assert.equal(mainlineNode?.metadata.layer, 1);
  assert.equal(expressionNode?.kind, "module");
  assert.equal(expressionNode?.metadata.nodeRole, "expression");
  assert.equal(expressionNode?.metadata.layer, 2);
  assert.deepEqual(
    (expressionNode?.metadata.expression as { evidenceRefs: Array<{ nodeId: string; fileId: string }> }).evidenceRefs
      .map((ref) => [ref.nodeId, ref.fileId]),
    [
      ["node-evidence-project-presento-file-ppt", "file-ppt"],
      ["node-evidence-project-presento-file-pipeline", "file-pipeline"],
    ],
  );
  assert.equal(evidenceNode?.kind, "file");
  assert.equal(evidenceNode?.metadata.nodeRole, "evidence");
  assert.equal(evidenceNode?.metadata.layer, 3);
  assert.equal(riskNode?.metadata.nodeRole, "risk");
  assert.equal(riskNode?.metadata.layer, "risk");
  assert.equal(map.nodes.some((node) => node.kind === "source-category"), false);
  assert.equal(map.nodes.some((node) => node.kind === "training"), false);
  assert.ok(map.edges.some((edge) => edge.fromNodeId === mainlineNode?.id && edge.toNodeId === expressionNode?.id && edge.kind === "contains"));
  assert.ok(map.edges.some((edge) => edge.fromNodeId === expressionNode?.id && edge.toNodeId === evidenceNode?.id && edge.kind === "evidence"));
  assert.ok(map.edges.some((edge) => edge.fromNodeId === expressionNode?.id && edge.toNodeId === riskNode?.id && edge.kind === "risk"));
});

test("selects project graph context with documents first and grouped code directories", () => {
  const manyChunks: KnowledgeChunkRecord[] = [
    ...Array.from({ length: 6 }, (_, index) => ({
      ...chunks[1]!,
      id: `chunk-code-components-${index}`,
      fileId: `file-code-components-${index}`,
      content: `components file ${index}`,
      metadata: {
        ...chunks[1]!.metadata,
        codePath: `src/components/component-${index}.tsx`,
        fileName: `src/components/component-${index}.tsx`,
        kind: "code" as const,
      },
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      ...chunks[1]!,
      id: `chunk-code-ingest-${index}`,
      fileId: `file-code-ingest-${index}`,
      content: `ingest file ${index}`,
      metadata: {
        ...chunks[1]!.metadata,
        codePath: `packages/ingest/src/file-${index}.ts`,
        fileName: `packages/ingest/src/file-${index}.ts`,
        kind: "code" as const,
      },
    })),
    chunks[1]!,
    chunks[0]!,
  ];

  const selected = selectExpressionKnowledgeMapChunks(manyChunks, { maxChunks: 6 });

  assert.equal(selected[0]?.fileId, "file-ppt");
  assert.ok(selected.some((chunk) => chunk.metadata.codePath === "src/components"));
  assert.ok(selected.some((chunk) => chunk.metadata.codePath === "packages/ingest/src"));
  assert.equal(selected.some((chunk) => chunk.id === "chunk-code-components-5"), false);
});
