import { readApiErrorMessage } from "./api-error";
import type { ProjectOverviewDto } from "./project-overview";
import type {
  DefensePhase,
  RealtimeSessionRecord,
  TrainingSessionProgress,
} from "@shared/domain";

export type ProjectSlide = {
  id: string;
  deckId?: string;
  projectId: string;
  fileId?: string;
  page: number;
  title: string;
  extractedText?: string | null;
  imagePath?: string | null;
  thumbnailPath?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type ProjectSlideDeck = {
  id: string;
  projectId: string;
  fileId?: string;
  title: string;
  pageCount: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type SlideAssistantAction =
  | "overview"
  | "short"
  | "conversational"
  | "contribution"
  | "transition"
  | "teacher_question"
  | "answer_card"
  | "keywords"
  | "rewrite"
  | "rewrite_draft"
  | "drill_answer";

export type SlideAssistantOverview = {
  projectName: string;
  slideTitle: string;
  task: string;
  normal: string;
  short: string;
  conversational: string;
  contribution: string;
  transition: string;
  answerCard: string;
  keywords: string[];
  risks: string[];
  basis: {
    topics: string[];
    materials: string[];
  };
};

export type SlideAssistantInsertResult = {
  label: string;
  content: string;
  tone?: "pause" | "question" | "card";
};

export type SlideAssistantResponse =
  | {
      result: SlideAssistantOverview;
      skillInvocationId?: string;
      skillStatus?: string;
      usedFallback?: boolean;
    }
  | {
      result: SlideAssistantInsertResult;
      skillInvocationId?: string;
      skillStatus?: string;
      usedFallback?: boolean;
    };

export type SlideScriptVersion = "normal" | "short" | "keywords";

export type SlideScriptDraft = {
  contentHtml: string;
  id: string;
  updatedAt: string;
  version: SlideScriptVersion;
};

export type SlideDrillQuestion = {
  id: string;
  text: string;
  source: "ai" | "user";
  createdAt: string;
  queuedAt?: string;
  queuedForTraining?: boolean;
};

export type SlideDrillMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestedQuestions?: string[];
  createdAt: string;
};

export type SlideDrillState = {
  id?: string;
  questions: SlideDrillQuestion[];
  messages: SlideDrillMessage[];
  updatedAt?: string;
};

export type SlideDrillAnswerResponse = {
  answer: string;
  suggestedQuestions: string[];
  skillInvocationId?: string;
  skillStatus?: string;
  usedFallback?: boolean;
};

export type WeaknessItem = {
  id: string;
  projectId: string;
  sessionId?: string | null;
  title: string;
  reason: string;
  status: string;
  citations?: unknown;
  createdAt: string;
};

export type DeepDiveItem = {
  id: string;
  projectId: string;
  weaknessId?: string | null;
  title: string;
  summary: string;
  checklist?: unknown;
  citations?: unknown;
  createdAt: string;
};

export type SkillPackItem = {
  packId?: string;
  id?: string;
  name: string;
  description?: string;
  enabled?: boolean;
  defaultEnabled?: boolean;
  recommendedFor?: string[];
  reason?: string | null;
  skills?: string[];
  source?: string;
};

export type SkillInvocationItem = {
  id: string;
  durationMs?: number;
  feedbackStatus?: string;
  outputSummary?: unknown;
  resolvedBy?: string;
  skillName: string;
  skillVersion?: string;
  startedAt: string;
  status: string;
  trigger: string;
  usedFallback?: boolean;
};

export type SkillCatalogItem = {
  id: string;
  version: string;
  name: string;
  description: string;
  trigger: {
    mode: string;
    event: string;
  };
  output: {
    type: string;
  };
  projectTypes: string[];
  allowedTools: string[];
  packIds: string[];
  fallbackPolicy: "required" | "optional" | "none";
  traceTags: string[];
  inputSchemaName: string;
  outputSchemaName: string;
};

export type SkillPackCatalogItem = {
  id: string;
  name: string;
  description: string;
  scope: "system";
  skills: string[];
  defaultEnabled: boolean;
  recommendedFor: string[];
};

export type ContentExportItem = {
  id: string;
  kind: string;
  title: string;
  content?: unknown;
  status: string;
  createdAt: string;
};

export type TrainingFocusItem = {
  id: string;
  projectId: string;
  knowledgeNodeId: string;
  knowledgeNode?: {
    id: string;
    kind: string;
    title: string;
    summary: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type TrainingSessionSummary = {
  id: string;
  title: string;
  status: string;
  currentPhase: DefensePhase;
  currentSlideId?: string | null;
  currentSlideIndex: number;
  currentKnowledgeNodeId?: string | null;
  completedSlideIds: string[];
  currentFollowupCount: number;
  finalQuestionIndex: number;
  lastPhaseAt: string;
};

export type TrainingSessionAggregate = {
  session?: TrainingSessionSummary | null;
  activeRealtimeSession?: RealtimeSessionRecord | null;
  finalizedTurns?: unknown[];
  latestReview?: unknown;
  detectedWeaknesses?: unknown[];
  deepDiveRefs?: unknown[];
};

export type RealtimeSessionCreatePayload = {
  currentPhase?: DefensePhase;
  currentSlideId?: string | null;
  currentSlideIndex?: number;
  currentKnowledgeNodeId?: string | null;
  focusKnowledgeNodeIds?: string[];
  slideTitle?: string;
  slideGoal?: string;
  cueKeywords?: string[];
  previousSlideFeedback?: string | null;
  followUpBudget?: number;
  memberScope?: string;
  seedQuestions?: RealtimeSeedQuestion[];
};

export type RealtimeSeedQuestion = {
  slideId: string;
  source: "ai" | "user";
  text: string;
};

export type RealtimeSessionCreateResponse = {
  realtimeSessionId: string;
  wsUrl: string;
  sessionToken: string;
  expiresAt: string;
  contextSnapshot: Record<string, unknown>;
  activeRealtimeSession: RealtimeSessionRecord;
  progress?: TrainingSessionProgress | null;
};

export async function fetchProjectSlides(projectId: string) {
  return fetchProjectJson<{
    slideDecks?: ProjectSlideDeck[];
    slides?: ProjectSlide[];
  }>(projectId, "slides");
}

export async function fetchProjectOverview(projectId: string) {
  return fetchProjectJson<{ overview: ProjectOverviewDto }>(projectId, "overview");
}

export async function runSlideAssistantAction(
  projectId: string,
  slideId: string,
  payload: {
    action: SlideAssistantAction;
    currentDraft?: string;
    instruction?: string;
    selectedText?: string;
  },
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slideId)}/assistant`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<SlideAssistantResponse>;
}

export async function fetchSlideScriptDraft(
  projectId: string,
  slideId: string,
  version: SlideScriptVersion,
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slideId)}/script-drafts?version=${encodeURIComponent(version)}`,
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ draft: SlideScriptDraft | null }>;
}

