import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlText, sqlTimestamp } from "../sql.ts";

export type DeepDiveRecord = {
  id: string;
  projectId: string;
  weaknessId?: string | null;
  title: string;
  summary: string;
  checklist: unknown;
  citations: unknown;
  createdAt: string;
};

export function createDeepDiveRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async createMany(deepDives: DeepDiveRecord[]) {
      if (deepDives.length === 0) return [];
      await helpers.run(insertDeepDivesSql(deepDives));
      return deepDives;
    },

    async listByProject(projectId: string) {
      return helpers.readJson<DeepDiveRecord[]>(listDeepDivesByProjectSql(projectId), []);
    },

    async listBySession(projectId: string, sessionId: string) {
      return helpers.readJson<DeepDiveRecord[]>(listDeepDivesBySessionSql(projectId, sessionId), []);
    },
  };
}

function insertDeepDivesSql(deepDives: DeepDiveRecord[]) {
  return `
INSERT INTO "DeepDive" (
  "id", "projectId", "weaknessId", "title", "summary", "checklist", "citations", "createdAt"
) VALUES
${deepDives
  .map(
    (deepDive) => `(
  ${sqlText(deepDive.id)},
  ${sqlText(deepDive.projectId)},
  ${sqlText(deepDive.weaknessId ?? null)},
  ${sqlText(deepDive.title)},
  ${sqlText(deepDive.summary)},
  ${sqlJson(deepDive.checklist)},
  ${sqlJson(deepDive.citations)},
  ${sqlTimestamp(deepDive.createdAt)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "weaknessId" = EXCLUDED."weaknessId",
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "checklist" = EXCLUDED."checklist",
  "citations" = EXCLUDED."citations";`;
}

function listDeepDivesByProjectSql(projectId: string) {
  return `
SELECT COALESCE(
  json_agg(row_to_json(deep_dive_rows) ORDER BY deep_dive_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "DeepDive" deep_dive_rows
WHERE deep_dive_rows."projectId" = ${sqlText(projectId)};`;
}

function listDeepDivesBySessionSql(projectId: string, sessionId: string) {
  return `
SELECT COALESCE(
  json_agg(row_to_json(deep_dive_rows) ORDER BY deep_dive_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "DeepDive" deep_dive_rows
LEFT JOIN "Weakness" weakness_rows ON weakness_rows."id" = deep_dive_rows."weaknessId"
WHERE deep_dive_rows."projectId" = ${sqlText(projectId)}
  AND weakness_rows."sessionId" = ${sqlText(sessionId)};`;
}
