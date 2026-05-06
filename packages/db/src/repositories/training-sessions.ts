import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlNumber, sqlText, sqlTimestamp } from "../sql.ts";
import type { DefensePhase, TurnType } from "@shared/domain";

export type TrainingSessionRecord = {
  id: string;
  projectId: string;
  title: string;
  teacherRole: string;
  difficulty: string;
  currentPhase: DefensePhase;
  currentSlideId?: string | null;
  currentSlideIndex: number;
  currentKnowledgeNodeId?: string | null;
  focusKnowledgeNodeIds: string[];
  completedSlideIds: string[];
  currentFollowupCount: number;
  finalQuestionIndex: number;
  status: string;
  voiceState: string;
  hintCount: number;
  followUpCount: number;
  detectedWeaknesses: string[];
  lastRetrievedSources: unknown;
  shouldFinish: boolean;
  lastPhaseAt: string;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TrainingTurnRecord = {
  id: string;
  sessionId: string;
  projectId: string;
  realtimeSessionId?: string | null;
  turnIndex?: number | null;
  turnType?: TurnType | null;
  phaseBefore?: DefensePhase | null;
  phaseAfter?: DefensePhase | null;
  slideId?: string | null;
  slideIndex?: number | null;
  slideTitle?: string | null;
  knowledgeNodeId?: string | null;
  teacherRole: string;
  userAnswer: string;
  aiMessage: string;
  inputTranscript?: string | null;
  assistantTranscript?: string | null;
  providerResponseId?: string | null;
  providerTraceId?: string | null;
  latencyMs?: number | null;
  mode?: string | null;
  score?: number | null;
  strengths: unknown;
  risks: unknown;
  improvedAnswer?: string | null;
  followUps: unknown;
  slideFeedbackSummary?: string | null;
  citations: unknown;
  retrievedSourceIds: unknown;
  speech: unknown;
  createdAt: string;
};

export type VoiceCaptureRecord = {
  id: string;
  sessionId: string;
  projectId: string;
  turnId?: string | null;
  filePath: string;
  mimeType: string;
  durationMs?: number | null;
  transcriptText?: string | null;
  state: string;
  metadata: unknown;
  createdAt: string;
};

export function createTrainingSessionRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async createSession(session: TrainingSessionRecord) {
      await helpers.run(writeSessionSql(session));
      return session;
    },

    async readSession(sessionId: string) {
      return helpers.readJson<{
        session: TrainingSessionRecord | null;
        turns: TrainingTurnRecord[];
        voiceCaptures: VoiceCaptureRecord[];
        latestReview?: { id: string; sessionId: string } | null;
        detectedWeaknesses: Array<{ id: string; title: string; status?: string | null }>;
        deepDiveRefs: Array<{ id: string; weaknessId?: string | null; title: string }>;
      }>(
        readSessionSql(sessionId),
        {
          session: null,
          turns: [],
          voiceCaptures: [],
          latestReview: null,
          detectedWeaknesses: [],
          deepDiveRefs: [],
        },
      );
    },

    async addTurn(turn: TrainingTurnRecord) {
      await helpers.run(writeTurnSql(turn));
      return turn;
    },

    async addVoiceCapture(capture: VoiceCaptureRecord) {
      await helpers.run(writeVoiceCaptureSql(capture));
      return capture;
    },

    async finishSession(sessionId: string, finishedAt: string, voiceState = "idle") {
      await helpers.run(`
UPDATE "TrainingSession"
SET
  "status" = 'finished',
  "voiceState" = ${sqlText(voiceState)},
  "finishedAt" = ${sqlTimestamp(finishedAt)},
  "updatedAt" = ${sqlTimestamp(finishedAt)}
WHERE "id" = ${sqlText(sessionId)};`);
    },

    async updateSession(sessionId: string, patch: Partial<TrainingSessionRecord>) {
      await helpers.run(updateSessionSql(sessionId, patch));
      return this.readSession(sessionId);
    },

    async findLatestCompatibilitySession(projectId: string) {
      return helpers.readJson<TrainingSessionRecord | null>(readLatestCompatibilitySessionSql(projectId), null);
    },
  };
}

