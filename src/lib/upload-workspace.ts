import type { DefenseFileInput } from "./project-workspace";

export type UploadWorkspaceFormat = {
  id: string;
  label: string;
  extensions: string[];
};

export type UploadTrayStatus = "queued" | "uploading" | "completed" | "failed";

export type UploadTrayItem = {
  id: string;
  name: string;
  size: number;
  status: UploadTrayStatus;
  progress?: number;
  error?: string;
  persistedKey?: string;
};

export type UploadWorkspaceVariant = "create" | "workspace";

export type UploadWorkspaceCopy = {
  eyebrow: string;
  title: string;
  description: string;
  dropzoneLabel: string;
  dropzoneHint: string;
  emptyTrayLabel: string;
  trayTitle: string;
};

export const uploadWorkspaceFormats: UploadWorkspaceFormat[] = [
  { id: "pdf", label: "PDF", extensions: [".pdf"] },
  { id: "pptx", label: "PPTX", extensions: [".ppt", ".pptx"] },
  { id: "docx", label: "DOCX", extensions: [".doc", ".docx"] },
  { id: "md", label: "MD", extensions: [".md"] },
  { id: "txt", label: "TXT", extensions: [".txt"] },
  { id: "csv", label: "CSV", extensions: [".csv"] },
  { id: "xlsx", label: "XLSX", extensions: [".xls", ".xlsx"] },
  { id: "sql", label: "SQL", extensions: [".sql"] },
  { id: "zip", label: "ZIP", extensions: [".zip"] },
];

export const uploadWorkspaceSupportNote =
  "";

export function buildUploadWorkspaceCopy(variant: UploadWorkspaceVariant): UploadWorkspaceCopy {
  if (variant === "workspace") {
    return {
      eyebrow: "知识源接入舱",
      title: "继续上传课程项目资料",
      description: "",
      dropzoneLabel: "拖拽资料或文件夹到这里，或点击继续选择文件 / 文件夹",
      dropzoneHint: "",
      emptyTrayLabel: "追加上传后，文件会出现在这里。",
      trayTitle: "本次追加文件",
    };
  }

  return {
    eyebrow: "训练启动舱",
    title: "创建项目并先接入第一批资料",
    description: "先把答辩材料接入 Presento，再继续补充项目信息和创建动作。",
    dropzoneLabel: "拖拽课程项目资料或文件夹，或点击选择文件 / 文件夹",
    dropzoneHint: "建议先接入讲稿、文档、代码包和数据表，再生成知识地图。",
    emptyTrayLabel: "上传完成后，文件会出现在这里。",
    trayTitle: "已接入文件",
  };
}

export function formatUploadTrayStatus(status: UploadTrayStatus) {
  if (status === "queued") return "等待上传";
  if (status === "uploading") return "上传中";
  if (status === "completed") return "已完成";
  return "失败";
}

export function makePersistedUploadTrayKey(file: DefenseFileInput) {
  return file.storagePath ?? file.storedName ?? `${file.name}:${file.size}`;
}

export function toPersistedUploadTrayItems(files: DefenseFileInput[]): UploadTrayItem[] {
  return files.map((file) => {
    const persistedKey = makePersistedUploadTrayKey(file);

    return {
      id: `persisted:${persistedKey}`,
      name: file.name,
      size: file.size,
      status: "completed" as const,
      persistedKey,
    };
  });
}

export function mergeUploadedFiles(
  currentFiles: DefenseFileInput[],
  nextFiles: DefenseFileInput[],
) {
  const mergedFiles = new Map<string, DefenseFileInput>();

  for (const file of [...currentFiles, ...nextFiles]) {
    mergedFiles.set(makePersistedUploadTrayKey(file), file);
  }

  return Array.from(mergedFiles.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "zh-Hans-CN"),
  );
}

export function mergeUploadTrayItems(
  currentItems: UploadTrayItem[],
  persistedFiles: DefenseFileInput[],
) {
  const nextItems = new Map<string, UploadTrayItem>();

  for (const item of currentItems) {
    nextItems.set(item.id, item);
  }

  for (const item of toPersistedUploadTrayItems(persistedFiles)) {
    for (const [key, currentItem] of nextItems.entries()) {
      if (currentItem.persistedKey === item.persistedKey) {
        nextItems.delete(key);
      }
    }
    nextItems.set(item.id, item);
  }

  return Array.from(nextItems.values()).sort(compareUploadTrayItems);
}

function compareUploadTrayItems(left: UploadTrayItem, right: UploadTrayItem) {
  const priority = trayStatusPriority[left.status] - trayStatusPriority[right.status];
  if (priority !== 0) return priority;
  return left.name.localeCompare(right.name, "zh-Hans-CN");
}

const trayStatusPriority: Record<UploadTrayStatus, number> = {
  uploading: 0,
  queued: 1,
  failed: 2,
  completed: 3,
};
