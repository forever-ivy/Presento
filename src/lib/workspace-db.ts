import { execFile } from "node:child_process";
import type { DefenseWorkspace } from "./project-workspace.ts";
import {
  type DatabaseArtifactRow,
  type DatabaseFileRow,
  type DatabaseProcessingTaskRow,
  type DatabaseProjectRow,
  type DatabaseWorkspaceRows,
  workspaceFromDatabaseRows,
  workspaceToDatabaseRows,
} from "./workspace-db-mapper.ts";

export type PsqlRunner = (sql: string) => Promise<string>;

export function createWorkspaceDatabase(runPsql: PsqlRunner = runDockerComposePsql) {
  return {
    async readCurrentWorkspace() {
      const output = (await runPsql(readCurrentWorkspaceSql())).trim();
      if (!output) return null;

      return workspaceFromDatabaseRows(JSON.parse(output) as DatabaseWorkspaceRows);
    },

    async writeCurrentWorkspace(workspace: DefenseWorkspace) {
      await runPsql(writeCurrentWorkspaceSql(workspace));
      return workspace;
    },
  };
}

export async function readWorkspaceFromDatabase() {
  return createWorkspaceDatabase().readCurrentWorkspace();
}

export async function writeWorkspaceToDatabase(workspace: DefenseWorkspace) {
  return createWorkspaceDatabase().writeCurrentWorkspace(workspace);
}

function readCurrentWorkspaceSql() {
  return `
WITH latest_project AS (
  SELECT *
  FROM "Project"
  ORDER BY "updatedAt" DESC, "createdAt" DESC
  LIMIT 1
)
SELECT json_build_object(
  'project', row_to_json(latest_project),
  'files', COALESCE((
    SELECT json_agg(row_to_json(file_rows) ORDER BY file_rows."addedAt")
    FROM "FileAsset" file_rows
    WHERE file_rows."projectId" = latest_project."id"
  ), '[]'::json),
  'processingTasks', COALESCE((
    SELECT json_agg(row_to_json(task_rows) ORDER BY task_rows."createdAt")
    FROM "ProcessingTask" task_rows
    WHERE task_rows."projectId" = latest_project."id"
  ), '[]'::json),
  'artifacts', COALESCE((
    SELECT json_agg(row_to_json(artifact_rows) ORDER BY artifact_rows."createdAt")
    FROM "Artifact" artifact_rows
    WHERE artifact_rows."projectId" = latest_project."id"
  ), '[]'::json)
)::text
FROM latest_project;
`;
}

function writeCurrentWorkspaceSql(workspace: DefenseWorkspace) {
  const rows = workspaceToDatabaseRows(workspace);
  const statements = [
    "BEGIN;",
    `DELETE FROM "Project" WHERE "id" = ${sqlText(rows.project.id)};`,
    insertProjectSql(rows.project),
    insertFilesSql(rows.files),
    insertProcessingTasksSql(rows.processingTasks),
    insertArtifactsSql(rows.artifacts),
    "COMMIT;",
  ].filter(Boolean);

  return statements.join("\n");
}

function insertProjectSql(project: DatabaseProjectRow) {
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
  now()
);`;
}

function insertFilesSql(files: DatabaseFileRow[]) {
  if (files.length === 0) return "";

  return `
INSERT INTO "FileAsset" (
  "id", "projectId", "name", "size", "mimeType", "kind", "status", "source",
  "storedName", "storagePath", "storageKey", "uploadedAt", "uploadStatus", "addedAt"
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
  ${sqlText(file.storageKey)},
  ${sqlTimestamp(file.uploadedAt)},
  ${sqlText(file.uploadStatus)},
  ${sqlTimestamp(file.addedAt)}
)`,
  )
  .join(",\n")};`;
}

function insertProcessingTasksSql(tasks: DatabaseProcessingTaskRow[]) {
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
  ${sqlTimestamp(task.startedAt)},
  ${sqlTimestamp(task.completedAt)},
  ${sqlText(task.error)},
  ${sqlText(task.artifactId)}
)`,
  )
  .join(",\n")};`;
}

function insertArtifactsSql(artifacts: DatabaseArtifactRow[]) {
  if (artifacts.length === 0) return "";

  return `
INSERT INTO "Artifact" (
  "id", "projectId", "taskId", "fileId", "fileName", "kind", "title", "summary",
  "previewLines", "sourcePath", "createdAt"
) VALUES
${artifacts
  .map(
    (artifact) => `(
  ${sqlText(artifact.id)},
  ${sqlText(artifact.projectId)},
  ${sqlText(artifact.taskId)},
  ${sqlText(artifact.fileId)},
  ${sqlText(artifact.fileName)},
  ${sqlText(artifact.kind)},
  ${sqlText(artifact.title)},
  ${sqlText(artifact.summary)},
  ${sqlJson(artifact.previewLines)},
  ${sqlText(artifact.sourcePath)},
  ${sqlTimestamp(artifact.createdAt)}
)`,
  )
  .join(",\n")};`;
}

function sqlText(value: string | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlTimestamp(value: string | null | undefined) {
  if (!value) return "NULL";
  return `${sqlText(value)}::timestamptz`;
}

function sqlJson(value: unknown) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function sqlNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.trunc(value));
}

async function runDockerComposePsql(sql: string) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "defense",
        "-d",
        "defense_coach",
        "-tA",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}
