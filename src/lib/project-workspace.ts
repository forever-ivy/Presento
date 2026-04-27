export type DefenseFileKind =
  | "presentation"
  | "document"
  | "code"
  | "database"
  | "dataset"
  | "asset"
  | "other";

export type DefenseProject = {
  id: string;
  name: string;
  category: string;
  ownerScope: string;
  teammateScope: string;
  createdAt: string;
};

export type DefenseFileInput = {
  name: string;
  size: number;
  type?: string;
  storedName?: string;
  storagePath?: string;
  uploadedAt?: string;
  uploadStatus?: "stored";
};

export type DefenseFileRecord = DefenseFileInput & {
  id: string;
  kind: DefenseFileKind;
  status: string;
  source: string;
  addedAt: string;
};

export type ProcessingTaskStatus = "pending" | "processing" | "completed" | "failed";

export type DefenseProcessingTask = {
  id: string;
  fileId: string;
  fileName: string;
  kind: DefenseFileKind;
  title: string;
  engine: string;
  status: ProcessingTaskStatus;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  artifactId?: string;
};

export type DefenseProcessingArtifact = {
  id: string;
  taskId: string;
  fileId: string;
  fileName: string;
  kind: DefenseFileKind;
  title: string;
  summary: string;
  previewLines: string[];
  sourcePath?: string;
  createdAt: string;
};

export type DefenseWorkspace = {
  project: DefenseProject;
  files: DefenseFileRecord[];
  processingTasks: DefenseProcessingTask[];
  artifacts: DefenseProcessingArtifact[];
};

export type DefenseWorkspaceInput = {
  name: string;
  category: string;
  ownerScope: string;
  teammateScope: string;
  files?: DefenseFileInput[];
};

export type WorkspaceSummary = {
  fileCount: number;
  pendingTaskCount: number;
  processingTaskCount: number;
  completedTaskCount: number;
  hasPresentation: boolean;
  hasCode: boolean;
  hasDataOrDatabase: boolean;
  readiness: number;
};

export const workspaceStorageKey = "defense-coach.workspace.v1";
export const workspaceChangedEvent = "defense-coach.workspace.changed";

const extensionKindMap: Record<string, DefenseFileKind> = {
  pdf: "presentation",
  ppt: "presentation",
  pptx: "presentation",
  doc: "document",
  docx: "document",
  md: "document",
  txt: "document",
  zip: "code",
  sql: "database",
  csv: "dataset",
  xls: "dataset",
  xlsx: "dataset",
  json: "dataset",
  png: "asset",
  jpg: "asset",
  jpeg: "asset",
  webp: "asset",
};

export function classifyDefenseFile(fileName: string): DefenseFileKind {
  const normalized = fileName.trim().toLowerCase();
  const extension = normalized.split(".").pop() ?? "";

  if (normalized.includes("readme")) return "document";
  if (normalized.includes("ppt") || normalized.includes("答辩")) return "presentation";
  if (normalized.includes("backend") || normalized.includes("frontend")) return "code";
  if (normalized.includes("数据") || normalized.includes("dataset")) return "dataset";

  return extensionKindMap[extension] ?? "other";
}

export function createProjectWorkspace(input: DefenseWorkspaceInput): DefenseWorkspace {
  const createdAt = new Date().toISOString();
  const files = (input.files ?? []).map((file) => createFileRecord(file, createdAt));

  return {
    project: {
      id: `project-${stableId(input.name, createdAt)}`,
      name: input.name.trim() || "未命名答辩项目",
      category: input.category,
      ownerScope: input.ownerScope,
      teammateScope: input.teammateScope,
      createdAt,
    },
    files,
    processingTasks: createProcessingTasks(files, createdAt),
    artifacts: [],
  };
}

export function appendWorkspaceFiles(
  workspace: DefenseWorkspace,
  files: DefenseFileInput[],
): DefenseWorkspace {
  const addedAt = new Date().toISOString();
  const nextFiles = files.map((file) => createFileRecord(file, addedAt));

  return {
    ...workspace,
    files: [...workspace.files, ...nextFiles],
    processingTasks: [
      ...(workspace.processingTasks ?? []),
      ...createProcessingTasks(nextFiles, addedAt),
    ],
    artifacts: workspace.artifacts ?? [],
  };
}

export function summarizeWorkspace(workspace: DefenseWorkspace): WorkspaceSummary {
  const kinds = new Set(workspace.files.map((file) => file.kind));
  const taskCounts = countProcessingTasks(workspace.processingTasks ?? []);
  const hasPresentation = kinds.has("presentation");
  const hasCode = kinds.has("code");
  const hasDataOrDatabase = kinds.has("dataset") || kinds.has("database");

  let readiness = 5;
  if (workspace.project.name.trim()) readiness += 10;
  if (workspace.project.ownerScope.trim()) readiness += 10;
  if (hasPresentation) readiness += 10;
  if (hasCode) readiness += 5;
  if (hasDataOrDatabase) readiness += 5;
  if (taskCounts.completed > 0) readiness += 5;

  return {
    fileCount: workspace.files.length,
    pendingTaskCount: taskCounts.pending,
    processingTaskCount: taskCounts.processing,
    completedTaskCount: taskCounts.completed,
    hasPresentation,
    hasCode,
    hasDataOrDatabase,
    readiness: Math.min(readiness, 100),
  };
}

export function saveWorkspace(workspace: DefenseWorkspace) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(workspaceStorageKey, JSON.stringify(workspace));
  window.dispatchEvent(new Event(workspaceChangedEvent));
}

