import type { SkillRecommendationRecord } from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlText, sqlTimestamp } from "../sql.ts";

export function createSkillRecommendationRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async create(record: SkillRecommendationRecord) {
      await helpers.run(writeRecommendationSql(record));
      return record;
    },

    async list(projectId: string, limit = 20) {
      return helpers.readJson<SkillRecommendationRecord[]>(readRecommendationsSql(projectId, limit), []);
    },
  };
}

function writeRecommendationSql(record: SkillRecommendationRecord) {
  return `
INSERT INTO "SkillRecommendationLog" (
  "id", "projectId", "requestedSkillId", "resolvedSkillId", "mode", "event", "reason", "context", "accepted", "createdAt"
) VALUES (
  ${sqlText(record.id)},
  ${sqlText(record.projectId)},
  ${sqlText(record.requestedSkillId ?? null)},
  ${sqlText(record.resolvedSkillId ?? null)},
  ${sqlText(record.mode)},
  ${sqlText(record.event)},
  ${sqlText(record.reason)},
  ${sqlJson(record.context)},
  ${record.accepted === null || record.accepted === undefined ? "NULL" : record.accepted ? "true" : "false"},
  ${sqlTimestamp(record.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "resolvedSkillId" = EXCLUDED."resolvedSkillId",
  "reason" = EXCLUDED."reason",
  "context" = EXCLUDED."context",
  "accepted" = EXCLUDED."accepted";`;
}

function readRecommendationsSql(projectId: string, limit: number) {
  return `
SELECT COALESCE(
  json_agg(row_to_json(log_rows) ORDER BY log_rows."createdAt" DESC),
  '[]'::json
)::text
FROM (
  SELECT *
  FROM "SkillRecommendationLog"
  WHERE "projectId" = ${sqlText(projectId)}
  ORDER BY "createdAt" DESC
  LIMIT ${limit}
) log_rows;`;
}
