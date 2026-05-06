import type {
  SlideDrillMessage,
  SlideDrillQuestion,
} from "./project-data-api";

export type DrillItemMeta = {
  createdAt: string;
  id: string;
};

export function normalizeSlideDrillQuestionText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function mergeSlideDrillQuestion(
  questions: SlideDrillQuestion[],
  text: string,
  source: SlideDrillQuestion["source"],
  meta: DrillItemMeta,
) {
  const normalized = normalizeSlideDrillQuestionText(text);
  if (!normalized) return questions;
  const exists = questions.some((question) =>
    normalizeSlideDrillQuestionText(question.text) === normalized
  );
  if (exists) return questions;
  return [...questions, {
    createdAt: meta.createdAt,
    id: meta.id,
    source,
    text: normalized,
  }];
}

export function mergeSlideDrillQuestionList(
  questions: SlideDrillQuestion[],
  texts: string[],
  source: SlideDrillQuestion["source"],
  createMeta: () => DrillItemMeta,
) {
  return texts.reduce(
    (current, text) => mergeSlideDrillQuestion(current, text, source, createMeta()),
    questions,
  );
}

export function appendSlideDrillMessage(
  messages: SlideDrillMessage[],
  role: SlideDrillMessage["role"],
  content: string,
  meta: DrillItemMeta,
  suggestedQuestions?: string[],
) {
  const normalized = content.trim();
  if (!normalized) return messages;
  return [...messages, {
    content: normalized,
    createdAt: meta.createdAt,
    id: meta.id,
    role,
    suggestedQuestions: suggestedQuestions?.map(normalizeSlideDrillQuestionText).filter(Boolean),
  }];
}
