import type { JobRunKind, JobRunRecord } from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlText, sqlTimestamp } from "../sql.ts";

export type JobRunSqlRunner = PsqlRunner;

export function createJobRunRepository(runSql: JobRunSqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async read(id: string) {
      return helpers.readJson<JobRunRecord | null>(
        `
SELECT COALESCE((
  SELECT row_to_json(job_rows)
  FROM "JobRun" job_rows
  WHERE job_rows."id" = ${sqlText(id)}
  LIMIT 1
), 'null'::json)::text;`,
        null,
      );
    },

    async list(projectId: string) {
      return helpers.readJson<JobRunRecord[]>(
        `
SELECT COALESCE(
  json_agg(row_to_json(job_rows) ORDER BY job_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "JobRun" job_rows
WHERE job_rows."projectId" = ${sqlText(projectId)};`,
        [],
      );
    },

    async claimNext(options?: {
      kinds?: JobRunKind[];
      fileKinds?: string[];
      excludeFileKinds?: string[];
    }) {
      return helpers.readJson<JobRunRecord | null>(claimNextSql(options), null);
    },

    create(job: JobRunRecord) {
      return runSql(`
INSERT INTO "JobRun" (
  "id", "projectId", "kind", "status", "payload", "error", "result",
  "createdAt", "updatedAt", "startedAt", "completedAt"
) VALUES (
  ${sqlText(job.id)},
  ${sqlText(job.projectId)},
  ${sqlText(job.kind)},
  ${sqlText(job.status)},
  ${sqlJson(job.payload)},
  ${sqlText(job.error)},
  ${sqlJson(job.result ?? null)},
  ${sqlTimestamp(job.createdAt)},
  ${sqlTimestamp(job.updatedAt)},
  ${sqlTimestamp(job.startedAt)},
  ${sqlTimestamp(job.completedAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "status" = EXCLUDED."status",
  "payload" = EXCLUDED."payload",
  "error" = EXCLUDED."error",
  "result" = EXCLUDED."result",
  "updatedAt" = EXCLUDED."updatedAt",
  "startedAt" = EXCLUDED."startedAt",
  "completedAt" = EXCLUDED."completedAt";`);
    },

    markRunning(id: string, startedAt: string) {
      return runSql(`
UPDATE "JobRun"
SET
  "status" = 'running',
  "startedAt" = ${sqlTimestamp(startedAt)},
  "updatedAt" = ${sqlTimestamp(startedAt)}
WHERE "id" = ${sqlText(id)};`);
    },

    markSucceeded(id: string, completedAt: string, result?: Record<string, unknown>) {
      return runSql(`
UPDATE "JobRun"
SET
  "status" = 'succeeded',
  "result" = ${sqlJson(result ?? {})},
  "completedAt" = ${sqlTimestamp(completedAt)},
  "updatedAt" = ${sqlTimestamp(completedAt)}
WHERE "id" = ${sqlText(id)};`);
    },

    markFailed(id: string, completedAt: string, error: string, retryable = false) {
      return runSql(`
UPDATE "JobRun"
SET
  "status" = ${sqlText(retryable ? "retryable" : "failed")},
  "error" = ${sqlText(error)},
  "completedAt" = ${sqlTimestamp(completedAt)},
  "updatedAt" = ${sqlTimestamp(completedAt)}
WHERE "id" = ${sqlText(id)};`);
    },
  };
}

function claimNextSql(options?: {
  kinds?: JobRunKind[];
  fileKinds?: string[];
  excludeFileKinds?: string[];
}) {
  const filters = [
    `"status" IN ('queued', 'retryable')`,
    options?.kinds?.length ? `"kind" IN (${options.kinds.map((kind) => sqlText(kind)).join(", ")})` : null,
    options?.fileKinds?.length
      ? `COALESCE("payload"->>'kind', '') IN (${options.fileKinds.map((kind) => sqlText(kind)).join(", ")})`
      : null,
    options?.excludeFileKinds?.length
      ? `COALESCE("payload"->>'kind', '') NOT IN (${options.excludeFileKinds.map((kind) => sqlText(kind)).join(", ")})`
      : null,
  ].filter(Boolean);

  return `
WITH next_job AS (
  SELECT "id"
  FROM "JobRun"
  WHERE ${filters.join("\n    AND ")}
  ORDER BY "createdAt" ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
),
claimed_job AS (
  UPDATE "JobRun"
  SET
    "status" = 'running',
    "startedAt" = now(),
    "updatedAt" = now(),
    "error" = NULL
  WHERE "id" IN (SELECT "id" FROM next_job)
  RETURNING *
)
SELECT COALESCE((
  SELECT row_to_json(claimed_job)
  FROM claimed_job
), 'null'::json)::text;`;
}
