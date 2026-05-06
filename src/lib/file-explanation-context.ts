export type FileExplanationSelectedContext = {
  id: string;
  text: string;
  fileName?: string;
};

export const MAX_FILE_EXPLANATION_CONTEXTS = 3;
export const MAX_FILE_EXPLANATION_CONTEXT_CHARS = 1200;

export function normalizeSelectedContexts(contexts: FileExplanationSelectedContext[] | undefined) {
  return (contexts ?? [])
    .map((context) => ({
      ...context,
      id: context.id.trim(),
      text: context.text.replace(/\s+/gu, " ").trim().slice(0, MAX_FILE_EXPLANATION_CONTEXT_CHARS),
      fileName: context.fileName?.trim() || undefined,
    }))
    .filter((context) => context.id && context.text)
    .slice(0, MAX_FILE_EXPLANATION_CONTEXTS);
}

export function selectedContextsToPrompt(contexts: FileExplanationSelectedContext[] | undefined) {
  const normalized = normalizeSelectedContexts(contexts);
  if (!normalized.length) return "";
  return normalized
    .map((context, index) => {
      const source = context.fileName ? `（${context.fileName}）` : "";
      return `选中上下文 ${index + 1}${source}：${context.text}`;
    })
    .join("\n");
}
