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
  buildUploadWorkspaceCopy,
  makePersistedUploadTrayKey,
  mergeUploadTrayItems,
  uploadWorkspaceMockTrayItems,
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
};

type ProjectUploadWorkspaceProps = {
  variant: UploadWorkspaceVariant;
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

const allowedFileTypes = uploadWorkspaceFormats.flatMap((item) => item.extensions);
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

export function ProjectUploadWorkspace({
  variant,
  safeTopOffset = 0,
  initialFiles = [],
  className,
  onUploadComplete,
  onUploadError,
  onUploadActivityChange,
}: ProjectUploadWorkspaceProps) {
  const copy = buildUploadWorkspaceCopy(variant);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const callbacksRef = useRef({
    onUploadComplete,
    onUploadError,
    onUploadActivityChange,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isTreeSheetOpen, setIsTreeSheetOpen] = useState(false);
  const [sessionTrayItems, setSessionTrayItems] = useState<UploadTrayItem[]>([]);
  const [uppy] = useState(
    () =>
      new Uppy<UploadMeta, UploadResponseBody>({
        autoProceed: true,
        restrictions: {
          allowedFileTypes,
        },
      }),
  );

  useEffect(() => {
    callbacksRef.current = {
      onUploadComplete,
      onUploadError,
      onUploadActivityChange,
    };
  }, [onUploadActivityChange, onUploadComplete, onUploadError]);

  useEffect(() => {
    uppy.use(XHRUpload, {
      endpoint: "/api/uploads",
      fieldName: "files",
      getResponseData: (xhr) => {
        try {
          return JSON.parse(xhr.responseText) as UploadResponseBody;
        } catch {
          return { error: "上传响应格式错误" };
        }
      },
    });

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
      uppy.cancelAll();
      uppy.destroy();
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

  function addFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    if (!nextFiles.length) return;

    try {
      uppy.addFiles(
        nextFiles.map((file) => ({
          name: file.name,
          type: file.type,
          data: file,
          meta: {
            variant,
          },
          source: "local",
        })),
      );
    } catch (error) {
      notifyUploadError(
        callbacksRef,
        error instanceof Error ? error.message : "文件加入队列失败",
      );
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  const uploadedCount = trayItems.filter((item) => item.status === "completed").length;
  const sheetTrayItems = useMemo(
    () => mergeMockTrayItems(trayItems, uploadWorkspaceMockTrayItems),
    [trayItems],
  );
  const uploadedTreeNodes = useMemo(
    () => buildUploadExplorerTree(sheetTrayItems),
    [sheetTrayItems],
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
          </div>
        </div>

        <div className="presento-upload-main">
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
            <div className="presento-upload-dropzone-orb" aria-hidden="true">
              <Image
                alt=""
                className="presento-upload-dropzone-orb-image"
                height={86}
                src="/brand/upload-panda.png"
                width={86}
              />
            </div>
            <div className="presento-upload-dropzone-copy">
              <strong>{copy.dropzoneLabel}</strong>
              {copy.dropzoneHint ? <p>{copy.dropzoneHint}</p> : null}
            </div>
            <div className="presento-upload-dropzone-actions">
              <Button
                className="rounded-full bg-[var(--presento-blue)] px-5 font-black text-white hover:bg-[var(--presento-blue-active)]"
                onClick={(event) => {
                  event.preventDefault();
                  openPicker();
                }}
                size="lg"
                type="button"
              >
                选择文件
              </Button>
            </div>
            <input
              className="sr-only"
              id={inputId}
              multiple
              onChange={(event) => {
                if (!event.target.files?.length) return;
                addFiles(event.target.files);
                event.target.value = "";
              }}
              ref={inputRef}
              type="file"
            />
          </label>

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
  const latestNodes: UploadTreeNode[] = trayItems.map((item) => ({
    id: `latest:${item.id}`,
    label: item.name,
    kind: "file" as const,
    fileKind: classifyDefenseFile(item.name),
  }));

  return [
    {
      id: "workspace-root",
      label: "智能点餐系统",
      kind: "folder",
      defaultOpen: true,
      children: [
        {
          id: "presentations",
          label: "演示资料",
          kind: "folder",
          defaultOpen: true,
          children: [
            fileNode("答辩 PPT.pdf"),
            fileNode("答辩原稿.pptx"),
            fileNode("项目报告.pdf"),
          ],
        },
        {
          id: "docs",
          label: "项目文档",
          kind: "folder",
          defaultOpen: true,
          children: [
            fileNode("README.md"),
            fileNode("项目速记.md"),
            {
              id: "docs-review",
              label: "答辩复盘",
              kind: "folder",
              children: [
                fileNode("高危追问清单.md"),
                fileNode("老师点评摘录.txt"),
                fileNode("下一轮讲练计划.md"),
              ],
            },
          ],
        },
        {
          id: "engineering",
          label: "代码与数据",
          kind: "folder",
          defaultOpen: true,
          children: [
            {
              id: "code",
              label: "backend",
              kind: "folder",
              children: [
                fileNode("routes/orders.ts"),
                fileNode("routes/kitchen.ts"),
                fileNode("backend.zip"),
              ],
            },
            {
              id: "data",
              label: "data",
              kind: "folder",
              children: [
                fileNode("orders.sql"),
                fileNode("订单数据.xlsx"),
                fileNode("metrics.csv"),
              ],
            },
          ],
        },
        {
          id: "latest",
          label: "本次追加",
          kind: "folder",
          defaultOpen: true,
          children: latestNodes,
        },
      ],
    },
  ];
}

function fileNode(name: string): UploadTreeNode {
  return {
    id: `file:${name}`,
    label: name,
    kind: "file",
    fileKind: classifyDefenseFile(name),
  };
}

function mergeMockTrayItems(
  trayItems: UploadTrayItem[],
  mockItems: UploadTrayItem[],
): UploadTrayItem[] {
  const merged = new Map<string, UploadTrayItem>();

  for (const item of [...trayItems, ...mockItems]) {
    const key = item.persistedKey ?? item.name;
    if (!merged.has(key)) merged.set(key, item);
  }

  return Array.from(merged.values());
}
