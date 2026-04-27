import type { JobRunRecord, ProjectWorkspaceDto } from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlNumber, sqlText, sqlTimestamp } from "../sql.ts";

export type FileRecord = ProjectWorkspaceDto["files"][number];
export type ProcessingTaskRecord = ProjectWorkspaceDto["processingTasks"][number];
export type PersistedFileRecord = FileRecord & { projectId: string };
export type PersistedTaskRecord = ProcessingTaskRecord & { projectId: string };

export function createFileRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async list(projectId: string) {
      return helpers.readJson<FileRecord[]>(listFilesSql(projectId), []);
    },

    async read(projectId: string, fileId: string) {
      return helpers.readJson<FileRecord | null>(readFileSql(projectId, fileId), null);
    },

    async readTask(taskId: string) {
      return helpers.readJson<ProcessingTaskRecord | null>(readTaskSql(taskId), null);
    },

    async createBatch({
      files,
      processingTasks,
      jobRuns,
    }: {
      files: PersistedFileRecord[];
      processingTasks?: PersistedTaskRecord[];
      jobRuns?: JobRunRecord[];
    }) {
      const statements = [
        "BEGIN;",
        insertFilesSql(files),
        insertProcessingTasksSql(processingTasks ?? []),
        insertJobRunsSql(jobRuns ?? []),
        "COMMIT;",
      ].filter(Boolean);

      await helpers.run(statements.join("\n"));
      return { files, processingTasks: processingTasks ?? [], jobRuns: jobRuns ?? [] };
    },

    async updateTask(taskId: string, patch: Partial<ProcessingTaskRecord>) {
      await helpers.run(updateTaskSql(taskId, patch));
      return this.readTask(taskId);
    },
  };
}

function listFilesSql(projectId: string) {
  return `
SELECT COALESCE(
  json_agg(row_to_json(file_rows) ORDER BY file_rows."addedAt" DESC),
  '[]'::json
)::text
FROM "FileAsset" file_rows
WHERE file_rows."projectId" = ${sqlText(projectId)};`;
}

function readTaskSql(taskId: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(task_rows)
  FROM "ProcessingTask" task_rows
  WHERE task_rows."id" = ${sqlText(taskId)}
  LIMIT 1
), 'null'::json)::text;`;
}

function readFileSql(projectId: string, fileId: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(file_rows)
  FROM "FileAsset" file_rows
  WHERE file_rows."projectId" = ${sqlText(projectId)}
    AND file_rows."id" = ${sqlText(fileId)}
  LIMIT 1
), 'null'::json)::text;`;
}

function insertFilesSql(files: PersistedFileRecord[]) {
  if (files.length === 0) return "";
  return `
INSERT INTO "FileAsset" (
  "id", "projectId", "name", "size", "mimeType", "kind", "status", "source",
  "storedName", "storagePath", "uploadedAt", "uploadStatus", "addedAt"
) VALUES
${files
  .map(
    (file) => `(
  ${sqlText(file.id)},
  ${sqlText(file.projectId)},
  ${sqlText(file.name)},
  ${sqlNumber(file.size)},
  ${sqlText(file.mimeType)},
  ${sqlText(file.kind)},
  ${sqlText(file.status)},
  ${sqlText(file.source)},
  ${sqlText(file.storedName)},
  ${sqlText(file.storagePath)},
  ${sqlTimestamp(file.uploadedAt ?? null)},
  ${sqlText(file.uploadStatus)},
  ${sqlTimestamp(file.addedAt)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "size" = EXCLUDED."size",
  "mimeType" = EXCLUDED."mimeType",
  "kind" = EXCLUDED."kind",
  "status" = EXCLUDED."status",
  "source" = EXCLUDED."source",
  "storedName" = EXCLUDED."storedName",
  "storagePath" = EXCLUDED."storagePath",
  "uploadedAt" = EXCLUDED."uploadedAt",
  "uploadStatus" = EXCLUDED."uploadStatus";`;
}

function insertProcessingTasksSql(tasks: PersistedTaskRecord[]) {
  if (tasks.length === 0) return "";
  return `
INSERT INTO "ProcessingTask" (
  "id", "projectId", "fileId", "fileName", "kind", "title", "engine", "status",
  "progress", "createdAt", "startedAt", "completedAt", "error", "artifactId"
) VALUES
${tasks
  .map(
    (task) => `(
  ${sqlText(task.id)},
  ${sqlText(task.projectId)},
  ${sqlText(task.fileId)},
  ${sqlText(task.fileName)},
  ${sqlText(task.kind)},
  ${sqlText(task.title)},
  ${sqlText(task.engine)},
  ${sqlText(task.status)},
  ${sqlNumber(task.progress)},
  ${sqlTimestamp(task.createdAt)},
  ${sqlTimestamp(task.startedAt ?? null)},
  ${sqlTimestamp(task.completedAt ?? null)},
  ${sqlText(task.error ?? null)},
  ${sqlText(task.artifactId ?? null)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "progress" = EXCLUDED."progress",
  "startedAt" = EXCLUDED."startedAt",
  "completedAt" = EXCLUDED."completedAt",
  "error" = EXCLUDED."error",
  "artifactId" = EXCLUDED."artifactId";`;
}

function insertJobRunsSql(jobRuns: JobRunRecord[]) {
  if (jobRuns.length === 0) return "";
  return `
INSERT INTO "JobRun" (
  "id", "projectId", "kind", "status", "payload", "error", "result",
  "createdAt", "updatedAt", "startedAt", "completedAt"
) VALUES
${jobRuns
  .map(
    (job) => `(
  ${sqlText(job.id)},
  ${sqlText(job.projectId)},
  ${sqlText(job.kind)},
  ${sqlText(job.status)},
  ${sqlText(JSON.stringify(job.payload))}::jsonb,
  ${sqlText(job.error ?? null)},
  ${sqlText(JSON.stringify(job.result ?? null))}::jsonb,
  ${sqlTimestamp(job.createdAt)},
  ${sqlTimestamp(job.updatedAt)},
  ${sqlTimestamp(job.startedAt ?? null)},
  ${sqlTimestamp(job.completedAt ?? null)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "payload" = EXCLUDED."payload",
  "error" = EXCLUDED."error",
  "result" = EXCLUDED."result",
  "updatedAt" = EXCLUDED."updatedAt",
  "startedAt" = EXCLUDED."startedAt",
  "completedAt" = EXCLUDED."completedAt";`;
}

function updateTaskSql(taskId: string, patch: Partial<ProcessingTaskRecord>) {
  const sets = [
    patch.status !== undefined ? `"status" = ${sqlText(patch.status)}` : null,
    patch.progress !== undefined ? `"progress" = ${sqlNumber(patch.progress)}` : null,
    patch.startedAt !== undefined ? `"startedAt" = ${sqlTimestamp(patch.startedAt)}` : null,
    patch.completedAt !== undefined ? `"completedAt" = ${sqlTimestamp(patch.completedAt)}` : null,
    patch.error !== undefined ? `"error" = ${sqlText(patch.error)}` : null,
    patch.artifactId !== undefined ? `"artifactId" = ${sqlText(patch.artifactId)}` : null,
  ].filter(Boolean);

  return `
UPDATE "ProcessingTask"
SET ${sets.join(",\n    ")}
WHERE "id" = ${sqlText(taskId)};`;
}
