"use client";

import Uppy, { type Meta, type UppyFile } from "@uppy/core";
import XHRUpload from "@uppy/xhr-upload";
import { motion } from "framer-motion";
import {
  Braces,
  ChevronRight,
  DatabaseZap,
  FileArchive,
  FileCode2,
  FileIcon,
  FileSpreadsheet,
  FileText,
  FolderIcon,
  PanelRightOpen,
  Presentation,
  Sheet as SheetIcon,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import {
  startTransition,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MutableRefObject,
} from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  classifyDefenseFile,
  type DefenseFileKind,
  type DefenseFileInput,
} from "@/lib/project-workspace";
import {
  getUploadDisplayName,
  getUploadableFiles,
  getUploadableFilesFromDataTransfer,
  pickUploadDirectory,
} from "@/lib/upload-files";
import {
  buildUploadWorkspaceCopy,
  makePersistedUploadTrayKey,
  mergeUploadTrayItems,
  uploadWorkspaceFormats,
  type UploadTrayItem,
  type UploadWorkspaceVariant,
} from "@/lib/upload-workspace";
import { cn } from "@/lib/utils";
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "./ui/scroll-based-velocity";

type UploadResponseBody = {
  uploadedFiles?: DefenseFileInput[];
  error?: string;
};

type UploadMeta = Meta & {
  variant: UploadWorkspaceVariant;
  name?: string;
  relativePaths?: string;
};

type ProjectUploadWorkspaceProps = {
  variant: UploadWorkspaceVariant;
  projectId?: string;
  safeTopOffset?: number;
  initialFiles?: DefenseFileInput[];
  className?: string;
  onUploadComplete?: (files: DefenseFileInput[]) => void;
  onUploadError?: (message: string) => void;
  onUploadActivityChange?: (isActive: boolean) => void;
};

type UploadWorkspaceCallbacks = {
  onUploadComplete?: (files: DefenseFileInput[]) => void;
  onUploadError?: (message: string) => void;
  onUploadActivityChange?: (isActive: boolean) => void;
};

type UploadTreeNode = {
  id: string;
  label: string;
  kind: "folder" | "file";
  fileKind?: DefenseFileKind;
  children?: UploadTreeNode[];
  defaultOpen?: boolean;
};

const uploadLoopFormats = [
  ...uploadWorkspaceFormats,
  ...uploadWorkspaceFormats.slice(0, 6),
  ...uploadWorkspaceFormats.slice(2, 9),
];

const formatIconMap: Record<string, LucideIcon> = {
  pdf: Presentation,
  pptx: Presentation,
  docx: FileText,
  md: SheetIcon,
  txt: FileText,
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  sql: DatabaseZap,
  zip: FileArchive,
};

const fileKindIconMap: Record<DefenseFileKind, LucideIcon> = {
  presentation: Presentation,
  document: FileText,
  code: FileCode2,
  database: DatabaseZap,
  dataset: FileSpreadsheet,
  asset: SheetIcon,
  other: Braces,
};

const uploadActionButtonStyle = {
  width: "min(11.5rem, 68vw)",
  minHeight: "3rem",
  justifyContent: "center",
  paddingInline: "1rem",
  fontSize: "0.98rem",
  letterSpacing: "0",
} satisfies CSSProperties;

const primaryUploadActionButtonStyle = {
  ...uploadActionButtonStyle,
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.16)",
} satisfies CSSProperties;

const secondaryUploadActionButtonStyle = {
  ...uploadActionButtonStyle,
  background: "rgba(255, 255, 255, 0.78)",
  borderColor: "rgba(31, 35, 41, 0.16)",
  boxShadow: "0 10px 24px rgba(31, 35, 41, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.86)",
} satisfies CSSProperties;

const uploadOrbStyle = {
  width: "9rem",
  height: "9rem",
  background:
    "radial-gradient(circle at 50% 34%, rgba(255, 255, 255, 0.94), rgba(236, 253, 245, 0.72) 58%, rgba(220, 252, 231, 0.64))",
  boxShadow:
    "0 22px 44px rgba(34, 197, 94, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.92)",
} satisfies CSSProperties;

const uploadOrbImageStyle = {
  width: "8.75rem",
  height: "8.75rem",
} satisfies CSSProperties;

