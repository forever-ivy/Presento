import type {
  FileExplanationSessionWithTurns,
  KnowledgeEdgeRecord,
  KnowledgeNodeRecord,
  NotebookCitation,
  NotebookExplanationMode,
} from "../../packages/shared/src/domain.ts";

const createdAt = "2026-04-26T00:00:00.000Z";

export const mockKnowledgeNodes: KnowledgeNodeRecord[] = [
  {
    id: "project",
    projectId: "demo",
    kind: "project",
    title: "智能点餐系统",
    summary: "",
    tone: "blue",
    metadata: {
      riskLevel: "medium",
      evidence: ["README.md 项目介绍", "答辩 PPT 第 1 页", "分工说明"],
      actions: ["开始讲练", "查看速记卡"],
      relatedSlides: ["Slide 01", "Slide 02"],
      riskQuestions: ["项目的真实痛点是什么？", "个人负责范围怎么证明？"],
    },
    createdAt,
  },
  {
    id: "source-presentation",
    projectId: "demo",
    kind: "source-category",
    title: "演示资料",
    summary: "答辩 PPT、演示稿 PDF 和逐页讲稿入口。",
    tone: "cyan",
    metadata: {
      riskLevel: "medium",
      actions: ["查看逐页讲稿", "进入第 2 页讲练"],
    },
    createdAt,
  },
  {
    id: "file-ppt",
    projectId: "demo",
    kind: "file",
    title: "答辩 PPT.pdf",
    summary: "18 页答辩演示材料，适合进入逐页讲稿页按页训练。",
    tone: "cyan",
    sourceId: "source-presentation",
    metadata: {
      fileId: "file-ppt",
      fileKind: "presentation-pdf",
      viewer: "presentation",
      explainable: false,
      riskLevel: "medium",
      evidence: ["Slide 02 系统架构", "Slide 03 数据库设计"],
      actions: ["查看逐页讲稿", "进入当前页讲练"],
      preview: {
        outline: ["项目背景与痛点", "系统架构", "数据库设计", "功能演示"],
        text: "演示稿按页承接讲稿、证据链和当前页讲练。",
      },
    },
    createdAt,
  },
  {
    id: "file-ppt-source",
    projectId: "demo",
    kind: "file",
    title: "答辩原稿.pptx",
    summary: "原始 PPT 文件，点击后进入逐页讲稿页进行页级表达训练。",
    tone: "cyan",
    sourceId: "source-presentation",
    metadata: {
      fileId: "file-ppt-source",
      fileKind: "ppt",
      viewer: "presentation",
      explainable: false,
      riskLevel: "medium",
      evidence: ["答辩原稿.pptx", "Slide 02 系统架构"],
      actions: ["查看逐页讲稿", "生成 30 秒版讲稿"],
      preview: {
        outline: ["项目背景", "系统架构", "数据库设计", "总结展望"],
        text: "原始 PPT 资料应进入逐页讲稿页，而不是在知识地图内普通阅读。",
      },
    },
    createdAt,
  },
  {
    id: "module-order",
    projectId: "demo",
    kind: "module",
    title: "后端订单模块",
    summary: "订单创建、状态流转、取消权限和后厨接单是高危追问集中区。",
    tone: "purple",
    metadata: {
      riskLevel: "high",
      evidence: ["backend.zip / routes/orders.ts", "README.md 分工", "接口说明"],
      actions: ["生成代码解释", "加入薄弱点"],
      relatedFiles: ["backend.zip", "orders.sql"],
      riskQuestions: ["后厨接单后还能取消吗？", "前端能否篡改订单状态？"],
    },
    createdAt,
  },
  {
    id: "file-code-orders",
    projectId: "demo",
    kind: "file",
    title: "routes/orders.ts",
    summary: "订单接口核心代码，包含创建订单、状态更新和异常处理。",
    tone: "purple",
    sourceId: "source-code",
    metadata: {
      fileId: "file-code-orders",
      fileKind: "code",
      viewer: "code",
      explainable: true,
      riskLevel: "high",
      sourcePath: "backend.zip/routes/orders.ts",
      evidence: ["routes/orders.ts:12-92", "README.md 分工"],
      actions: ["速通代码", "进入讲练"],
      preview: {
        outline: ["createOrder", "updateOrderStatus", "cancelOrder"],
        codePath: "backend/routes/orders.ts",
        language: "ts",
        text: [
          "export async function createOrder(input) {",
          "  validateDishes(input.items);",
          "  return db.transaction(async (tx) => {",
          "    const order = await tx.orders.create({ data: snapshotOrder(input) });",
          "    await tx.orderItems.createMany({ data: buildItems(input.items) });",
          "    return order;",
          "  });",
          "}",
        ].join("\n"),
      },
    },
    createdAt,
  },
  {
    id: "file-readme",
    projectId: "demo",
    kind: "file",
    title: "README.md",
    summary: "项目背景、技术路线和成员分工说明。",
    tone: "green",
    sourceId: "source-docs",
    metadata: {
      fileId: "file-readme",
      fileKind: "docx",
      viewer: "docx",
      explainable: true,
      riskLevel: "medium",
      evidence: ["README.md 项目目标", "README.md 分工说明"],
      actions: ["速通文档", "补强个人贡献"],
      preview: {
        outline: ["项目背景", "技术路线", "成员分工", "部署方式"],
        text: "智能点餐系统面向校园周边餐饮门店，重点解决高峰期排队、错单和后厨同步慢的问题。我负责后端订单接口、状态流转和数据库表设计说明。",
      },
    },
    createdAt,
  },
  {
    id: "file-orders-sql",
    projectId: "demo",
    kind: "file",
    title: "orders.sql",
    summary: "订单、订单明细、菜品和用户表结构。",
    tone: "green",
    sourceId: "source-data",
    metadata: {
      fileId: "file-orders-sql",
      fileKind: "sql",
      viewer: "sql",
      explainable: true,
      riskLevel: "high",
      evidence: ["orders.sql:1-42", "PPT 第 3 页"],
      actions: ["解释金额快照", "加入薄弱点"],
      preview: {
        outline: ["orders", "order_items", "dishes", "users"],
        text: "orders 表保存订单总金额和状态快照，order_items 表保存菜品明细，避免菜品价格变化影响历史订单。",
      },
    },
    createdAt,
  },
  {
    id: "file-order-data",
    projectId: "demo",
    kind: "file",
    title: "订单数据.xlsx",
    summary: "订单样例数据和高峰时段统计口径。",
    tone: "cyan",
    sourceId: "source-data",
    metadata: {
      fileId: "file-order-data",
      fileKind: "xlsx",
      viewer: "table",
      explainable: true,
      riskLevel: "medium",
      evidence: ["订单数据.xlsx / orders!A1:E12"],
      actions: ["解释字段口径", "生成答辩口径"],
      preview: {
        outline: ["orders 工作表", "order_items 工作表"],
        sheetName: "orders",
        headers: ["order_id", "status", "total_amount", "created_at"],
        rows: [
          ["O-1001", "pending", "68.00", "2026-04-20 11:42"],
          ["O-1002", "accepted", "42.00", "2026-04-20 11:48"],
          ["O-1003", "completed", "95.00", "2026-04-20 12:03"],
        ],
      },
    },
    createdAt,
  },
  {
    id: "file-report",
    projectId: "demo",
    kind: "file",
    title: "项目报告.pdf",
    summary: "课程报告，包含需求分析、系统设计、测试与总结。",
    tone: "cyan",
    sourceId: "source-docs",
    metadata: {
      fileId: "file-report",
      fileKind: "pdf",
      viewer: "pdf",
      explainable: true,
      riskLevel: "low",
      evidence: ["项目报告.pdf 第 2-5 页"],
      actions: ["速通报告", "提取答辩证据"],
      preview: {
        outline: ["需求分析", "系统设计", "测试结果"],
        pages: [
          {
            page: 2,
            title: "需求分析",
            text: "门店高峰期需要减少排队时间，并让后厨实时获得订单。",
          },
          {
            page: 4,
            title: "系统设计",
            text: "系统采用前端点餐端、后端订单服务、数据库和后厨看板分层设计。",
          },
        ],
      },
    },
    createdAt,
  },
  {
    id: "risk-order-state",
    projectId: "demo",
    kind: "risk",
    title: "订单状态流转追问",
    summary: "老师可能连续追问取消权限、状态边界和异常处理。",
    tone: "orange",
    metadata: {
      riskLevel: "high",
      evidence: ["PPT 第 2 页", "routes/orders.ts", "orders.sql"],
      actions: ["进入模拟讲练", "生成 30 秒回答"],
      riskQuestions: ["后厨接单后还能取消吗？", "状态流转失败如何回滚？"],
    },
    createdAt,
  },
  {
    id: "weak-db-snapshot",
    projectId: "demo",
    kind: "weakness",
    title: "金额快照解释不稳",
    summary: "数据库冗余字段的业务依据需要补强。",
    tone: "red",
    metadata: {
      riskLevel: "high",
      evidence: ["orders.sql", "订单数据.xlsx", "PPT 第 3 页"],
      actions: ["进入项目钻研", "加入讲稿补强"],
    },
    createdAt,
  },
  {
    id: "training-node",
    projectId: "demo",
    kind: "training",
    title: "下一轮讲练",
    summary: "围绕系统架构页、订单状态和数据库冗余进行 5 分钟模拟答辩。",
    tone: "blue",
    metadata: {
      riskLevel: "medium",
      actions: ["开始讲练", "生成训练任务"],
    },
    createdAt,
  },
];

