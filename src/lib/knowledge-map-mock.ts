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
    title: "Mock 文件预览资料包",
    summary: "使用 /Users/Code/mock 里的真实样例文件测试知识地图正式 viewer。",
    tone: "blue",
    metadata: {
      riskLevel: "medium",
      evidence: ["01.初识Python.md", "py/function.py", "invoice.xlsx", "实验1运算器实验报告.pdf"],
      actions: ["打开文件阅读态", "测试正式预览器"],
      riskQuestions: ["PDF、表格、代码和文档是否都能打开正式 viewer？"],
    },
    createdAt,
  },
  {
    id: "source-python",
    projectId: "demo",
    kind: "source-category",
    title: "Python 讲义",
    summary: "Markdown 文档与 Python 示例代码。",
    tone: "cyan",
    metadata: {
      riskLevel: "low",
      actions: ["阅读 Markdown", "查看代码"],
    },
    createdAt,
  },
  {
    id: "file-python-intro",
    projectId: "demo",
    kind: "file",
    title: "01.初识Python.md",
    summary: "Python 入门资料，包含语言简介、编年史、优缺点和环境安装步骤。",
    tone: "cyan",
    sourceId: "source-python",
    metadata: {
      fileId: "mock-python-intro",
      fileKind: "md",
      mimeType: "text/markdown; charset=utf-8",
      viewer: "markdown",
      explainable: true,
      riskLevel: "low",
      evidence: ["Python 简介", "Python 编年史", "安装 Python 环境"],
      actions: ["用 Markdown renderer 预览", "生成学习提纲"],
      preview: {
        outline: ["Python 简介", "Python 编年史", "Python 优缺点", "安装 Python 环境"],
        text: [
          "## 初识Python",
          "",
          "Python 是由荷兰人吉多·范罗苏姆发明的一种编程语言，强调代码的可读性和语法的简洁性。",
          "",
          "### Python编年史",
          "",
          "- 1991年02月：Python 解释器的最初代码发布。",
          "- 2008年12月：Python 3.0 发布。",
          "- 2020年01月：官方停止对 Python 2 的更新和维护。",
          "",
          "### Python优缺点",
          "",
          "Python 简单优雅，拥有强大的社区和生态圈，适合自动化、数据科学、人工智能等场景。",
        ].join("\n"),
      },
    },
    createdAt,
  },
  {
    id: "source-code",
    projectId: "demo",
    kind: "source-category",
    title: "Python 示例代码",
    summary: "组合数函数和字典遍历示例。",
    tone: "purple",
    metadata: {
      riskLevel: "medium",
      actions: ["打开 Monaco", "解释函数逻辑"],
    },
    createdAt,
  },
  {
    id: "file-python-function",
    projectId: "demo",
    kind: "file",
    title: "py/function.py",
    summary: "输入 m 和 n，通过阶乘函数计算组合数 C(m,n)。",
    tone: "purple",
    sourceId: "source-code",
    metadata: {
      fileId: "mock-python-function",
      fileKind: "code",
      mimeType: "text/x-python; charset=utf-8",
      viewer: "code",
      explainable: true,
      riskLevel: "medium",
      sourcePath: "/Users/Code/mock/py/function.py",
      evidence: ["fac(num)", "m = int(input(...))", "print(fac(m) // fac(n) // fac(m - n))"],
      actions: ["用 Monaco 预览", "解释组合数公式"],
      preview: {
        outline: ["fac(num)", "读取 m/n", "计算 C(m,n)"],
        codePath: "py/function.py",
        language: "python",
        text: [
          "\"\"\"",
          "输入m和n，计算组合数C(m,n)的值",
          "\"\"\"",
          "",
          "def fac(num):",
          "    result = 1",
          "    for n in range(2, num + 1):",
          "        result *= n",
          "    return result",
          "",
          "m = int(input('m = '))",
          "n = int(input('n = '))",
          "print(fac(m) // fac(n) // fac(m - n))",
        ].join("\n"),
      },
    },
    createdAt,
  },
  {
    id: "file-python-hello",
    projectId: "demo",
    kind: "file",
    title: "py/hello.py",
    summary: "Python 字典成员判断、索引更新和循环遍历示例。",
    tone: "purple",
    sourceId: "source-code",
    metadata: {
      fileId: "mock-python-hello",
      fileKind: "code",
      mimeType: "text/x-python; charset=utf-8",
      viewer: "code",
      explainable: true,
      riskLevel: "low",
      sourcePath: "/Users/Code/mock/py/hello.py",
      evidence: ["person 字典", "成员运算", "循环遍历"],
      actions: ["用 Monaco 预览", "解释字典操作"],
      preview: {
        outline: ["字典定义", "成员运算", "索引更新", "循环遍历"],
        codePath: "py/hello.py",
        language: "python",
        text: [
          "person = {'name': '王大锤', 'age': 55, 'height': 168, 'weight': 60, 'addr': '成都市武侯区科华北路62号1栋101'}",
          "",
          "print('name' in person)",
          "print('tel' in person)",
          "print(person['name'])",
          "person['age'] = 25",
          "",
          "for key in person:",
          "    print(f'{key}:\\t{person[key]}')",
        ].join("\n"),
      },
    },
    createdAt,
  },
  {
    id: "source-data",
    projectId: "demo",
    kind: "source-category",
    title: "表格资料",
    summary: "用于测试 SheetJS + TanStack Table 的 Excel 文件。",
    tone: "green",
    metadata: {
      riskLevel: "medium",
      actions: ["打开表格 viewer", "切换工作表"],
    },
    createdAt,
  },
  {
    id: "file-invoice",
    projectId: "demo",
    kind: "file",
    title: "invoice.xlsx",
    summary: "Invoice 表格，包含付款信息、银行账户和文档清单。",
    tone: "green",
    sourceId: "source-data",
    metadata: {
      fileId: "mock-invoice",
      fileKind: "xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      viewer: "table",
      explainable: true,
      riskLevel: "medium",
      evidence: ["Invoice Number", "Beneficiary Name", "IBAN", "Document Name"],
      actions: ["用 SheetJS 预览", "解释付款字段"],
      preview: {
        outline: ["INVOICE", "PAYMENT DETAILS", "Document Name"],
        sheetName: "预览",
        headers: ["Field", "Value"],
        rows: [
          ["Date", "April 7, 2026"],
          ["FROM", "Meriem Ben Yahia"],
          ["BILL TO", "Mahmoud Odeh / Eventranz"],
          ["Bank Name", "Dukascopy Bank SA"],
        ],
      },
    },
    createdAt,
  },
  {
    id: "source-docs",
    projectId: "demo",
    kind: "source-category",
    title: "运算器实验文档",
    summary: "DOCX 指导书和 PDF 实验报告。",
    tone: "orange",
    metadata: {
      riskLevel: "medium",
      actions: ["打开文档 viewer", "打开 PDF viewer"],
    },
    createdAt,
  },
  {
    id: "file-alu-guide",
    projectId: "demo",
    kind: "file",
    title: "实验1运算器实验.docx",
    summary: "计算机组成原理实验指导书，说明 74LS181 运算器实验目的、原理和步骤。",
    tone: "orange",
    sourceId: "source-docs",
    metadata: {
      fileId: "mock-alu-guide",
      fileKind: "docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      viewer: "docx",
      explainable: true,
      riskLevel: "low",
      evidence: ["1.1 实验目的", "1.3 实验原理", "1.4 实验内容与步骤"],
      actions: ["用 Markdown renderer 预览", "提炼实验步骤"],
      preview: {
        outline: ["实验目的", "实验要求", "实验原理", "实验内容与步骤"],
        text: [
          "## 实验1运算器实验",
          "",
          "### 实验目的",
          "",
          "1. 掌握算术逻辑运算单元的工作原理。",
          "2. 熟悉简单运算器的电路组成。",
          "3. 熟悉 4 位运算功能发生器 74LS181 的算术、逻辑运算功能。",
          "",
          "### 实验原理",
          "",
          "两片 4 位 74LS181 构成 8 位字长的 ALU，两个 8 位 74LS273 作为工作寄存器 DR1 和 DR2。",
        ].join("\n"),
      },
    },
    createdAt,
  },
  {
    id: "file-alu-report",
    projectId: "demo",
    kind: "file",
    title: "实验1运算器实验报告.pdf",
    summary: "运算器实验报告，记录 ALU 实验数据、功能验证结果、结论和思考分析。",
    tone: "red",
    sourceId: "source-docs",
    metadata: {
      fileId: "mock-alu-report",
      fileKind: "pdf",
      mimeType: "application/pdf",
      viewer: "pdf",
      explainable: true,
      riskLevel: "medium",
      evidence: ["DR1 = 65H", "DR2 = A7H", "表 1-1 运算器功能验证结果"],
      actions: ["用 PDF.js 预览", "总结实验结论"],
      preview: {
        outline: ["实验目的", "实验数据", "功能验证", "实验结论"],
        pages: [
          {
            page: 1,
            title: "实验目的与数据",
            text: "掌握 ALU 工作原理；DR1 = 65H，DR2 = A7H，算术运算时 Cn = 1。",
          },
          {
            page: 2,
            title: "实验结论",
            text: "两片 74LS181 通过进位链级联后能够完成 8 位算术逻辑运算。",
          },
        ],
      },
    },
    createdAt,
  },
  {
    id: "risk-viewer-coverage",
    projectId: "demo",
    kind: "risk",
    title: "预览能力覆盖检查",
    summary: "确认 PDF.js、Monaco、SheetJS + TanStack Table、Markdown renderer 都能在阅读态打开。",
    tone: "orange",
    metadata: {
      riskLevel: "medium",
      evidence: ["PDF 文件", "Python 代码", "Excel 表格", "DOCX/Markdown 文档"],
      actions: ["逐个打开文件节点", "检查 fallback"],
      riskQuestions: ["接口失败时是否回到轻量预览？", "大文件加载是否有明确状态？"],
    },
    createdAt,
  },
  {
    id: "training-node",
    projectId: "demo",
    kind: "training",
    title: "文件预览测试清单",
    summary: "从知识地图打开每个文件叶子，确认正式 viewer 与 fallback 都可用。",
    tone: "blue",
    metadata: {
      riskLevel: "low",
      actions: ["打开文件阅读态", "记录异常"],
    },
    createdAt,
  },
];

export const mockKnowledgeEdges: KnowledgeEdgeRecord[] = [
  edge("edge-project-python", "project", "source-python", "contains", "讲义"),
  edge("edge-python-intro", "source-python", "file-python-intro", "contains", "Markdown"),
  edge("edge-project-code", "project", "source-code", "contains", "代码"),
  edge("edge-code-function", "source-code", "file-python-function", "contains", "函数"),
  edge("edge-code-hello", "source-code", "file-python-hello", "contains", "字典"),
  edge("edge-project-data", "project", "source-data", "contains", "表格"),
  edge("edge-data-invoice", "source-data", "file-invoice", "contains", "XLSX"),
  edge("edge-project-docs", "project", "source-docs", "contains", "文档"),
  edge("edge-docs-guide", "source-docs", "file-alu-guide", "contains", "DOCX"),
  edge("edge-docs-report", "source-docs", "file-alu-report", "contains", "PDF"),
  edge("edge-preview-risk", "project", "risk-viewer-coverage", "risk", "检查项"),
  edge("edge-risk-training", "risk-viewer-coverage", "training-node", "training", "测试清单"),
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