const uploadActionsStyle = {
  gap: "0.58rem",
  borderRadius: "1.35rem",
  background: "rgba(255, 255, 255, 0.42)",
  padding: "0.42rem",
} satisfies CSSProperties;

export function ProjectUploadWorkspace({
  variant,
  projectId,
  safeTopOffset = 0,
  initialFiles = [],
  className,
  onUploadComplete,
  onUploadError,
  onUploadActivityChange,
}: ProjectUploadWorkspaceProps) {
  const copy = buildUploadWorkspaceCopy(variant);
  const uploadEndpoint = projectId
    ? `/api/uploads?projectId=${encodeURIComponent(projectId)}`
    : "/api/uploads";
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({
    onUploadComplete,
    onUploadError,
    onUploadActivityChange,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isTreeSheetOpen, setIsTreeSheetOpen] = useState(false);
  const [sessionTrayItems, setSessionTrayItems] = useState<UploadTrayItem[]>([]);
  const [uppy] = useState(
    () => {
      const instance = new Uppy<UploadMeta, UploadResponseBody>({
        autoProceed: true,
      });

      instance.use(XHRUpload, {
        endpoint: uploadEndpoint,
        fieldName: "files",
        allowedMetaFields: ["variant", "relativePaths"],
        getResponseData: (xhr) => {
          try {
            return JSON.parse(xhr.responseText) as UploadResponseBody;
          } catch {
            return { error: "上传响应格式错误" };
          }
        },
      });

      return instance;
    },
  );

  useEffect(() => {
    callbacksRef.current = {
      onUploadComplete,
      onUploadError,
      onUploadActivityChange,
    };
  }, [onUploadActivityChange, onUploadComplete, onUploadError]);

  useEffect(() => {
    uppy.getPlugin("XHRUpload")?.setOptions({ endpoint: uploadEndpoint });
  }, [uppy, uploadEndpoint]);

  useEffect(() => {
    if (destroyTimerRef.current) {
      clearTimeout(destroyTimerRef.current);
      destroyTimerRef.current = null;
    }

    return () => {
      destroyTimerRef.current = setTimeout(() => {
        uppy.cancelAll();
        uppy.destroy();
        destroyTimerRef.current = null;
      });
    };
  }, [uppy]);

  useEffect(() => {
    const handleFileAdded = (file: UppyFile<UploadMeta, UploadResponseBody>) => {
      setSessionTrayItems((currentItems) =>
        upsertTrayItem(currentItems, {
          id: file.id,
          name: file.name ?? "未命名文件",
          size: file.size ?? 0,
          status: "queued",
          progress: 0,
        }),
      );
    };

    const handleRestrictionFailed = (
      file: UppyFile<UploadMeta, UploadResponseBody> | undefined,
      error: Error,
    ) => {
      const nextItem = {
        id: file?.id ?? `failed:${crypto.randomUUID()}`,
        name: file?.name ?? "文件受限",
        size: file?.size ?? 0,
        status: "failed" as const,
        error: error.message,
      };

      setSessionTrayItems((currentItems) => upsertTrayItem(currentItems, nextItem));
      notifyUploadError(callbacksRef, error.message);
    };

    const handleUploadStart = (files: UppyFile<UploadMeta, UploadResponseBody>[]) => {
      setSessionTrayItems((currentItems) =>
        files.reduce(
          (items, file) =>
            upsertTrayItem(items, {
              id: file.id,
              name: file.name ?? "未命名文件",
              size: file.size ?? 0,
              status: "uploading",
              progress: 0,
            }),
          currentItems,
        ),
      );
    };

    const handleUploadProgress = (
      file: UppyFile<UploadMeta, UploadResponseBody> | undefined,
      progress: { bytesUploaded: number; bytesTotal: number | null },
    ) => {
      if (!file) return;
      const percent = progress.bytesTotal
        ? Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
        : 0;
      setSessionTrayItems((currentItems) =>
        upsertTrayItem(currentItems, {
          id: file.id,
          name: file.name ?? "未命名文件",
          size: file.size ?? 0,
          status: "uploading",
          progress: percent,
        }),
      );
    };

    const handleUploadSuccess = (
      file: UppyFile<UploadMeta, UploadResponseBody> | undefined,
      response: { body?: UploadResponseBody },
    ) => {
      if (!file) return;

      const uploadedFiles = response.body?.uploadedFiles ?? [];
      const persistedKey = uploadedFiles[0]
        ? makePersistedUploadTrayKey(uploadedFiles[0])
        : undefined;

      setSessionTrayItems((currentItems) =>
        upsertTrayItem(currentItems, {
          id: file.id,
          name: file.name ?? "未命名文件",
          size: file.size ?? 0,
          status: "completed",
          progress: 100,
          persistedKey,
        }),
      );
      notifyUploadComplete(callbacksRef, uploadedFiles);
    };

    const handleUploadError = (
      file: UppyFile<UploadMeta, UploadResponseBody> | undefined,
      error: Error,
      response?: { body?: UploadResponseBody },
    ) => {
      const message = response?.body?.error ?? error.message ?? "文件上传失败";

      if (file) {
        setSessionTrayItems((currentItems) =>
          upsertTrayItem(currentItems, {
            id: file.id,
            name: file.name ?? "未命名文件",
            size: file.size ?? 0,
            status: "failed",
            progress: 0,
            error: message,
          }),
        );
      }

      notifyUploadError(callbacksRef, message);
    };

    uppy.on("file-added", handleFileAdded);
    uppy.on("restriction-failed", handleRestrictionFailed);
    uppy.on("upload-start", handleUploadStart);
    uppy.on("upload-progress", handleUploadProgress);
    uppy.on("upload-success", handleUploadSuccess);
    uppy.on("upload-error", handleUploadError);

    return () => {
      uppy.off("file-added", handleFileAdded);
      uppy.off("restriction-failed", handleRestrictionFailed);
      uppy.off("upload-start", handleUploadStart);
      uppy.off("upload-progress", handleUploadProgress);
      uppy.off("upload-success", handleUploadSuccess);
      uppy.off("upload-error", handleUploadError);
    };
  }, [uppy]);

  const trayItems = useMemo(
    () => mergeUploadTrayItems(sessionTrayItems, initialFiles),
    [initialFiles, sessionTrayItems],
  );

  useEffect(() => {
    notifyUploadActivity(
      callbacksRef,
      trayItems.some((item) => item.status === "queued" || item.status === "uploading"),
    );
  }, [trayItems]);

  function openPicker() {
    inputRef.current?.click();
  }

  async function openDirectoryPicker() {
    try {
      const files = await pickUploadDirectory();
      if (files.length) addFiles(files);
    } catch (error) {
      notifyUploadError(
        callbacksRef,
        error instanceof Error ? error.message : "文件夹导入失败",
      );
    }
  }

  function addFiles(files: FileList | File[]) {
    const nextFiles = getUploadableFiles(files);
    if (!nextFiles.length) {
      notifyUploadError(callbacksRef, "没有找到可上传的文件，已跳过依赖目录、隐藏配置和代码压缩包。");
      return;
    }

    try {
      uppy.addFiles(
        nextFiles.map((file) => {
          const displayName = getUploadDisplayName(file);

          return {
            name: displayName,
            type: file.type,
            data: file,
            meta: {
              name: displayName,
              relativePaths: displayName,
              variant,
            },
            source: "local",
          };
        }),
      );
    } catch (error) {
      notifyUploadError(
        callbacksRef,
        error instanceof Error ? error.message : "文件加入队列失败",
      );
    }
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    try {
      const files = await getUploadableFilesFromDataTransfer(event.dataTransfer);
      addFiles(files);
    } catch (error) {
      notifyUploadError(
        callbacksRef,
        error instanceof Error ? error.message : "文件夹导入失败",
      );
    }
  }

  const uploadedCount = trayItems.filter((item) => item.status === "completed").length;
  const uploadedTreeNodes = useMemo(
    () => buildUploadExplorerTree(trayItems),
    [trayItems],
  );

  return (
    <section
      className={cn(
        "presento-upload-workspace",
        variant === "workspace" && "presento-upload-workspace-room",
        className,
      )}
      style={
        {
          "--presento-upload-safe-top": `${safeTopOffset}px`,
        } as CSSProperties
      }
    >
      <div className="presento-upload-shell">
        <div className="presento-upload-header">
          <div className="presento-upload-copy">
            <h2>{copy.title}</h2>
            {copy.description ? <p>{copy.description}</p> : null}
          </div>
          <div className="presento-upload-header-stats">
            {variant === "create" ? (
              <div className="presento-upload-tree-trigger presento-upload-tree-trigger-static">
                {uploadedCount}份已接入
              </div>
            ) : (
              <Sheet open={isTreeSheetOpen} onOpenChange={setIsTreeSheetOpen}>
                <SheetTrigger asChild>
                  <Button className="presento-upload-tree-trigger" variant="outline">
                    {uploadedCount}份已接入
                    <motion.span
                      animate={{
                        rotate: isTreeSheetOpen ? 180 : 0,
                        x: isTreeSheetOpen ? 1 : 0,
                      }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <PanelRightOpen data-icon="inline-end" />
                    </motion.span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="presento-upload-tree-sheet" side="right">
                  <SheetHeader className="presento-upload-tree-sheet-header">
                    <SheetTitle className="presento-upload-tree-sheet-title">
                      已上传文件
                    </SheetTitle>
                  </SheetHeader>
                  <div className="presento-upload-tree-body">
                    <UploadTreePanel
                      emptyLabel={copy.emptyTrayLabel}
                      nodes={uploadedTreeNodes}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>

        <div
          className={cn(
            "presento-upload-main",
            variant === "create" && "presento-upload-main-compact",
          )}
        >
          <label
            className={cn(
              "presento-upload-dropzone",
              isDragging && "presento-upload-dropzone-active",
            )}
            htmlFor={inputId}
            onDragEnter={() => setIsDragging(true)}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <div
              className="presento-upload-dropzone-orb"
              aria-hidden="true"
              style={uploadOrbStyle}
            >
              <Image
                alt=""
                className="presento-upload-dropzone-orb-image"
                height={86}
                src="/brand/upload-panda.png"
                style={uploadOrbImageStyle}
                width={86}
              />
            </div>
            <div className="presento-upload-dropzone-actions" style={uploadActionsStyle}>
              <Button
                className="presento-upload-action-button rounded-full bg-[var(--presento-blue)] font-black text-white hover:bg-[var(--presento-blue-active)]"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openPicker();
                }}
                size="lg"
                style={primaryUploadActionButtonStyle}
                type="button"
              >
                选择文件
              </Button>
              <Button
                className="presento-upload-action-button rounded-full font-black"
                disabled={trayItems.some((item) => item.status === "queued" || item.status === "uploading")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void openDirectoryPicker();
                }}
                size="lg"
                style={secondaryUploadActionButtonStyle}
                type="button"
                variant="outline"
              >
                选择文件夹
              </Button>
            </div>
          </label>

          <input
            className="sr-only"
            id={inputId}
            multiple
            onChange={(event) => {
              if (!event.target.files?.length) return;
              addFiles(event.target.files);
              event.target.value = "";
            }}
            onClick={(event) => event.stopPropagation()}
            ref={inputRef}
            type="file"
          />
          {variant === "workspace" ? (
            <section className="presento-upload-loop-band" aria-label="支持上传格式">
              <ScrollVelocityContainer className="presento-upload-loop">
                <ScrollVelocityRow baseVelocity={1.6}>
                  {uploadLoopFormats.map((item, index) => {
                    const Icon = formatIconMap[item.id] ?? SheetIcon;
                    return (
                      <div className="presento-upload-format-chip" key={`forward-large-${item.id}-${index}`}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </ScrollVelocityRow>
              </ScrollVelocityContainer>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function notifyUploadComplete(
  callbacksRef: MutableRefObject<UploadWorkspaceCallbacks>,
  files: DefenseFileInput[],
) {
  if (!files.length) return;
  startTransition(() => {
    callbacksRef.current.onUploadComplete?.(files);
  });
}

function notifyUploadError(
  callbacksRef: MutableRefObject<UploadWorkspaceCallbacks>,
  message: string,
) {
  startTransition(() => {
    callbacksRef.current.onUploadError?.(message);
  });
}

function notifyUploadActivity(
  callbacksRef: MutableRefObject<UploadWorkspaceCallbacks>,
  isActive: boolean,
) {
  startTransition(() => {
    callbacksRef.current.onUploadActivityChange?.(isActive);
  });
}

function upsertTrayItem(currentItems: UploadTrayItem[], nextItem: UploadTrayItem) {
  const nextItems = [...currentItems];
  const existingIndex = nextItems.findIndex((item) => item.id === nextItem.id);

  if (existingIndex === -1) {
    nextItems.unshift(nextItem);
    return nextItems;
  }

  nextItems[existingIndex] = {
    ...nextItems[existingIndex],
    ...nextItem,
  };
  return nextItems;
}

function UploadTreePanel({
  nodes,
  emptyLabel,
}: {
  nodes: UploadTreeNode[];
  emptyLabel: string;
}) {
  return (
    <div className="presento-upload-tree-panel">
      {nodes.length ? (
        <div className="presento-upload-tree-root">
          {nodes.map((node) => (
            <UploadTreeNodeRow key={node.id} node={node} />
          ))}
        </div>
      ) : (
        <div className="presento-upload-tray-empty">
          <UploadCloud aria-hidden="true" />
          <p>{emptyLabel}</p>
        </div>
      )}
    </div>
  );
}

function UploadTreeNodeRow({ node, level = 0 }: { node: UploadTreeNode; level?: number }) {
  const Icon =
    node.kind === "folder"
      ? FolderIcon
      : fileKindIconMap[node.fileKind ?? classifyDefenseFile(node.label)] ?? FileIcon;

  if (!node.children?.length) {
    return (
      <Button
        className="presento-upload-tree-item presento-upload-tree-item-file"
        size="sm"
        style={{ "--tree-level": level } as CSSProperties}
        type="button"
        variant="ghost"
      >
        <span className="presento-upload-tree-spacer" aria-hidden="true" />
        <Icon />
        <span>{node.label}</span>
      </Button>
    );
  }

  return (
    <Collapsible className="presento-upload-tree-collapsible" defaultOpen={node.defaultOpen}>
      <CollapsibleTrigger asChild>
        <Button
          className="presento-upload-tree-item presento-upload-tree-item-folder"
          size="sm"
          style={{ "--tree-level": level } as CSSProperties}
          type="button"
          variant="ghost"
        >
          <ChevronRight className="presento-upload-tree-chevron" />
          <Icon />
          <span>{node.label}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="presento-upload-tree-children">
        {node.children.map((child) => (
          <UploadTreeNodeRow key={child.id} level={level + 1} node={child} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function buildUploadExplorerTree(trayItems: UploadTrayItem[]): UploadTreeNode[] {
  const groups = new Map<DefenseFileKind, UploadTrayItem[]>();

  for (const item of trayItems) {
    const kind = classifyDefenseFile(item.name);
    const items = groups.get(kind) ?? [];
    items.push(item);
    groups.set(kind, items);
  }

  const folderLabels: Record<DefenseFileKind, string> = {
    presentation: "演示资料",
    document: "项目文档",
    code: "代码文件",
    database: "数据库脚本",
    dataset: "数据表",
    asset: "图片素材",
    other: "其他资料",
  };

  const children = Array.from(groups.entries()).map(([kind, items]) => ({
    id: `folder:${kind}`,
    label: folderLabels[kind],
    kind: "folder" as const,
    defaultOpen: true,
    children: buildPathTree(items, kind),
  }));

  return [
    {
      id: "workspace-root",
      label: "已接入资料",
      kind: "folder",
      defaultOpen: true,
      children,
    },
  ];
}

function buildPathTree(items: UploadTrayItem[], kind: DefenseFileKind): UploadTreeNode[] {
  const roots: UploadTreeNode[] = [];
  const folderMap = new Map<string, UploadTreeNode>();

  for (const item of items) {
    const parts = item.name.split("/").filter(Boolean);
    const fileLabel = parts.pop() ?? item.name;
    let siblings = roots;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let folder = folderMap.get(currentPath);

      if (!folder) {
        folder = {
          id: `folder-path:${currentPath}`,
          label: part,
          kind: "folder",
          defaultOpen: true,
          children: [],
        };
        folderMap.set(currentPath, folder);
        siblings.push(folder);
      }

      siblings = folder.children ?? [];
    }

    siblings.push({
      id: `file:${item.id}`,
      label: fileLabel,
      kind: "file",
      fileKind: kind,
    });
  }

  return roots;
}
