import { createHash } from "node:crypto";
import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createProjectRepository } from "@db/repositories/projects";
import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import { createRealtimeSessionRepository } from "@db/repositories/realtime-sessions";
import { createReviewRepository } from "@db/repositories/reviews";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import {
  createTrainingSessionRepository,
  type TrainingSessionRecord,
  type TrainingTurnRecord,
} from "@db/repositories/training-sessions";
import type { RealtimeSessionRecord } from "@shared/domain";
import type { DefensePracticeTurn } from "./defense-review.ts";
import { buildRetrievedSources, buildSessionStatePatch } from "./training-session.ts";
import { readProjectKnowledgeChunks, retrieveRelevantKnowledgeChunks } from "./knowledge-db.ts";

export type RealtimeContextInput = {
  projectId: string;
  currentSlideId?: string | null;
  currentKnowledgeNodeId?: string | null;
  slideTitle?: string | null;
  slideIndex?: number | null;
  memberScope?: string | null;
};

export async function readTrainingSessionAggregate(projectId: string, sessionId: string) {
  const [sessionResult, activeRealtimeSession, latestReview] = await Promise.all([
    createTrainingSessionRepository().readSession(sessionId),
    createRealtimeSessionRepository().readActiveForTrainingSession(sessionId),
    createReviewRepository().readBySession(sessionId),
  ]);

  if (!sessionResult.session || sessionResult.session.projectId !== projectId) {
    return null;
  }

  return {
    session: sessionResult.session,
    activeRealtimeSession,
    finalizedTurns: sessionResult.turns,
    voiceCaptures: sessionResult.voiceCaptures,
    latestReview: latestReview ?? sessionResult.latestReview ?? null,
    detectedWeaknesses: sessionResult.detectedWeaknesses,
    deepDiveRefs: sessionResult.deepDiveRefs,
  };
}