export const mockKnowledgeEdges: KnowledgeEdgeRecord[] = [
  edge("edge-project-presentation", "project", "source-presentation", "contains", "资料"),
  edge("edge-presentation-ppt", "source-presentation", "file-ppt", "contains", "PPT"),
  edge("edge-presentation-ppt-source", "source-presentation", "file-ppt-source", "contains", "原稿"),
  edge("edge-project-order", "project", "module-order", "contains", "模块"),
  edge("edge-order-code", "module-order", "file-code-orders", "evidence", "代码证据"),
  edge("edge-project-readme", "project", "file-readme", "evidence", "说明文档"),
  edge("edge-project-sql", "project", "file-orders-sql", "evidence", "数据库"),
  edge("edge-sql-data", "file-orders-sql", "file-order-data", "source", "样例数据"),
  edge("edge-project-report", "project", "file-report", "evidence", "报告"),
  edge("edge-order-risk", "module-order", "risk-order-state", "risk", "高危追问"),
  edge("edge-sql-weak", "file-orders-sql", "weak-db-snapshot", "risk", "薄弱点"),
  edge("edge-risk-training", "risk-order-state", "training-node", "training", "讲练入口"),
  edge("edge-weak-training", "weak-db-snapshot", "training-node", "training", "修复入口"),
];

