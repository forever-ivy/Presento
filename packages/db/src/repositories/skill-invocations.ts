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

    async writeFeedback(feedback: SkillFeedbackRecord) {
      await helpers.run(writeFeedbackSql(feedback));
      return feedback;
    },
  };
}

function writeInvocationSql(invocation: SkillInvocationRecord) {
  return `
INSERT INTO "SkillInvocation" (
  "id", "projectId", "skillName", "trigger", "status", "input", "output",
  "error", "traceId", "usedFallback", "startedAt", "completedAt", "durationMs"
) VALUES (
  ${sqlText(invocation.id)},
  ${sqlText(invocation.projectId)},
  ${sqlText(invocation.skillName)},
  ${sqlText(invocation.trigger)},
  ${sqlText(invocation.status)},
  ${sqlJson(invocation.input)},
  ${sqlJson(invocation.output)},
  ${sqlText(invocation.error ?? null)},
  ${sqlText(invocation.traceId ?? null)},
  ${sqlBoolean(invocation.usedFallback)},
  ${sqlTimestamp(invocation.startedAt)},
  ${sqlTimestamp(invocation.completedAt)},
  ${sqlNumber(invocation.durationMs)}
)
ON CONFLICT ("id") DO UPDATE SET
  "skillName" = EXCLUDED."skillName",
  "trigger" = EXCLUDED."trigger",
  "status" = EXCLUDED."status",
  "input" = EXCLUDED."input",
  "output" = EXCLUDED."output",
  "error" = EXCLUDED."error",
  "traceId" = EXCLUDED."traceId",
  "usedFallback" = EXCLUDED."usedFallback",
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

function writeFeedbackSql(feedback: SkillFeedbackRecord) {
  return `
INSERT INTO "SkillFeedback" (
  "id", "projectId", "invocationId", "rating", "comment", "createdAt"
) VALUES (
  ${sqlText(feedback.id)},
  ${sqlText(feedback.projectId)},
  ${sqlText(feedback.invocationId)},
  ${sqlText(feedback.rating)},
  ${sqlText(feedback.comment ?? null)},
  ${sqlTimestamp(feedback.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "rating" = EXCLUDED."rating",
  "comment" = EXCLUDED."comment";`;
}
