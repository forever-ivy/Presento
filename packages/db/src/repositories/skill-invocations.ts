import type { SkillInvocationRecord } from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlBoolean, sqlJson, sqlNumber, sqlText, sqlTimestamp } from "../sql.ts";

export type SkillFeedbackRecord = {
  id: string;
  projectId: string;
  invocationId: string;
  rating: string;
  comment?: string | null;
  createdAt: string;
  syncedAt?: string | null;
};

export type SkillInvocationDetails = {
  invocation: SkillInvocationRecord | null;
  feedbacks: SkillFeedbackRecord[];
};

export function createSkillInvocationRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async write(invocation: SkillInvocationRecord) {
      await helpers.run(writeInvocationSql(invocation));
      return invocation;
    },

    async list(projectId: string, limit = 20) {
      return helpers.readJson<SkillInvocationRecord[]>(readInvocationsSql(projectId, limit), []);
    },

    async read(projectId: string, invocationId: string) {
      return helpers.readJson<SkillInvocationDetails>(
        readInvocationSql(projectId, invocationId),
        { invocation: null, feedbacks: [] },
      );
    },

    async writeFeedback(feedback: SkillFeedbackRecord) {
      await helpers.run(writeFeedbackSql(feedback));
      return feedback;
    },

    async markFeedbackSynced(invocationId: string, syncedAt: string) {
      await helpers.run(markFeedbackSyncedSql(invocationId, syncedAt));
    },
  };
}

function writeInvocationSql(invocation: SkillInvocationRecord) {
  return `
INSERT INTO "SkillInvocation" (
  "id", "projectId", "skillName", "skillVersion", "trigger", "resolvedBy", "status", "input", "output",
  "error", "traceId", "langfuseTraceId", "langfuseObservationId", "usedFallback", "retrievalSummary",
  "toolCalls", "outputSummary", "feedbackStatus", "startedAt", "completedAt", "durationMs"
) VALUES (
  ${sqlText(invocation.id)},
  ${sqlText(invocation.projectId)},
  ${sqlText(invocation.skillName)},
  ${sqlText(invocation.skillVersion)},
  ${sqlText(invocation.trigger)},
  ${sqlText(invocation.resolvedBy)},
  ${sqlText(invocation.status)},
  ${sqlJson(invocation.input)},
  ${sqlJson(invocation.output)},
  ${sqlText(invocation.error ?? null)},
  ${sqlText(invocation.traceId ?? null)},
  ${sqlText(invocation.langfuseTraceId ?? null)},
  ${sqlText(invocation.langfuseObservationId ?? null)},
  ${sqlBoolean(invocation.usedFallback)},
  ${sqlJson(invocation.retrievalSummary ?? null)},
  ${sqlJson(invocation.toolCalls)},
  ${sqlJson(invocation.outputSummary ?? null)},
  ${sqlText(invocation.feedbackStatus)},
  ${sqlTimestamp(invocation.startedAt)},
  ${sqlTimestamp(invocation.completedAt)},
  ${sqlNumber(invocation.durationMs)}
)
ON CONFLICT ("id") DO UPDATE SET
  "skillName" = EXCLUDED."skillName",
  "skillVersion" = EXCLUDED."skillVersion",
  "trigger" = EXCLUDED."trigger",
  "resolvedBy" = EXCLUDED."resolvedBy",
  "status" = EXCLUDED."status",
  "input" = EXCLUDED."input",
  "output" = EXCLUDED."output",
  "error" = EXCLUDED."error",
  "traceId" = EXCLUDED."traceId",
  "langfuseTraceId" = EXCLUDED."langfuseTraceId",
  "langfuseObservationId" = EXCLUDED."langfuseObservationId",
  "usedFallback" = EXCLUDED."usedFallback",
  "retrievalSummary" = EXCLUDED."retrievalSummary",
  "toolCalls" = EXCLUDED."toolCalls",
  "outputSummary" = EXCLUDED."outputSummary",
  "feedbackStatus" = EXCLUDED."feedbackStatus",
  "startedAt" = EXCLUDED."startedAt",
  "completedAt" = EXCLUDED."completedAt",
  "durationMs" = EXCLUDED."durationMs";`;
}

function readInvocationsSql(projectId: string, limit: number) {
  return `
SELECT COALESCE(
  json_agg(row_to_json(invocation_rows) ORDER BY invocation_rows."startedAt" DESC),
  '[]'::json
)::text
FROM (
  SELECT *
  FROM "SkillInvocation"
  WHERE "projectId" = ${sqlText(projectId)}
  ORDER BY "startedAt" DESC
  LIMIT ${sqlNumber(limit)}
) invocation_rows;`;
}

function readInvocationSql(projectId: string, invocationId: string) {
  return `
SELECT json_build_object(
  'invocation', (
    SELECT row_to_json(invocation_row)
    FROM (
      SELECT *
      FROM "SkillInvocation"
      WHERE "projectId" = ${sqlText(projectId)}
        AND "id" = ${sqlText(invocationId)}
      LIMIT 1
    ) invocation_row
  ),
  'feedbacks', COALESCE((
    SELECT json_agg(row_to_json(feedback_rows) ORDER BY feedback_rows."createdAt" DESC)
    FROM (
      SELECT *
      FROM "SkillFeedback"
      WHERE "projectId" = ${sqlText(projectId)}
        AND "invocationId" = ${sqlText(invocationId)}
    ) feedback_rows
  ), '[]'::json)
)::text;`;
}

function writeFeedbackSql(feedback: SkillFeedbackRecord) {
  return `
INSERT INTO "SkillFeedback" (
  "id", "projectId", "invocationId", "rating", "comment", "createdAt", "syncedAt"
) VALUES (
  ${sqlText(feedback.id)},
  ${sqlText(feedback.projectId)},
  ${sqlText(feedback.invocationId)},
  ${sqlText(feedback.rating)},
  ${sqlText(feedback.comment ?? null)},
  ${sqlTimestamp(feedback.createdAt)},
  ${sqlTimestamp(feedback.syncedAt ?? null)}
)
ON CONFLICT ("id") DO UPDATE SET
  "rating" = EXCLUDED."rating",
  "comment" = EXCLUDED."comment",
  "syncedAt" = EXCLUDED."syncedAt";

UPDATE "SkillInvocation"
SET "feedbackStatus" = 'received'
WHERE "id" = ${sqlText(feedback.invocationId)};`;
}

function markFeedbackSyncedSql(invocationId: string, syncedAt: string) {
  return `
UPDATE "SkillFeedback"
SET "syncedAt" = ${sqlTimestamp(syncedAt)}
WHERE "invocationId" = ${sqlText(invocationId)};

UPDATE "SkillInvocation"
SET "feedbackStatus" = 'synced'
WHERE "id" = ${sqlText(invocationId)};`;
}
