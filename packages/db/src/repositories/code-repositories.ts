import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlText, sqlTimestamp } from "../sql.ts";
import type { CodeRepositorySourceRecord } from "../../../../src/lib/github-repository-source.ts";
import type { JobRunRecord } from "../../../shared/src/domain.ts";
import type { PersistedFileRecord, PersistedTaskRecord } from "./files.ts";
import { insertFilesSql, insertJobRunsSql, insertProcessingTasksSql } from "./files.ts";

export function createCodeRepositoryRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async create(repository: CodeRepositorySourceRecord) {
      await helpers.run(writeRepositorySql(repository));
      return repository;
    },

    async list(projectId: string) {
      return helpers.readJson<CodeRepositorySourceRecord[]>(listRepositoriesSql(projectId), []);
    },

    async read(id: string) {
      return helpers.readJson<CodeRepositorySourceRecord | null>(readRepositorySql(id), null);
    },

    async update(id: string, patch: Partial<CodeRepositorySourceRecord>) {
      await helpers.run(updateRepositorySql(id, patch));
      return this.read(id);
    },

    async createBatch({
      repository,
      fileBatch,
    }: {
      repository: CodeRepositorySourceRecord;
      fileBatch: {
        files: PersistedFileRecord[];
        processingTasks?: PersistedTaskRecord[];
        jobRuns?: JobRunRecord[];
      };
    }) {
      const statements = [
        "BEGIN;",
        insertFilesSql(fileBatch.files),
        insertProcessingTasksSql(fileBatch.processingTasks ?? []),
        insertJobRunsSql(fileBatch.jobRuns ?? []),
        writeRepositorySql(repository),
        "COMMIT;",
      ].filter(Boolean);

      await helpers.run(statements.join("\n"));
      return {
        repository,
        ...fileBatch,
      };
    },
  };
}

function writeRepositorySql(repository: CodeRepositorySourceRecord) {
  return `
INSERT INTO "CodeRepositorySource" (
  "id", "projectId", "fileId", "provider", "owner", "repo", "url", "visibility",
  "status", "parser", "defaultBranch", "latestCommitSha", "metadata", "createdAt", "updatedAt"
) VALUES (
  ${sqlText(repository.id)},
  ${sqlText(repository.projectId)},
  ${sqlText(repository.fileId)},
  ${sqlText(repository.provider)},
  ${sqlText(repository.owner)},
  ${sqlText(repository.repo)},
  ${sqlText(repository.url)},
  ${sqlText(repository.visibility)},
  ${sqlText(repository.status)},
  ${sqlText(repository.parser)},
  ${sqlText(repository.defaultBranch ?? null)},
  ${sqlText(repository.latestCommitSha ?? null)},
  ${sqlJson(repository.metadata)},
  ${sqlTimestamp(repository.createdAt)},
  ${sqlTimestamp(repository.updatedAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "parser" = EXCLUDED."parser",
  "defaultBranch" = EXCLUDED."defaultBranch",
  "latestCommitSha" = EXCLUDED."latestCommitSha",
  "metadata" = EXCLUDED."metadata",
  "updatedAt" = EXCLUDED."updatedAt";`;
}

function listRepositoriesSql(projectId: string) {
  return `
SELECT COALESCE(
  json_agg(row_to_json(repository_rows) ORDER BY repository_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "CodeRepositorySource" repository_rows
WHERE repository_rows."projectId" = ${sqlText(projectId)};`;
}

function readRepositorySql(id: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(repository_rows)
  FROM "CodeRepositorySource" repository_rows
  WHERE repository_rows."id" = ${sqlText(id)}
  LIMIT 1
), 'null'::json)::text;`;
}

function updateRepositorySql(id: string, patch: Partial<CodeRepositorySourceRecord>) {
  const sets = [
    patch.status !== undefined ? `"status" = ${sqlText(patch.status)}` : null,
    patch.parser !== undefined ? `"parser" = ${sqlText(patch.parser)}` : null,
    patch.defaultBranch !== undefined ? `"defaultBranch" = ${sqlText(patch.defaultBranch ?? null)}` : null,
    patch.latestCommitSha !== undefined ? `"latestCommitSha" = ${sqlText(patch.latestCommitSha ?? null)}` : null,
    patch.metadata !== undefined ? `"metadata" = ${sqlJson(patch.metadata)}` : null,
    `"updatedAt" = now()`,
  ].filter(Boolean);

  return `
UPDATE "CodeRepositorySource"
SET ${sets.join(",\n    ")}
WHERE "id" = ${sqlText(id)};`;
}
