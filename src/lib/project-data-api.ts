import { readApiErrorMessage } from "./api-error";

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
  reason?: string | null;
};

export type SkillInvocationItem = {
  id: string;
  skillName: string;
  trigger: string;
  status: string;
  outputSummary?: unknown;
  startedAt: string;
  durationMs?: number;
};

export type ContentExportItem = {
  id: string;
  kind: string;
  title: string;
  content?: unknown;
  status: string;
  createdAt: string;
};

export async function fetchProjectSlides(projectId: string) {
  return fetchProjectJson<{
    slideDecks?: ProjectSlideDeck[];
    slides?: ProjectSlide[];
  }>(projectId, "slides");
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

export async function fetchProjectContentExports(projectId: string) {
  return fetchProjectJson<{ exports?: ContentExportItem[] }>(projectId, "content-exports");
}

export async function createProjectTrainingSession(projectId: string, currentSlideId?: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/training-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "项目模拟讲练",
      teacherRole: "strict",
      difficulty: "normal",
      currentSlideId,
    }),
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<{
    session?: { id: string; title: string; status: string };
    nextStep?: { createRealtimeSessionPath?: string };
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