export function loadWorkspace(): DefenseWorkspace | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(workspaceStorageKey);
  if (!raw) return null;

  try {
    return normalizeWorkspace(JSON.parse(raw) as DefenseWorkspace);
  } catch {
    window.localStorage.removeItem(workspaceStorageKey);
    return null;
  }
}

export function startNextProcessingTask(
  workspace: DefenseWorkspace,
  startedAt = new Date().toISOString(),
): DefenseWorkspace {
  let didStart = false;

  return {
    ...workspace,
    processingTasks: (workspace.processingTasks ?? []).map((task) => {
      if (didStart || task.status !== "pending") return task;
      didStart = true;
      return {
        ...task,
        status: "processing",
        progress: 35,
        startedAt,
        error: undefined,
      };
    }),
  };
}

export function completeProcessingTask(
  workspace: DefenseWorkspace,
  taskId: string,
  completedAt = new Date().toISOString(),
  artifact?: DefenseProcessingArtifact,
): DefenseWorkspace {
  const nextWorkspace = updateProcessingTask(workspace, taskId, {
    status: "completed",
    progress: 100,
    completedAt,
    error: undefined,
    artifactId: artifact?.id,
  });

  if (!artifact) return nextWorkspace;

  return {
    ...nextWorkspace,
    artifacts: [
      ...(nextWorkspace.artifacts ?? []).filter((item) => item.id !== artifact.id),
      artifact,
    ],
  };
}

export function failProcessingTask(
  workspace: DefenseWorkspace,
  taskId: string,
  error: string,
  completedAt = new Date().toISOString(),
): DefenseWorkspace {
  return updateProcessingTask(workspace, taskId, {
    status: "failed",
    progress: 100,
    completedAt,
    error,
  });
}

export function createFileRecord(file: DefenseFileInput, addedAt: string): DefenseFileRecord {
  const kind = classifyDefenseFile(file.name);

  return {
    ...file,
    id: `file-${stableId(file.name, `${file.size}-${addedAt}`)}`,
    kind,
    status: statusForKind(kind, Boolean(file.storagePath)),
    source: sourceForKind(kind),
    addedAt,
  };
}

export function createProcessingTasks(files: DefenseFileRecord[], createdAt: string) {
  return files
    .filter((file) => isProcessableFile(file))
    .map((file) => ({
      id: `task-${stableId(file.id, file.storagePath ?? file.name)}`,
      fileId: file.id,
      fileName: file.name,
      kind: file.kind,
      title: taskTitleForKind(file.kind),
      engine: taskEngineForKind(file.kind),
      status: "pending" as const,
      progress: 0,
      createdAt,
    }));
}

function isProcessableFile(file: DefenseFileRecord) {
  if (!file.storagePath) return false;
  return !["asset", "other"].includes(file.kind);
}

function updateProcessingTask(
  workspace: DefenseWorkspace,
  taskId: string,
  patch: Partial<DefenseProcessingTask>,
): DefenseWorkspace {
  return {
    ...workspace,
    processingTasks: (workspace.processingTasks ?? []).map((task) =>
      task.id === taskId ? { ...task, ...patch } : task,
    ),
  };
}

function countProcessingTasks(tasks: DefenseProcessingTask[]) {
  return tasks.reduce(
    (counts, task) => ({
      ...counts,
      [task.status]: counts[task.status] + 1,
    }),
    {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    } satisfies Record<ProcessingTaskStatus, number>,
  );
}

function normalizeWorkspace(workspace: DefenseWorkspace): DefenseWorkspace {
  if (Array.isArray(workspace.processingTasks)) {
    return {
      ...workspace,
      artifacts: workspace.artifacts ?? [],
    };
  }
  return {
    ...workspace,
    processingTasks: createProcessingTasks(workspace.files ?? [], workspace.project.createdAt),
    artifacts: workspace.artifacts ?? [],
  };
}

export function taskTitleForKind(kind: DefenseFileKind) {
  const titleMap: Record<DefenseFileKind, string> = {
    presentation: "生成逐页预览与讲稿入口",
    document: "抽取项目知识库文本",
    code: "打包代码上下文",
    database: "解析数据库结构",
    dataset: "抽取数据字段与指标",
    asset: "记录附件",
    other: "记录附件",
  };

  return titleMap[kind];
}

export function taskEngineForKind(kind: DefenseFileKind) {
  const engineMap: Record<DefenseFileKind, string> = {
    presentation: "PDF.js + 逐页讲稿 Skill",
    document: "Docling / Marker",
    code: "Repomix",
    database: "SQL Parser",
    dataset: "SheetJS",
    asset: "Local Storage",
    other: "Local Storage",
  };

  return engineMap[kind];
}

export function statusForKind(kind: DefenseFileKind, isStored = false) {
  const prefix = isStored ? "已上传，" : "";
  const statusMap: Record<DefenseFileKind, string> = {
    presentation: `${prefix}待生成逐页预览`,
    document: `${prefix}待入库`,
    code: `${prefix}待 Repomix 处理`,
    database: `${prefix}待解析表结构`,
    dataset: `${prefix}待抽取字段`,
    asset: "附件已记录",
    other: "附件已记录",
  };

  return statusMap[kind];
}

export function sourceForKind(kind: DefenseFileKind) {
  const sourceMap: Record<DefenseFileKind, string> = {
    presentation: "PPT 同屏答辩",
    document: "项目速记 Skill",
    code: "代码解释 Skill",
    database: "数据库追问",
    dataset: "数据质疑 Skill",
    asset: "项目附件",
    other: "项目附件",
  };

  return sourceMap[kind];
}

export function stableId(...parts: string[]) {
  let hash = 0;
  for (const part of parts.join(":")) {
    hash = (hash << 5) - hash + part.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