function writeSessionSql(session: TrainingSessionRecord) {
  return `
INSERT INTO "TrainingSession" (
  "id", "projectId", "title", "teacherRole", "difficulty", "currentPhase", "currentSlideId",
  "currentSlideIndex", "currentKnowledgeNodeId", "focusKnowledgeNodeIds", "completedSlideIds",
  "currentFollowupCount", "finalQuestionIndex", "status", "voiceState", "hintCount", "followUpCount",
  "detectedWeaknesses", "lastRetrievedSources", "shouldFinish", "lastPhaseAt", "startedAt", "finishedAt",
  "createdAt", "updatedAt"
) VALUES (
  ${sqlText(session.id)},
  ${sqlText(session.projectId)},
  ${sqlText(session.title)},
  ${sqlText(session.teacherRole)},
  ${sqlText(session.difficulty)},
  ${sqlText(session.currentPhase)},
  ${sqlText(session.currentSlideId)},
  ${sqlNumber(session.currentSlideIndex)},
  ${sqlText(session.currentKnowledgeNodeId)},
  ${sqlJson(session.focusKnowledgeNodeIds)},
  ${sqlJson(session.completedSlideIds)},
  ${sqlNumber(session.currentFollowupCount)},
  ${sqlNumber(session.finalQuestionIndex)},
  ${sqlText(session.status)},
  ${sqlText(session.voiceState)},
  ${sqlNumber(session.hintCount)},
  ${sqlNumber(session.followUpCount)},
  ${sqlJson(session.detectedWeaknesses)},
  ${sqlJson(session.lastRetrievedSources)},
  ${session.shouldFinish ? "true" : "false"},
  ${sqlTimestamp(session.lastPhaseAt)},
  ${sqlTimestamp(session.startedAt)},
  ${sqlTimestamp(session.finishedAt)},
  ${sqlTimestamp(session.createdAt)},
  ${sqlTimestamp(session.updatedAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "teacherRole" = EXCLUDED."teacherRole",
  "difficulty" = EXCLUDED."difficulty",
  "currentPhase" = EXCLUDED."currentPhase",
  "currentSlideId" = EXCLUDED."currentSlideId",
  "currentSlideIndex" = EXCLUDED."currentSlideIndex",
  "currentKnowledgeNodeId" = EXCLUDED."currentKnowledgeNodeId",
  "focusKnowledgeNodeIds" = EXCLUDED."focusKnowledgeNodeIds",
  "completedSlideIds" = EXCLUDED."completedSlideIds",
  "currentFollowupCount" = EXCLUDED."currentFollowupCount",
  "finalQuestionIndex" = EXCLUDED."finalQuestionIndex",
  "status" = EXCLUDED."status",
  "voiceState" = EXCLUDED."voiceState",
  "hintCount" = EXCLUDED."hintCount",
  "followUpCount" = EXCLUDED."followUpCount",
  "detectedWeaknesses" = EXCLUDED."detectedWeaknesses",
  "lastRetrievedSources" = EXCLUDED."lastRetrievedSources",
  "shouldFinish" = EXCLUDED."shouldFinish",
  "lastPhaseAt" = EXCLUDED."lastPhaseAt",
  "startedAt" = EXCLUDED."startedAt",
  "finishedAt" = EXCLUDED."finishedAt",
  "updatedAt" = EXCLUDED."updatedAt";`;
}