export function createMockFileExplanationSession(
  projectId: string,
  node: KnowledgeNodeRecord,
  mode: NotebookExplanationMode,
): FileExplanationSessionWithTurns {
  const fileId = String(node.metadata.fileId ?? node.id);
  const citation = citationForNode(node);
  const summary = mode === "quick"
    ? `${node.title} 可以用 30 秒讲清：先说它证明什么，再说和你负责范围的关系。`
    : `${node.title} 需要从结构、证据、风险和可回答口径四层掌握。`;
  const content = mode === "quick"
    ? [
        `一句话：${summary}`,
        "核心 3 点：项目目标、实现证据、答辩风险。",
        "最可能被问：这份资料如何证明你的个人贡献？",
        "30 秒回答框架：资料来源 -> 关键证据 -> 我负责的实现 -> 风险兜底。",
      ].join("\n")
    : [
        summary,
        "分段讲解：",
        "1. 先定位资料在知识地图中的路径。",
        "2. 再提取可上台表达的证据。",
        "3. 最后准备老师可能连续追问的边界条件。",
        "自测题：请不用看资料复述它和当前 PPT 页的关系。",
      ].join("\n");

  return {
    id: `mock-session-${node.id}-${mode}`,
    projectId,
    nodeId: node.id,
    fileId,
    sourceId: node.sourceId,
    mode,
    status: "ready",
    summary,
    outline: outlineForNode(node),
    citations: [citation],
    metadata: {
      followUps: ["老师最可能追问什么？", "这段怎么压缩成 30 秒回答？"],
      quiz: mode === "mastery" ? ["资料的关键证据是什么？", "它对应哪一页 PPT？"] : [],
      weaknessCandidates: ["资料证据说不清", "个人贡献边界不稳"],
      mocked: true,
    },
    createdAt,
    updatedAt: createdAt,
    turns: [
      {
        id: `mock-turn-${node.id}-${mode}`,
        sessionId: `mock-session-${node.id}-${mode}`,
        projectId,
        role: "assistant",
        content,
        citations: [citation],
        metadata: { mode, initial: true, mocked: true },
        createdAt,
      },
    ],
  };
}

function edge(
  id: string,
  fromNodeId: string,
  toNodeId: string,
  kind: KnowledgeEdgeRecord["kind"],
  label: string,
): KnowledgeEdgeRecord {
  return {
    id,
    projectId: "demo",
    fromNodeId,
    toNodeId,
    kind,
    label,
    createdAt,
  };
}

function outlineForNode(node: KnowledgeNodeRecord) {
  const preview = node.metadata.preview;
  if (isRecord(preview) && Array.isArray(preview.outline)) {
    return preview.outline.filter((item): item is string => typeof item === "string");
  }
  return [node.summary];
}

function citationForNode(node: KnowledgeNodeRecord): NotebookCitation {
  const fileName = node.title;
  const fileKind = String(node.metadata.fileKind ?? "");
  if (fileKind === "code") {
    return { fileName, codePath: String(node.metadata.sourcePath ?? node.title), lineStart: 1, lineEnd: 24 };
  }
  if (fileKind === "xlsx" || fileKind === "csv") {
    return { fileName, sheet: "orders", cellRange: "A1:E12" };
  }
  if (fileKind === "sql") {
    return { fileName, codePath: node.title, lineStart: 1, lineEnd: 42 };
  }
  return { fileName, page: 1 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
