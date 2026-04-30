import type { SpeechSynthesisResult, TrainingVoiceState } from "@shared/domain";
import type { WeaknessRecord } from "@db/repositories/reviews";
import type {
  TrainingSessionRecord,
  TrainingTurnRecord,
} from "@db/repositories/training-sessions";

export type RetrievedSourceRef = {
  id: string;
  source: string;
  fileName?: string;
  lineStart?: number;
  lineEnd?: number;
  codePath?: string;
  page?: number;
  slide?: number;
};

type ChunkLike = {
  id?: string;
  content?: string;
  source: string;
  metadata?: Record<string, unknown>;
};

export type TrainingReviewTurn = {
  id: string;
  projectId: string;
  sessionId: string;
  slideId?: string | null;
  slideIndex: number;
  slideTitle: string;
  knowledgeNodeId?: string | null;
  teacherRole: string;
  userAnswer: string;
  aiMessage: string;
  score: number;
  strengths: string[];
  risks: string[];
  improvedAnswer: string;
  followUps: string[];
  citations: unknown;
  retrievedSourceIds: string[];
  speech: Record<string, unknown> | null;
  createdAt: string;
};

export type DeepDiveDraft = {
  id: string;
  projectId: string;
  weaknessId?: string | null;
  title: string;
  summary: string;
  checklist: string[];
  citations: unknown;
  createdAt: string;
};

export function createTrainingSessionRecord({
  projectId,
  title,
  teacherRole,
  difficulty,
  currentSlideId = null,
  currentKnowledgeNodeId = null,
  createdAt = new Date().toISOString(),
}: {
  projectId: string;
  title: string;
  teacherRole: string;
  difficulty: string;
  currentSlideId?: string | null;
  currentKnowledgeNodeId?: string | null;
  createdAt?: string;
}) {
  return {
    id: `session-${crypto.randomUUID()}`,
    projectId,
    title,
    teacherRole,
    difficulty,
    currentSlideId,
    currentKnowledgeNodeId,
    status: "active",
    voiceState: "idle" as TrainingVoiceState,
    hintCount: 0,
    followUpCount: 0,
    detectedWeaknesses: [] as string[],
    lastRetrievedSources: [] as RetrievedSourceRef[],
    shouldFinish: false,
    startedAt: createdAt,
    finishedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function buildRetrievedSources(chunks: ChunkLike[]): RetrievedSourceRef[] {
  const seen = new Set<string>();
  const sources: RetrievedSourceRef[] = [];

  for (const chunk of chunks) {
    const fileName = readString(chunk.metadata, "fileName");
    const lineStart = readNumber(chunk.metadata, "lineStart");
    const lineEnd = readNumber(chunk.metadata, "lineEnd");
    const codePath = readString(chunk.metadata, "codePath");
    const page = readNumber(chunk.metadata, "page");
    const slide = readNumber(chunk.metadata, "slide");
    const id = codePath
      ? `${codePath}:${lineStart ?? 1}-${lineEnd ?? lineStart ?? 1}`
      : `${fileName ?? chunk.source}:${lineStart ?? 1}-${lineEnd ?? lineStart ?? 1}`;
    if (seen.has(id)) continue;
    seen.add(id);
    sources.push({
      id,
      source: chunk.source,
      fileName: fileName ?? undefined,
      lineStart: lineStart ?? undefined,
      lineEnd: lineEnd ?? undefined,
      codePath: codePath ?? undefined,
      page: page ?? undefined,
      slide: slide ?? undefined,
    });
  }

  return sources;
}

export function buildSessionStatePatch({
  session,
  existingTurnCount,
  userAnswer,
  retrievedSources,
  followUps,
  risks,
  speech,
}: {
  session: Pick<
    TrainingSessionRecord,
    "followUpCount" | "hintCount" | "detectedWeaknesses" | "lastRetrievedSources"
  >;
  existingTurnCount: number;
  userAnswer: string;
  retrievedSources: RetrievedSourceRef[];
  followUps: string[];
  risks: string[];
  speech: SpeechSynthesisResult | null;
}) {
  const mergedWeaknesses = Array.from(new Set([
    ...(session.detectedWeaknesses ?? []),
    ...risks.map((risk) => risk.trim()).filter(Boolean),
  ]));
  const nextTurnCount = existingTurnCount + 1;

  return {
    voiceState: (speech?.audioUrl ? "speaking" : "thinking") as TrainingVoiceState,
    hintCount: session.hintCount + (userAnswer.trim() ? 0 : 1),
    followUpCount: session.followUpCount + followUps.length,
    detectedWeaknesses: mergedWeaknesses,
    lastRetrievedSources: retrievedSources,
    shouldFinish: nextTurnCount >= 3,
  };
}

export function normalizeTrainingTurnsForReview(turns: TrainingTurnRecord[]): TrainingReviewTurn[] {
  return turns.map((turn) => ({
    id: turn.id,
    projectId: turn.projectId,
    sessionId: turn.sessionId,
    slideId: turn.slideId ?? null,
    slideIndex: turn.slideIndex ?? 1,
    slideTitle: turn.slideTitle ?? turn.slideId ?? "当前页",
    knowledgeNodeId: turn.knowledgeNodeId ?? null,
    teacherRole: turn.teacherRole,
    userAnswer: turn.userAnswer,
    aiMessage: turn.aiMessage,
    score: turn.score ?? 0,
    strengths: toStringArray(turn.strengths),
    risks: toStringArray(turn.risks),
    improvedAnswer: turn.improvedAnswer ?? "",
    followUps: toStringArray(turn.followUps),
    citations: turn.citations,
    retrievedSourceIds: toStringArray(turn.retrievedSourceIds),
    speech: isRecord(turn.speech) ? turn.speech : null,
    createdAt: turn.createdAt,
  }));
}

export function buildDeepDiveDrafts({
  projectId,
  weaknesses,
  createdAt = new Date().toISOString(),
}: {
  projectId: string;
  weaknesses: WeaknessRecord[];
  createdAt?: string;
}): DeepDiveDraft[] {
  return weaknesses.map((weakness) => ({
    id: `deep-dive-${weakness.id}`,
    projectId,
    weaknessId: weakness.id,
    title: weakness.title,
    summary: weakness.reason,
    checklist: [
      "补一版 30 秒口头回答。",
      "补一条可以引用的证据链。",
      "再进行一次围绕此点的模拟追问。",
    ],
    citations: weakness.citations,
    createdAt,
  }));
}

function readString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" ? value : null;
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