function writeTurnSql(turn: TrainingTurnRecord) {
  return `
INSERT INTO "TrainingTurn" (
  "id", "sessionId", "projectId", "realtimeSessionId", "turnIndex", "turnType", "phaseBefore",
  "phaseAfter", "slideId", "slideIndex", "slideTitle", "knowledgeNodeId", "teacherRole", "userAnswer",
  "aiMessage", "inputTranscript", "assistantTranscript", "providerResponseId", "providerTraceId",
  "latencyMs", "mode", "score", "strengths", "risks", "improvedAnswer", "followUps",
  "slideFeedbackSummary", "citations", "retrievedSourceIds", "speech", "createdAt"
) VALUES (
  ${sqlText(turn.id)},
  ${sqlText(turn.sessionId)},
  ${sqlText(turn.projectId)},
  ${sqlText(turn.realtimeSessionId)},
  ${turn.turnIndex === null || turn.turnIndex === undefined ? "NULL" : sqlNumber(turn.turnIndex)},
  ${sqlText(turn.turnType)},
  ${sqlText(turn.phaseBefore)},
  ${sqlText(turn.phaseAfter)},
  ${sqlText(turn.slideId)},
  ${turn.slideIndex === null || turn.slideIndex === undefined ? "NULL" : sqlNumber(turn.slideIndex)},
  ${sqlText(turn.slideTitle)},
  ${sqlText(turn.knowledgeNodeId)},
  ${sqlText(turn.teacherRole)},
  ${sqlText(turn.userAnswer)},
  ${sqlText(turn.aiMessage)},
  ${sqlText(turn.inputTranscript)},
  ${sqlText(turn.assistantTranscript)},
  ${sqlText(turn.providerResponseId)},
  ${sqlText(turn.providerTraceId)},
  ${turn.latencyMs === null || turn.latencyMs === undefined ? "NULL" : sqlNumber(turn.latencyMs)},
  ${sqlText(turn.mode ?? "realtime")},
  ${turn.score === null || turn.score === undefined ? "NULL" : sqlNumber(turn.score)},
  ${sqlJson(turn.strengths)},
  ${sqlJson(turn.risks)},
  ${sqlText(turn.improvedAnswer)},
  ${sqlJson(turn.followUps)},
  ${sqlText(turn.slideFeedbackSummary)},
  ${sqlJson(turn.citations)},
  ${sqlJson(turn.retrievedSourceIds)},
  ${sqlJson(turn.speech)},
  ${sqlTimestamp(turn.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "realtimeSessionId" = EXCLUDED."realtimeSessionId",
  "turnIndex" = EXCLUDED."turnIndex",
  "turnType" = EXCLUDED."turnType",
  "phaseBefore" = EXCLUDED."phaseBefore",
  "phaseAfter" = EXCLUDED."phaseAfter",
  "slideId" = EXCLUDED."slideId",
  "slideIndex" = EXCLUDED."slideIndex",
  "slideTitle" = EXCLUDED."slideTitle",
  "knowledgeNodeId" = EXCLUDED."knowledgeNodeId",
  "teacherRole" = EXCLUDED."teacherRole",
  "userAnswer" = EXCLUDED."userAnswer",
  "aiMessage" = EXCLUDED."aiMessage",
  "inputTranscript" = EXCLUDED."inputTranscript",
  "assistantTranscript" = EXCLUDED."assistantTranscript",
  "providerResponseId" = EXCLUDED."providerResponseId",
  "providerTraceId" = EXCLUDED."providerTraceId",
  "latencyMs" = EXCLUDED."latencyMs",
  "mode" = EXCLUDED."mode",
  "score" = EXCLUDED."score",
  "strengths" = EXCLUDED."strengths",
  "risks" = EXCLUDED."risks",
  "improvedAnswer" = EXCLUDED."improvedAnswer",
  "followUps" = EXCLUDED."followUps",
  "slideFeedbackSummary" = EXCLUDED."slideFeedbackSummary",
  "citations" = EXCLUDED."citations",
  "retrievedSourceIds" = EXCLUDED."retrievedSourceIds",
  "speech" = EXCLUDED."speech";`;
}

function writeVoiceCaptureSql(capture: VoiceCaptureRecord) {
  return `
INSERT INTO "VoiceCapture" (
  "id", "sessionId", "projectId", "turnId", "filePath", "mimeType", "durationMs",
  "transcriptText", "state", "metadata", "createdAt"
) VALUES (
  ${sqlText(capture.id)},
  ${sqlText(capture.sessionId)},
  ${sqlText(capture.projectId)},
  ${sqlText(capture.turnId)},
  ${sqlText(capture.filePath)},
  ${sqlText(capture.mimeType)},
  ${capture.durationMs === null || capture.durationMs === undefined ? "NULL" : sqlNumber(capture.durationMs)},
  ${sqlText(capture.transcriptText)},
  ${sqlText(capture.state)},
  ${sqlJson(capture.metadata)},
  ${sqlTimestamp(capture.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "turnId" = EXCLUDED."turnId",
  "durationMs" = EXCLUDED."durationMs",
  "transcriptText" = EXCLUDED."transcriptText",
  "state" = EXCLUDED."state",
  "metadata" = EXCLUDED."metadata";`;
}

