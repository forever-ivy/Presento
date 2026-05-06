import type { ProjectWorkspaceDto } from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlText, sqlTimestamp } from "../sql.ts";

export type ProjectRecord = ProjectWorkspaceDto["project"];

export function createProjectRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async list() {
      return helpers.readJson<ProjectRecord[]>(listProjectsSql(), []);
    },

    async read(projectId: string) {
      return helpers.readJson<ProjectRecord | null>(readProjectSql(projectId), null);
    },

    async create(project: ProjectRecord) {
      await helpers.run(writeProjectSql(project));
      return project;
    },

    async update(projectId: string, patch: Partial<Omit<ProjectRecord, "id">>) {
      await helpers.run(updateProjectSql(projectId, patch));
      return this.read(projectId);
    },

    async remove(projectId: string) {
      await helpers.run(`DELETE FROM "Project" WHERE "id" = ${sqlText(projectId)};`);
    },

    async readWorkspace(projectId: string) {
      return helpers.readJson<ProjectWorkspaceDto | null>(readWorkspaceSql(projectId), null);
    },
  };
}

function listProjectsSql() {
  return `
SELECT COALESCE(
  json_agg(
    json_build_object(
      'id', "id",
      'name', "name",
      'category', "category",
      'ownerScope', "ownerScope",
      'teammateScope', "teammateScope",
      'deadlineAt', row_to_json("Project")->'deadlineAt',
      'createdAt', to_json("createdAt"),
      'updatedAt', to_json("updatedAt"),
      'fileCount', COALESCE((
        SELECT count(*)
        FROM "FileAsset" file_rows
        WHERE file_rows."projectId" = "Project"."id"
      ), 0),
      'trainingSessionCount', COALESCE((
        SELECT count(*)
        FROM "TrainingSession" training_rows
        WHERE training_rows."projectId" = "Project"."id"
      ), 0)
    )
    ORDER BY "updatedAt" DESC, "createdAt" DESC
  ),
  '[]'::json
)::text
FROM "Project";
`;
}

function readProjectSql(projectId: string) {
  return `
SELECT COALESCE((
  SELECT json_build_object(
    'id', "id",
    'name', "name",
    'category', "category",
    'ownerScope', "ownerScope",
    'teammateScope', "teammateScope",
    'deadlineAt', row_to_json("Project")->'deadlineAt',
    'createdAt', to_json("createdAt"),
    'updatedAt', to_json("updatedAt")
  )
  FROM "Project"
  WHERE "id" = ${sqlText(projectId)}
), 'null'::json)::text;
`;
}

function writeProjectSql(project: ProjectRecord) {
  return `
INSERT INTO "Project" (
  "id", "name", "category", "ownerScope", "teammateScope", "deadlineAt", "createdAt", "updatedAt"
) VALUES (
  ${sqlText(project.id)},
  ${sqlText(project.name)},
  ${sqlText(project.category)},
  ${sqlText(project.ownerScope)},
  ${sqlText(project.teammateScope)},
  ${sqlTimestamp(project.deadlineAt)},
  ${sqlTimestamp(project.createdAt)},
  ${sqlTimestamp(project.updatedAt ?? project.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "ownerScope" = EXCLUDED."ownerScope",
  "teammateScope" = EXCLUDED."teammateScope",
  "deadlineAt" = EXCLUDED."deadlineAt",
  "updatedAt" = EXCLUDED."updatedAt";`;
}

function updateProjectSql(projectId: string, patch: Partial<Omit<ProjectRecord, "id">>) {
  const sets = [
    patch.name !== undefined ? `"name" = ${sqlText(patch.name)}` : null,
    patch.category !== undefined ? `"category" = ${sqlText(patch.category)}` : null,
    patch.ownerScope !== undefined ? `"ownerScope" = ${sqlText(patch.ownerScope)}` : null,
    patch.teammateScope !== undefined ? `"teammateScope" = ${sqlText(patch.teammateScope)}` : null,
    patch.deadlineAt !== undefined ? `"deadlineAt" = ${sqlTimestamp(patch.deadlineAt)}` : null,
    `"updatedAt" = now()`,
  ].filter(Boolean);

  return `
UPDATE "Project"
SET ${sets.join(",\n    ")}
WHERE "id" = ${sqlText(projectId)};`;
}

function readWorkspaceSql(projectId: string) {
  return `
WITH target_project AS (
  SELECT *
  FROM "Project"
  WHERE "id" = ${sqlText(projectId)}
  LIMIT 1
)
SELECT COALESCE((
  SELECT json_build_object(
    'project', json_build_object(
      'id', target_project."id",
      'name', target_project."name",
      'category', target_project."category",
      'ownerScope', target_project."ownerScope",
      'teammateScope', target_project."teammateScope",
      'deadlineAt', row_to_json(target_project)->'deadlineAt',
      'createdAt', to_json(target_project."createdAt"),
      'updatedAt', to_json(target_project."updatedAt")
    ),
    'files', COALESCE((
      SELECT json_agg(row_to_json(file_rows) ORDER BY file_rows."addedAt")
      FROM "FileAsset" file_rows
      WHERE file_rows."projectId" = target_project."id"
    ), '[]'::json),
    'processingTasks', COALESCE((
      SELECT json_agg(row_to_json(task_rows) ORDER BY task_rows."createdAt")
      FROM "ProcessingTask" task_rows
      WHERE task_rows."projectId" = target_project."id"
    ), '[]'::json),
    'artifacts', COALESCE((
      SELECT json_agg(row_to_json(artifact_rows) ORDER BY artifact_rows."createdAt")
      FROM "Artifact" artifact_rows
      WHERE artifact_rows."projectId" = target_project."id"
    ), '[]'::json),
    'jobRuns', COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', job_rows."id",
          'projectId', job_rows."projectId",
          'kind', job_rows."kind",
          'status', job_rows."status",
          'payload', job_rows."payload",
          'error', job_rows."error",
          'result', job_rows."result",
          'createdAt', to_json(job_rows."createdAt"),
          'updatedAt', to_json(job_rows."updatedAt"),
          'startedAt', to_json(job_rows."startedAt"),
          'completedAt', to_json(job_rows."completedAt")
        )
        ORDER BY job_rows."createdAt" DESC
      )
      FROM "JobRun" job_rows
      WHERE job_rows."projectId" = target_project."id"
    ), '[]'::json),
    'trainingSessionCount', COALESCE((
      SELECT count(*)
      FROM "TrainingSession" training_rows
      WHERE training_rows."projectId" = target_project."id"
    ), 0),
    'latestReview', (
      SELECT json_build_object(
        'id', review_rows."id",
        'averageScore', review_rows."averageScore",
        'scoreLabel', review_rows."scoreLabel",
        'createdAt', to_json(review_rows."createdAt")
      )
      FROM "ReviewReport" review_rows
      WHERE review_rows."projectId" = target_project."id"
      ORDER BY review_rows."createdAt" DESC
      LIMIT 1
    )
  )
  FROM target_project
), 'null'::json)::text;
`;
}