export async function saveSlideScriptDraft(
  projectId: string,
  slideId: string,
  payload: {
    contentHtml: string;
    version: SlideScriptVersion;
  },
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slideId)}/script-drafts`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ draft: SlideScriptDraft }>;
}

export async function fetchSlideDrillState(projectId: string, slideId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slideId)}/drill`,
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ state: SlideDrillState | null }>;
}

export async function saveSlideDrillState(
  projectId: string,
  slideId: string,
  payload: Pick<SlideDrillState, "messages" | "questions">,
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slideId)}/drill`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ state: SlideDrillState }>;
}

export async function answerSlideDrillQuestion(
  projectId: string,
  slideId: string,
  payload: {
    currentDraft?: string;
    messages: SlideDrillMessage[];
    question: string;
  },
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slideId)}/drill/answer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<SlideDrillAnswerResponse>;
}

export async function fetchProjectDeepDives(projectId: string) {
  return fetchProjectJson<{
    deepDives?: DeepDiveItem[];
    weaknesses?: WeaknessItem[];
  }>(projectId, "deep-dives");
}

export async function fetchProjectSkillPacks(projectId: string) {
  return fetchProjectJson<{ skillPacks?: SkillPackItem[] }>(projectId, "skill-packs");
}

export async function fetchProjectSkillInvocations(projectId: string) {
  return fetchProjectJson<{ invocations?: SkillInvocationItem[] }>(
    projectId,
    "skill-invocations?limit=12",
  );
}

export async function fetchSkillCatalog() {
  const response = await fetch("/api/skills");
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ skills?: SkillCatalogItem[] }>;
}

export async function fetchSkillPackCatalog() {
  const response = await fetch("/api/skill-packs");
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ skillPacks?: SkillPackCatalogItem[] }>;
}

export async function fetchProjectContentExports(projectId: string) {
  return fetchProjectJson<{ exports?: ContentExportItem[] }>(projectId, "content-exports");
}

export async function fetchProjectTrainingFocuses(projectId: string) {
  return fetchProjectJson<{ focuses?: TrainingFocusItem[] }>(projectId, "training-focuses");
}

export async function addProjectTrainingFocus(projectId: string, knowledgeNodeId: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/training-focuses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ knowledgeNodeId }),
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ focus?: TrainingFocusItem; focuses?: TrainingFocusItem[] }>;
}

export async function removeProjectTrainingFocus(projectId: string, knowledgeNodeId: string) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/training-focuses/${encodeURIComponent(knowledgeNodeId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ focuses?: TrainingFocusItem[] }>;
}

export async function createProjectTrainingSession(
  projectId: string,
  currentSlideId?: string,
  currentSlideIndex?: number,
  focusKnowledgeNodeIds?: string[],
) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/training-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "项目模拟讲练",
      teacherRole: "strict",
      difficulty: "normal",
      currentSlideId,
      currentSlideIndex,
      focusKnowledgeNodeIds,
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{
    session?: TrainingSessionSummary;
    progress?: TrainingSessionProgress | null;
    nextStep?: { createRealtimeSessionPath?: string };
  }>;
}

export async function fetchTrainingSessionAggregate(projectId: string, sessionId: string) {
  return fetchProjectJson<TrainingSessionAggregate>(
    projectId,
    `training-sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function createRealtimeTrainingSession(
  projectId: string,
  sessionId: string,
  payload: RealtimeSessionCreatePayload,
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/training-sessions/${encodeURIComponent(sessionId)}/realtime-sessions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<RealtimeSessionCreateResponse>;
}

export async function updateRealtimeTrainingContext(
  projectId: string,
  sessionId: string,
  realtimeSessionId: string,
  payload: RealtimeSessionCreatePayload,
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/training-sessions/${encodeURIComponent(sessionId)}/realtime-sessions/${encodeURIComponent(realtimeSessionId)}/context`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{
    sessionPatch?: { session?: TrainingSessionSummary | null };
    realtimeSessionPatch?: RealtimeSessionRecord | null;
    contextSnapshot: Record<string, unknown>;
  }>;
}

export async function finishRealtimeTrainingSession(
  projectId: string,
  sessionId: string,
  payload: { reviewMode?: "none" | "full" } = {},
) {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/training-sessions/${encodeURIComponent(sessionId)}/finish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{
    finalizedTurns?: unknown[];
    review?: unknown;
    weaknesses?: unknown[];
    deepDives?: unknown[];
    sessionPatch?: unknown;
  }>;
}

export async function createProjectContentExports(projectId: string, summary?: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/content-exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ summary }),
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{ exports?: ContentExportItem[] }>;
}

async function fetchProjectJson<T>(projectId: string, endpoint: string): Promise<T> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/${endpoint}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<T>;
}