function readSessionSql(sessionId: string) {
  return `
WITH target_session AS (
  SELECT *
  FROM "TrainingSession"
  WHERE "id" = ${sqlText(sessionId)}
  LIMIT 1
)
SELECT json_build_object(
  'session', (
    SELECT row_to_json(target_session)
    FROM target_session
  ),
  'turns', COALESCE((
    SELECT json_agg(row_to_json(turn_rows) ORDER BY turn_rows."createdAt")
    FROM "TrainingTurn" turn_rows
    WHERE turn_rows."sessionId" = ${sqlText(sessionId)}
  ), '[]'::json),
  'voiceCaptures', COALESCE((
    SELECT json_agg(row_to_json(capture_rows) ORDER BY capture_rows."createdAt")
    FROM "VoiceCapture" capture_rows
    WHERE capture_rows."sessionId" = ${sqlText(sessionId)}
  ), '[]'::json),
  'latestReview', (
    SELECT json_build_object(
      'id', review_rows."id",
      'sessionId', review_rows."sessionId"
    )
    FROM "ReviewReport" review_rows
    WHERE review_rows."sessionId" = ${sqlText(sessionId)}
    ORDER BY review_rows."createdAt" DESC
    LIMIT 1
  ),
  'detectedWeaknesses', COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', weakness_rows."id",
        'title', weakness_rows."title",
        'status', weakness_rows."status"
      )
      ORDER BY weakness_rows."createdAt" DESC
    )
    FROM "Weakness" weakness_rows
    WHERE weakness_rows."sessionId" = ${sqlText(sessionId)}
  ), '[]'::json),
  'deepDiveRefs', COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', deep_dive_rows."id",
        'weaknessId', deep_dive_rows."weaknessId",
        'title', deep_dive_rows."title"
      )
      ORDER BY deep_dive_rows."createdAt" DESC
    )
    FROM "DeepDive" deep_dive_rows
    LEFT JOIN "Weakness" weakness_rows ON weakness_rows."id" = deep_dive_rows."weaknessId"
    WHERE weakness_rows."sessionId" = ${sqlText(sessionId)}
  ), '[]'::json)
)::text;`;
}

function updateSessionSql(sessionId: string, patch: Partial<TrainingSessionRecord>) {
  const sets = [
    patch.currentPhase !== undefined ? `"currentPhase" = ${sqlText(patch.currentPhase)}` : null,
    patch.currentSlideId !== undefined ? `"currentSlideId" = ${sqlText(patch.currentSlideId ?? null)}` : null,
    patch.currentSlideIndex !== undefined ? `"currentSlideIndex" = ${sqlNumber(patch.currentSlideIndex)}` : null,
    patch.currentKnowledgeNodeId !== undefined ? `"currentKnowledgeNodeId" = ${sqlText(patch.currentKnowledgeNodeId ?? null)}` : null,
    patch.focusKnowledgeNodeIds !== undefined ? `"focusKnowledgeNodeIds" = ${sqlJson(patch.focusKnowledgeNodeIds)}` : null,
    patch.completedSlideIds !== undefined ? `"completedSlideIds" = ${sqlJson(patch.completedSlideIds)}` : null,
    patch.currentFollowupCount !== undefined ? `"currentFollowupCount" = ${sqlNumber(patch.currentFollowupCount)}` : null,
    patch.finalQuestionIndex !== undefined ? `"finalQuestionIndex" = ${sqlNumber(patch.finalQuestionIndex)}` : null,
    patch.status !== undefined ? `"status" = ${sqlText(patch.status)}` : null,
    patch.voiceState !== undefined ? `"voiceState" = ${sqlText(patch.voiceState)}` : null,
    patch.hintCount !== undefined ? `"hintCount" = ${sqlNumber(patch.hintCount)}` : null,
    patch.followUpCount !== undefined ? `"followUpCount" = ${sqlNumber(patch.followUpCount)}` : null,
    patch.detectedWeaknesses !== undefined ? `"detectedWeaknesses" = ${sqlJson(patch.detectedWeaknesses)}` : null,
    patch.lastRetrievedSources !== undefined ? `"lastRetrievedSources" = ${sqlJson(patch.lastRetrievedSources)}` : null,
    patch.shouldFinish !== undefined ? `"shouldFinish" = ${patch.shouldFinish ? "true" : "false"}` : null,
    patch.lastPhaseAt !== undefined ? `"lastPhaseAt" = ${sqlTimestamp(patch.lastPhaseAt)}` : null,
    patch.finishedAt !== undefined ? `"finishedAt" = ${sqlTimestamp(patch.finishedAt ?? null)}` : null,
    `"updatedAt" = now()`,
  ].filter(Boolean);

  return `
UPDATE "TrainingSession"
SET ${sets.join(",\n    ")}
WHERE "id" = ${sqlText(sessionId)};`;
}

function readLatestCompatibilitySessionSql(projectId: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(session_rows)
  FROM "TrainingSession" session_rows
  WHERE session_rows."projectId" = ${sqlText(projectId)}
    AND session_rows."status" = 'active'
    AND session_rows."difficulty" = 'compat'
  ORDER BY session_rows."updatedAt" DESC
  LIMIT 1
), 'null'::json)::text;`;
}