export async function buildRealtimeContextSnapshot(input: RealtimeContextInput) {
  const project = await createProjectRepository().read(input.projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const memberScope = input.memberScope?.trim() || project.ownerScope || "未提供";
  const retrievalQuery = [
    input.slideTitle ?? "",
    memberScope,
    input.currentKnowledgeNodeId ?? "",
  ]
    .join("\n")
    .trim();

  const relevantChunks = retrievalQuery
    ? await retrieveRelevantKnowledgeChunks({
      projectId: input.projectId,
      query: retrievalQuery,
      limit: 6,
      ...(await resolveRetrievalScope({
        projectId: input.projectId,
        knowledgeNodeId: input.currentKnowledgeNodeId ?? null,
      })),
      slideId: input.currentSlideId ?? undefined,
    })
    : [];
  const chunks = relevantChunks.length
    ? relevantChunks
    : await readProjectKnowledgeChunks(input.projectId);
  const retrievedSources = buildRetrievedSources(chunks).slice(0, 6);

  return {
    projectName: project.name,
    memberScope,
    slideTitle: input.slideTitle?.trim() || "当前页",
    slideIndex: input.slideIndex ?? null,
    currentSlideId: input.currentSlideId ?? null,
    currentKnowledgeNodeId: input.currentKnowledgeNodeId ?? null,
    knowledgeSummary: chunks
      .slice(0, 6)
      .map((chunk) => chunk.content.trim())
      .filter(Boolean)
      .map((content) => content.length > 220 ? `${content.slice(0, 220)}...` : content),
    retrievedSources,
    answerRules: [
      "优先解释结论、证据链和个人负责范围。",
      "如果被追问实现，优先回到接口、数据流或代码路径。",
      "回答不确定时先说明边界，再补下一步验证方式。",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function createRealtimeSessionToken() {
  return `rt_${crypto.randomUUID()}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function hashRealtimeSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRealtimeSessionRecord({
  projectId,
  trainingSession,
  tokenHash,
  contextSnapshot,
  now = new Date(),
}: {
  projectId: string;
  trainingSession: TrainingSessionRecord;
  tokenHash: string;
  contextSnapshot: Record<string, unknown>;
  now?: Date;
}): RealtimeSessionRecord {
  const createdAt = now.toISOString();
  const tokenExpiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  return {
    id: `rt-session-${crypto.randomUUID()}`,
    projectId,
    trainingSessionId: trainingSession.id,
    provider: "glm-realtime-flash",
    providerSessionId: null,
    status: "created",
    currentSlideId: trainingSession.currentSlideId ?? null,
    currentKnowledgeNodeId: trainingSession.currentKnowledgeNodeId ?? null,
    teacherRole: trainingSession.teacherRole,
    difficulty: trainingSession.difficulty,
    contextSnapshot,
    clientTokenHash: tokenHash,
    tokenExpiresAt,
    startedAt: null,
    endedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export async function finalizeRealtimeTurnAndAnalyze(turnDraft: TrainingTurnRecord) {
  const trainingRepository = createTrainingSessionRepository();
  const [sessionResult, project] = await Promise.all([
    trainingRepository.readSession(turnDraft.sessionId),
    createProjectRepository().read(turnDraft.projectId),
  ]);

  if (!sessionResult.session) {
    throw new Error("Training session not found while finalizing realtime turn.");
  }
  if (!project) {
    throw new Error("Project not found while finalizing realtime turn.");
  }

  const query = `${turnDraft.slideTitle ?? ""}\n${turnDraft.inputTranscript ?? turnDraft.userAnswer}`.trim();
  const retrievalScope = await resolveRetrievalScope({
    projectId: turnDraft.projectId,
    knowledgeNodeId: turnDraft.knowledgeNodeId ?? sessionResult.session.currentKnowledgeNodeId ?? null,
  });
  const relevantChunks = query
    ? await retrieveRelevantKnowledgeChunks({
      projectId: turnDraft.projectId,
      query,
      limit: 6,
      ...retrievalScope,
      slideId: turnDraft.slideId ?? sessionResult.session.currentSlideId ?? undefined,
    })
    : [];
  const chunks = relevantChunks.length
    ? relevantChunks
    : await readProjectKnowledgeChunks(turnDraft.projectId);
  const retrievedSources = buildRetrievedSources(chunks);
  const sharedPayload = {
    slideId: turnDraft.slideId ?? undefined,
    slideTitle: turnDraft.slideTitle ?? "当前页",
    slideIndex: turnDraft.slideIndex ?? 1,
    knowledgeNodeId: turnDraft.knowledgeNodeId ?? undefined,
    teacherRole: turnDraft.teacherRole,
    memberScope: project.ownerScope,
    userAnswer: turnDraft.inputTranscript ?? turnDraft.userAnswer,
    currentSlideId: turnDraft.slideId ?? sessionResult.session.currentSlideId ?? undefined,
    currentKnowledgeNodeId:
      turnDraft.knowledgeNodeId ?? sessionResult.session.currentKnowledgeNodeId ?? undefined,
    previousTurns: sessionResult.turns.slice(-3).map((turn) => ({
      userAnswer: turn.userAnswer,
      aiMessage: turn.aiMessage,
      score: turn.score ?? undefined,
    })),
    sessionState: sessionResult.session,
    retrievedSources,
    chunks,
  };

  const invocationRepository = createSkillInvocationRepository();
  const [followupResult, rubricResult, evidenceResult, scopeResult] = await Promise.all([
    invokeBuiltInSkillWithInvocation({
      projectId: turnDraft.projectId,
      projectName: project.name,
      skillId: "current_slide_followup",
      trigger: "realtime_turn_finalize",
      payload: sharedPayload,
    }),
    invokeBuiltInSkillWithInvocation({
      projectId: turnDraft.projectId,
      projectName: project.name,
      skillId: "rubric_scoring",
      trigger: "realtime_turn_finalize",
      payload: sharedPayload,
      resolvedBy: "system",
    }),
    invokeBuiltInSkillWithInvocation({
      projectId: turnDraft.projectId,
      projectName: project.name,
      skillId: "evidence_gap_check",
      trigger: "realtime_turn_finalize",
      payload: sharedPayload,
      resolvedBy: "system",
    }),
    invokeBuiltInSkillWithInvocation({
      projectId: turnDraft.projectId,
      projectName: project.name,
      skillId: "member_scope_defense",
      trigger: "realtime_turn_finalize",
      payload: sharedPayload,
      resolvedBy: "system",
    }),
  ]);
  await Promise.all([
    invocationRepository.write(followupResult.invocation),
    invocationRepository.write(rubricResult.invocation),
    invocationRepository.write(evidenceResult.invocation),
    invocationRepository.write(scopeResult.invocation),
  ]);

  const analyzed = followupResult.output as {
    message: string;
    feedback: { score: number; strengths: string[]; risks: string[]; improvedAnswer: string };
    followUps: string[];
    citations: DefensePracticeTurn["citations"];
  };
  const rubric = rubricResult.output as {
    overallScore: number;
    dimensions: Array<{ name: string; score: number; comment: string }>;
    summary: string;
  };
  const evidence = evidenceResult.output as {
    summary: string;
    gaps: string[];
    missingEvidence: string[];
    citations: DefensePracticeTurn["citations"];
  };
  const scopeDefense = scopeResult.output as {
    scopeStatement: string;
    scopeClarityScore: number;
    risks: string[];
    followUp: string;
  };
  const mergedStrengths = Array.from(new Set([
    ...analyzed.feedback.strengths,
    ...rubric.dimensions.filter((dimension) => dimension.score >= 80).map((dimension) => dimension.comment),
  ]));
  const mergedRisks = Array.from(new Set([
    ...analyzed.feedback.risks,
    ...evidence.gaps,
    ...evidence.missingEvidence,
    ...scopeDefense.risks,
  ]));
  const mergedFollowUps = Array.from(new Set([
    ...analyzed.followUps,
    scopeDefense.followUp,
  ].filter(Boolean)));
  const mergedCitations = dedupeCitations([
    ...analyzed.citations,
    ...evidence.citations,
  ]);
  const mergedScore = Math.round((
    analyzed.feedback.score
    + rubric.overallScore
    + scopeDefense.scopeClarityScore
  ) / 3);

  const finalizedTurn: TrainingTurnRecord = {
    ...turnDraft,
    userAnswer: turnDraft.inputTranscript ?? turnDraft.userAnswer,
    aiMessage: turnDraft.assistantTranscript ?? analyzed.message,
    score: mergedScore,
    strengths: mergedStrengths,
    risks: mergedRisks,
    improvedAnswer: [analyzed.feedback.improvedAnswer, scopeDefense.scopeStatement].filter(Boolean).join(" "),
    followUps: mergedFollowUps,
    citations: mergedCitations,
    retrievedSourceIds: retrievedSources.map((source) => source.id),
    speech: null,
  };

  await trainingRepository.addTurn(finalizedTurn);
  const sessionPatch = {
    currentSlideId: turnDraft.slideId ?? sessionResult.session.currentSlideId ?? null,
    currentKnowledgeNodeId:
      turnDraft.knowledgeNodeId ?? sessionResult.session.currentKnowledgeNodeId ?? null,
    ...buildSessionStatePatch({
      session: sessionResult.session,
      existingTurnCount: sessionResult.turns.length,
      userAnswer: finalizedTurn.userAnswer,
      retrievedSources,
      followUps: mergedFollowUps,
      risks: mergedRisks,
      speech: null,
    }),
  };
  await trainingRepository.updateSession(turnDraft.sessionId, sessionPatch);

  return {
    turn: finalizedTurn,
    sessionPatch,
    skillInvocation: followupResult.invocation,
    skillInvocations: [
      followupResult.invocation,
      rubricResult.invocation,
      evidenceResult.invocation,
      scopeResult.invocation,
    ],
    retrievedSources,
  };
}

function dedupeCitations(citations: DefensePracticeTurn["citations"]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.source}-${citation.fileName}-${citation.lineStart}-${citation.lineEnd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function resolveRetrievalScope({
  projectId,
  knowledgeNodeId,
}: {
  projectId: string;
  knowledgeNodeId?: string | null;
}) {
  if (!knowledgeNodeId) {
    return {};
  }

  const node = await createKnowledgeMapRepository().readNode(projectId, knowledgeNodeId);
  if (!node) {
    return {};
  }

  const fileId = typeof node.metadata?.fileId === "string" ? node.metadata.fileId : undefined;
  const sourceId = typeof node.metadata?.sourceId === "string"
    ? node.metadata.sourceId
    : node.sourceId ?? undefined;

  return {
    fileId,
    sourceId,
  };
}
