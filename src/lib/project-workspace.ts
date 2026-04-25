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
};

export type DefenseFileRecord = DefenseFileInput & {
  id: string;
  kind: DefenseFileKind;
  status: string;
  source: string;
  addedAt: string;
};

export type DefenseWorkspace = {
  project: DefenseProject;
  files: DefenseFileRecord[];
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

  return {
    project: {
      id: `project-${stableId(input.name, createdAt)}`,
      name: input.name.trim() || "未命名答辩项目",
      category: input.category,
      ownerScope: input.ownerScope,
      teammateScope: input.teammateScope,
      createdAt,
    },
    files: (input.files ?? []).map((file) => createFileRecord(file, createdAt)),
  };
}

export function appendWorkspaceFiles(
  workspace: DefenseWorkspace,
  files: DefenseFileInput[],
): DefenseWorkspace {
  const addedAt = new Date().toISOString();

  return {
    ...workspace,
    files: [
      ...workspace.files,
      ...files.map((file) => createFileRecord(file, addedAt)),
    ],
  };
}

export function summarizeWorkspace(workspace: DefenseWorkspace): WorkspaceSummary {
  const kinds = new Set(workspace.files.map((file) => file.kind));
  const hasPresentation = kinds.has("presentation");
  const hasCode = kinds.has("code");
  const hasDataOrDatabase = kinds.has("dataset") || kinds.has("database");

  let readiness = 5;
  if (workspace.project.name.trim()) readiness += 10;
  if (workspace.project.ownerScope.trim()) readiness += 10;
  if (hasPresentation) readiness += 10;
  if (hasCode) readiness += 5;
  if (hasDataOrDatabase) readiness += 5;

  return {
    fileCount: workspace.files.length,
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
    return JSON.parse(raw) as DefenseWorkspace;
  } catch {
    window.localStorage.removeItem(workspaceStorageKey);
    return null;
  }
}

function createFileRecord(file: DefenseFileInput, addedAt: string): DefenseFileRecord {
  const kind = classifyDefenseFile(file.name);

  return {
    ...file,
    id: `file-${stableId(file.name, `${file.size}-${addedAt}`)}`,
    kind,
    status: statusForKind(kind),
    source: sourceForKind(kind),
    addedAt,
  };
}

function statusForKind(kind: DefenseFileKind) {
  const statusMap: Record<DefenseFileKind, string> = {
    presentation: "待生成逐页预览",
    document: "待入库",
    code: "待 Repomix 处理",
    database: "待解析表结构",
    dataset: "待抽取字段",
    asset: "附件已记录",
    other: "附件已记录",
  };

  return statusMap[kind];
}

function sourceForKind(kind: DefenseFileKind) {
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

function stableId(...parts: string[]) {
  let hash = 0;
  for (const part of parts.join(":")) {
    hash = (hash << 5) - hash + part.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
