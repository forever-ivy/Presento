import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlNumber, sqlText, sqlTimestamp } from "../sql.ts";

export type TrainingSessionRecord = {
  id: string;
  projectId: string;
  title: string;
  teacherRole: string;
  difficulty: string;
  currentSlideId?: string | null;
  currentKnowledgeNodeId?: string | null;
  status: string;
  voiceState: string;
  startedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TrainingTurnRecord = {
  id: string;
  sessionId: string;
  projectId: string;
  slideId?: string | null;
  knowledgeNodeId?: string | null;
  teacherRole: string;
  userAnswer: string;
  aiMessage: string;
  score?: number | null;
  strengths: unknown;
  risks: unknown;
  improvedAnswer?: string | null;
  followUps: unknown;
  citations: unknown;
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
      }>(
        readSessionSql(sessionId),
        { session: null, turns: [], voiceCaptures: [] },
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
  };
}

function writeSessionSql(session: TrainingSessionRecord) {
  return `
INSERT INTO "TrainingSession" (
  "id", "projectId", "title", "teacherRole", "difficulty", "currentSlideId",
  "currentKnowledgeNodeId", "status", "voiceState", "startedAt", "finishedAt",
  "createdAt", "updatedAt"
) VALUES (
  ${sqlText(session.id)},
  ${sqlText(session.projectId)},
  ${sqlText(session.title)},
  ${sqlText(session.teacherRole)},
  ${sqlText(session.difficulty)},
  ${sqlText(session.currentSlideId)},
  ${sqlText(session.currentKnowledgeNodeId)},
  ${sqlText(session.status)},
  ${sqlText(session.voiceState)},
  ${sqlTimestamp(session.startedAt)},
  ${sqlTimestamp(session.finishedAt)},
  ${sqlTimestamp(session.createdAt)},
  ${sqlTimestamp(session.updatedAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "teacherRole" = EXCLUDED."teacherRole",
  "difficulty" = EXCLUDED."difficulty",
  "currentSlideId" = EXCLUDED."currentSlideId",
  "currentKnowledgeNodeId" = EXCLUDED."currentKnowledgeNodeId",
  "status" = EXCLUDED."status",
  "voiceState" = EXCLUDED."voiceState",
  "startedAt" = EXCLUDED."startedAt",
  "finishedAt" = EXCLUDED."finishedAt",
  "updatedAt" = EXCLUDED."updatedAt";`;
}

function writeTurnSql(turn: TrainingTurnRecord) {
  return `
INSERT INTO "TrainingTurn" (
  "id", "sessionId", "projectId", "slideId", "knowledgeNodeId", "teacherRole",
  "userAnswer", "aiMessage", "score", "strengths", "risks", "improvedAnswer",
  "followUps", "citations", "createdAt"
) VALUES (
  ${sqlText(turn.id)},
  ${sqlText(turn.sessionId)},
  ${sqlText(turn.projectId)},
  ${sqlText(turn.slideId)},
  ${sqlText(turn.knowledgeNodeId)},
  ${sqlText(turn.teacherRole)},
  ${sqlText(turn.userAnswer)},
  ${sqlText(turn.aiMessage)},
  ${turn.score === null || turn.score === undefined ? "NULL" : sqlNumber(turn.score)},
  ${sqlJson(turn.strengths)},
  ${sqlJson(turn.risks)},
  ${sqlText(turn.improvedAnswer)},
  ${sqlJson(turn.followUps)},
  ${sqlJson(turn.citations)},
  ${sqlTimestamp(turn.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "teacherRole" = EXCLUDED."teacherRole",
  "userAnswer" = EXCLUDED."userAnswer",
  "aiMessage" = EXCLUDED."aiMessage",
  "score" = EXCLUDED."score",
  "strengths" = EXCLUDED."strengths",
  "risks" = EXCLUDED."risks",
  "improvedAnswer" = EXCLUDED."improvedAnswer",
  "followUps" = EXCLUDED."followUps",
  "citations" = EXCLUDED."citations";`;
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
  ), '[]'::json)
)::text;`;
}
