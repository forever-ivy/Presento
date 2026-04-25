import type {
  DefenseFileKind,
  DefenseFileRecord,
  DefenseProcessingArtifact,
  DefenseProcessingTask,
  DefenseProject,
  DefenseWorkspace,
  ProcessingTaskStatus,
} from "./project-workspace";

export type DatabaseProjectRow = DefenseProject & {
  updatedAt?: string;
};

export type DatabaseFileRow = {
  id: string;
  projectId: string;
  name: string;
  size: number;
  mimeType: string | null;
  kind: DefenseFileKind;
  status: string;
  source: string;
  storedName: string | null;
  storagePath: string | null;
  uploadedAt: string | null;
  uploadStatus: "stored" | null;
  addedAt: string;
};

export type DatabaseProcessingTaskRow = {
  id: string;
  projectId: string;
  fileId: string;
  fileName: string;
  kind: DefenseFileKind;
  title: string;
  engine: string;
  status: ProcessingTaskStatus;
  progress: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  artifactId: string | null;
};

export type DatabaseArtifactRow = {
  id: string;
  projectId: string;
  taskId: string;
  fileId: string;
  fileName: string;
  kind: DefenseFileKind;
  title: string;
  summary: string;
  previewLines: string[];
  sourcePath: string | null;
  createdAt: string;
};

export type DatabaseWorkspaceRows = {
  project: DatabaseProjectRow;
  files: DatabaseFileRow[];
  processingTasks: DatabaseProcessingTaskRow[];
  artifacts: DatabaseArtifactRow[];
};

export function workspaceToDatabaseRows(workspace: DefenseWorkspace): DatabaseWorkspaceRows {
  const projectId = workspace.project.id;

  return {
    project: workspace.project,
    files: workspace.files.map((file) => ({
      id: file.id,
      projectId,
      name: file.name,
      size: file.size,
      mimeType: file.type ?? null,
      kind: file.kind,
      status: file.status,
      source: file.source,
      storedName: file.storedName ?? null,
      storagePath: file.storagePath ?? null,
      uploadedAt: file.uploadedAt ?? null,
      uploadStatus: file.uploadStatus ?? null,
      addedAt: file.addedAt,
    })),
    processingTasks: (workspace.processingTasks ?? []).map((task) => ({
      id: task.id,
      projectId,
      fileId: task.fileId,
      fileName: task.fileName,
      kind: task.kind,
      title: task.title,
      engine: task.engine,
      status: task.status,
      progress: task.progress,
      createdAt: task.createdAt,
      startedAt: task.startedAt ?? null,
      completedAt: task.completedAt ?? null,
      error: task.error ?? null,
      artifactId: task.artifactId ?? null,
    })),
    artifacts: (workspace.artifacts ?? []).map((artifact) => ({
      id: artifact.id,
      projectId,
      taskId: artifact.taskId,
      fileId: artifact.fileId,
      fileName: artifact.fileName,
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary,
      previewLines: artifact.previewLines,
      sourcePath: artifact.sourcePath ?? null,
      createdAt: artifact.createdAt,
    })),
  };
}

export function workspaceFromDatabaseRows(rows: DatabaseWorkspaceRows): DefenseWorkspace {
  return {
    project: {
      id: rows.project.id,
      name: rows.project.name,
      category: rows.project.category,
      ownerScope: rows.project.ownerScope,
      teammateScope: rows.project.teammateScope,
      createdAt: normalizeDateValue(rows.project.createdAt),
    },
    files: rows.files.map(fileFromDatabaseRow),
    processingTasks: rows.processingTasks.map(processingTaskFromDatabaseRow),
    artifacts: rows.artifacts.map(artifactFromDatabaseRow),
  };
}

function fileFromDatabaseRow(row: DatabaseFileRow): DefenseFileRecord {
  return omitUndefined({
    id: row.id,
    name: row.name,
    size: row.size,
    type: nullableToUndefined(row.mimeType),
    storedName: nullableToUndefined(row.storedName),
    storagePath: nullableToUndefined(row.storagePath),
    uploadedAt: nullableToUndefinedDate(row.uploadedAt),
    uploadStatus: nullableToUndefined(row.uploadStatus),
    kind: row.kind,
    status: row.status,
    source: row.source,
    addedAt: normalizeDateValue(row.addedAt),
  });
}

function processingTaskFromDatabaseRow(row: DatabaseProcessingTaskRow): DefenseProcessingTask {
  return omitUndefined({
    id: row.id,
    fileId: row.fileId,
    fileName: row.fileName,
    kind: row.kind,
    title: row.title,
    engine: row.engine,
    status: row.status,
    progress: row.progress,
    createdAt: normalizeDateValue(row.createdAt),
    startedAt: nullableToUndefinedDate(row.startedAt),
    completedAt: nullableToUndefinedDate(row.completedAt),
    error: nullableToUndefined(row.error),
    artifactId: nullableToUndefined(row.artifactId),
  });
}

function artifactFromDatabaseRow(row: DatabaseArtifactRow): DefenseProcessingArtifact {
  return omitUndefined({
    id: row.id,
    taskId: row.taskId,
    fileId: row.fileId,
    fileName: row.fileName,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    previewLines: row.previewLines,
    sourcePath: nullableToUndefined(row.sourcePath),
    createdAt: normalizeDateValue(row.createdAt),
  });
}

function nullableToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

function nullableToUndefinedDate(value: string | null) {
  if (value === null) return undefined;
  return normalizeDateValue(value);
}

function normalizeDateValue(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function omitUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}
