import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlText, sqlTimestamp } from "../sql.ts";

export type TrainingFocusRecord = {
  id: string;
  projectId: string;
  knowledgeNodeId: string;
  createdAt: string;
  updatedAt: string;
};

export type TrainingFocusInput = {
  projectId: string;
  knowledgeNodeId: string;
  createdAt?: string;
};

export function createTrainingFocusRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async listByProject(projectId: string) {
      return helpers.readJson<TrainingFocusRecord[]>(listTrainingFocusesSql(projectId), []);
    },

    async upsertFocus(input: TrainingFocusInput) {
      const createdAt = input.createdAt ?? new Date().toISOString();
      const focus: TrainingFocusRecord = {
        id: trainingFocusId(input.projectId, input.knowledgeNodeId),
        projectId: input.projectId,
        knowledgeNodeId: input.knowledgeNodeId,
        createdAt,
        updatedAt: createdAt,
      };
      await helpers.run(upsertTrainingFocusSql(focus));
      return focus;
    },

    async deleteFocus(projectId: string, knowledgeNodeId: string) {
      await helpers.run(deleteTrainingFocusSql(projectId, knowledgeNodeId));
      return { projectId, knowledgeNodeId };
    },
  };
}

function trainingFocusId(projectId: string, knowledgeNodeId: string) {
  return `focus-${projectId}-${knowledgeNodeId}`;
}

function listTrainingFocusesSql(projectId: string) {
  return `
SELECT COALESCE((
  SELECT json_agg(row_to_json(focus_rows) ORDER BY focus_rows."updatedAt" DESC)
  FROM "KnowledgeTrainingFocus" focus_rows
  WHERE focus_rows."projectId" = ${sqlText(projectId)}
), '[]'::json)::text;`;
}

function upsertTrainingFocusSql(focus: TrainingFocusRecord) {
  return `
INSERT INTO "KnowledgeTrainingFocus" (
  "id", "projectId", "knowledgeNodeId", "createdAt", "updatedAt"
) VALUES (
  ${sqlText(focus.id)},
  ${sqlText(focus.projectId)},
  ${sqlText(focus.knowledgeNodeId)},
  ${sqlTimestamp(focus.createdAt)},
  ${sqlTimestamp(focus.updatedAt)}
)
ON CONFLICT ("projectId", "knowledgeNodeId") DO UPDATE SET
  "updatedAt" = EXCLUDED."updatedAt";`;
}

function deleteTrainingFocusSql(projectId: string, knowledgeNodeId: string) {
  return `
DELETE FROM "KnowledgeTrainingFocus"
WHERE "projectId" = ${sqlText(projectId)}
  AND "knowledgeNodeId" = ${sqlText(knowledgeNodeId)};`;
}
