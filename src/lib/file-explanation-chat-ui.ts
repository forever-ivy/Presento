import type { NotebookCitation, NotebookExplanationMode } from "@shared/domain";
import type { FileExplanationStreamMessage } from "./file-explanation-stream";

export function getFileExplanationMessageText(message: FileExplanationStreamMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function getFileExplanationMessageCitations(message: FileExplanationStreamMessage) {
  const citations = message.parts
    .filter((part) => part.type === "data-citations")
    .flatMap((part) => part.data.citations);
  return dedupeCitations(citations);
}

export function getFileExplanationBusyLabel(status: FileExplanationChatUiStatus) {
  switch (status) {
    case "loading-cache":
      return "正在读取已有讲解...";
    case "submitted":
      return "正在组织回答...";
    case "streaming":
      return "正在结合当前资料生成回答...";
    default:
      return null;
  }
}

export function getInitialFileExplanationQuestion({
  focusNodeTitle,
  nodeTitle,
}: {
  focusNodeTitle?: string;
  nodeTitle: string;
}) {
  const trimmedFocusTitle = focusNodeTitle?.trim();
  if (trimmedFocusTitle) {
    return `这份资料如何支撑「${trimmedFocusTitle}」这个答辩讲点？`;
  }

  return `请讲解当前资料《${nodeTitle}》，并指出答辩需要掌握的重点。`;
}

export function getFileExplanationStarterPrompts(mode: NotebookExplanationMode, nodeTitle: string) {
  if (mode === "mastery") {
    return [
      `老师最可能围绕《${nodeTitle}》追问我什么？`,
      `请把这个材料拆成“我必须会讲”的 3 个核心点。`,
      "如果我答得含糊，你会从哪里继续追问？",
    ];
  }

  return [
    `请用 30 秒讲清《${nodeTitle}》的作用。`,
    "只保留答辩最需要记住的内容。",
    "帮我先给出一个自然的开场讲法。",
  ];
}

export type FileExplanationChatUiStatus =
  | "loading-cache"
  | "submitted"
  | "streaming"
  | "ready"
  | "error";

function dedupeCitations(citations: NotebookCitation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = [
      citation.fileId ?? "",
      citation.fileName ?? "",
      citation.codePath ?? "",
      citation.page ?? "",
      citation.slide ?? "",
      citation.sheet ?? "",
      citation.lineStart ?? "",
      citation.lineEnd ?? "",
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
