import type { KnowledgeChunkRecord } from "./knowledge-chunks.ts";

export type ProjectBriefCard = {
  title: string;
  items: string[];
};

export type ProjectBriefCitation = {
  source: string;
  fileName: string;
  lineStart: number;
  lineEnd: number;
};

export type ProjectBrief = {
  projectName: string;
  oneSentence: string;
  cards: ProjectBriefCard[];
  citations: ProjectBriefCitation[];
  generatedAt: string;
};

type BriefInput = {
  projectName: string;
  chunks: KnowledgeChunkRecord[];
  generatedAt?: string;
};

const fallbackItem = "资料不足，建议补充 PPT、README、代码包、SQL 或数据说明后重新生成。";

export function generateProjectBrief({
  projectName,
  chunks,
  generatedAt = new Date().toISOString(),
}: BriefInput): ProjectBrief {
  if (chunks.length === 0) {
    return {
      projectName,
      oneSentence: `${projectName}：资料还不足，需要先上传 PPT、README、代码或数据库文件。`,
      cards: [
        {
          title: "项目一句话",
          items: ["先上传课程项目资料，再生成可溯源速记卡。"],
        },
        { title: "技术路线", items: [fallbackItem] },
        { title: "功能模块", items: [fallbackItem] },
        { title: "数据与数据库", items: [fallbackItem] },
        { title: "个人贡献", items: [fallbackItem] },
        { title: "高危追问", items: ["老师可能会先问：你的项目资料依据在哪里？"] },
      ],
      citations: [],
      generatedAt,
    };
  }

  const lines = chunks.flatMap((chunk) =>
    chunk.content
      .split(/\r?\n/)
      .map((line) => normalizeLine(line))
      .filter(Boolean),
  );
  const oneSentence =
    firstMatching(lines, ["项目背景", "项目目标", "背景", "目标"]) ??
    `${projectName}：${lines[0]}`;

  return {
    projectName,
    oneSentence: sentenceForProject(projectName, oneSentence),
    cards: [
      {
        title: "项目一句话",
        items: [sentenceForProject(projectName, oneSentence)],
      },
      {
        title: "技术路线",
        items: pickLines(lines, ["技术路线", "技术栈", "架构", "Next", "React", "Node", "PostgreSQL"]),
      },
      {
        title: "功能模块",
        items: pickLines(lines, ["功能模块", "模块", "功能", "订单", "管理", "看板"]),
      },
      {
        title: "数据与数据库",
        items: pickLines(lines, ["数据库", "数据", "表", "SQL", "字段", "指标"]),
      },
      {
        title: "个人贡献",
        items: pickLines(lines, ["个人负责", "我负责", "分工", "贡献", "实现"]),
      },
      {
        title: "高危追问",
        items: riskQuestions(lines),
      },
    ],
    citations: chunks.map((chunk) => ({
      source: chunk.source,
      fileName: chunk.metadata.fileName,
      lineStart: chunk.metadata.lineStart,
      lineEnd: chunk.metadata.lineEnd,
    })),
    generatedAt,
  };
}

function sentenceForProject(projectName: string, line: string) {
  const cleanLine = stripLabel(line);
  if (cleanLine.startsWith(projectName)) return cleanLine;
  return `${projectName}：${cleanLine}`;
}

function pickLines(lines: string[], keywords: string[]) {
  const matches = lines
    .filter((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())))
    .map(stripLabel)
    .filter(Boolean);

  return unique(matches).slice(0, 4).concat(matches.length ? [] : [fallbackItem]);
}

function riskQuestions(lines: string[]) {
  const questions = [
    ["数据库", "为什么数据库这样设计？表之间的关系和冗余字段怎么解释？"],
    ["订单", "订单状态流转里，异常取消、重复提交和权限边界怎么处理？"],
    ["技术", "为什么选择这套技术路线，而不是更简单的传统方案？"],
    ["个人", "你个人负责了哪部分？能不能现场解释核心实现流程？"],
    ["数据", "数据来源、字段含义和指标可信度怎么保证？"],
  ];

  const matched = questions
    .filter(([keyword]) => lines.some((line) => line.includes(keyword)))
    .map(([, question]) => question);

  return unique(matched).slice(0, 4).concat(
    matched.length ? [] : ["老师可能会追问：项目目标、技术路线和个人贡献是否能互相对应？"],
  );
}

function firstMatching(lines: string[], keywords: string[]) {
  return lines.find((line) => keywords.some((keyword) => line.includes(keyword)));
}

function normalizeLine(line: string) {
  return line.replace(/^[-*#\s]+/g, "").trim();
}

function stripLabel(line: string) {
  return line.replace(/^[^：:]{2,12}[：:]\s*/u, "").trim();
}

function unique(items: string[]) {
  return Array.from(new Set(items));
}
