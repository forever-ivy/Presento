"use client";

import {
  CheckCircle2,
  Code2,
  DatabaseZap,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  MessageSquareText,
  Presentation,
  Search,
  Table2,
  Target,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
import {
  Conversation,
  ConversationEmptyState,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { File, Folder, Tree } from "@/components/magicui/file-tree";
import { SigmaKnowledgeGraph } from "@/components/sigma-knowledge-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FileExplanationSelectedContext } from "@/lib/file-explanation-context";
import {
  createWorkspaceKnowledgeMap,
  getKnowledgeNodeActivation,
  getKnowledgeNodeOpenAction,
  loadFileNodePreview,
  loadKnowledgeMap,
  mergeWorkspaceKnowledgeMap,
  type FilePreviewUi,
  type KnowledgeMapNodeUi,
  type KnowledgeMapUi,
} from "@/lib/knowledge-map-client";
import { useFileExplanationChat } from "@/lib/use-file-explanation-chat";
import type { FileExplanationStreamMessage } from "@/lib/file-explanation-stream";
import {
  getFileExplanationBusyLabel,
  getFileExplanationMessageCitations,
  getFileExplanationMessageText,
  getFileExplanationStarterPrompts,
} from "@/lib/file-explanation-chat-ui";
import {
  addProjectTrainingFocus,
  fetchProjectTrainingFocuses,
  removeProjectTrainingFocus,
  type TrainingFocusItem,
} from "@/lib/project-data-api";
import type { DefenseWorkspace } from "@/lib/project-workspace";
import { fetchProjectWorkspace } from "@/lib/project-workspace-api";
import { projectRoute } from "@/lib/project-routes";
import { shouldShowKnowledgeMapLoadingState } from "@/lib/knowledge-map-loading";
import {
  buildKnowledgeMapScene,
  projectKnowledgeMapScene,
  type KnowledgeMapScene,
  type KnowledgeMapSceneNode,
} from "@/lib/knowledge-map-scene";
import { cn } from "@/lib/utils";
import type { NotebookCitation, NotebookExplanationMode } from "@shared/domain";

const detailStateImages = {
  empty: {
    alt: "暂无资料",
    height: 921,
    src: "/states/detail-empty-transparent.png",
    width: 918,
  },
  loading: {
    alt: "正在加载",
    height: 829,
    src: "/states/detail-loading-transparent.png",
    width: 716,
  },
} as const;

const PdfFileViewer = dynamic(
  () => import("./pdf-file-viewer").then((module) => module.PdfFileViewer),
  {
    ssr: false,
    loading: () => <PreviewSkeleton variant="pdf" />,
  },
);

const CodeFileViewer = dynamic(
  () => import("./code-file-viewer").then((module) => module.CodeFileViewer),
  {
    ssr: false,
    loading: () => <PreviewSkeleton variant="code" />,
  },
);

const TableFileViewer = dynamic(
  () => import("./table-file-viewer").then((module) => module.TableFileViewer),
  {
    ssr: false,
    loading: () => <PreviewSkeleton variant="table" />,
  },
);

const DocumentFileViewer = dynamic(
  () => import("./document-file-viewer").then((module) => module.DocumentFileViewer),
  {
    ssr: false,
    loading: () => <PreviewSkeleton variant="document" />,
  },
);

const graphFilters = [
  { id: "all", label: "全部" },
  { id: "risk", label: "高危" },
  { id: "weakness", label: "薄弱点" },
  { id: "file", label: "文件" },
] as const;

type KnowledgeGraphFilter = (typeof graphFilters)[number]["id"];

const trainingFocusEligibleKinds = new Set(["project", "module", "risk", "weakness"]);

const overviewDetailMaxSize = "43%";
const overviewDetailMinReadableSize = "24%";
const overviewGraphMinSize = "57%";

type KnowledgeSigmaNode = {
  id: string;
  title: string;
  kind?: string;
  tone?: KnowledgeMapNodeUi["tone"];
  summary?: string;
  dimmed?: boolean;
  active?: boolean;
  depth?: 0 | 1 | 2 | 3;
  position?: { x: number; y: number };
  expandable?: boolean;
  expanded?: boolean;
  childCount?: number;
};

type KnowledgeSigmaEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  active?: boolean;
  kind?: string;
  emphasis?: "default" | "branch" | "active";
};

type KnowledgeReaderFileGroup = {
  id: string;
  label: string;
  count: number;
  children: KnowledgeReaderFileTreeNode[];
};

type KnowledgeReaderFileRelation = "active" | "evidence" | "related" | "normal";
type KnowledgeReaderFileOpenAction = "reader" | "scripts" | "disabled";
type KnowledgeReaderFileStatus = "ready" | "processing" | "failed" | "pending";

type KnowledgeReaderFileTreeNode =
  | {
      id: string;
      kind: "folder";
      label: string;
      count: number;
      children: KnowledgeReaderFileTreeNode[];
    }
  | {
      id: string;
      kind: "file";
      label: string;
      node: KnowledgeMapNodeUi;
      relation: KnowledgeReaderFileRelation;
      openAction: KnowledgeReaderFileOpenAction;
      status: KnowledgeReaderFileStatus;
      statusText?: string;
      pathParts: string[];
    };

function createEmptyKnowledgeMap(projectId: string): KnowledgeMapUi {
  return {
    edges: [],
    generation: { status: "idle" },
    nodes: [],
    projectId,
    source: "api",
  };
}

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function KnowledgeMapRoom({
  onReaderBackHandlerChange,
  onReaderModeChange,
  projectId,
}: {
  onReaderBackHandlerChange?: (handler: (() => void) | null) => void;
  onReaderModeChange?: (isReaderMode: boolean) => void;
  projectId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isNarrowLayout = useIsNarrowKnowledgeLayout();
  const [knowledgeMap, setKnowledgeMap] = useState<KnowledgeMapUi>(() => createEmptyKnowledgeMap(projectId));
  const [activeNodeId, setActiveNodeId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KnowledgeGraphFilter>("all");
  const [filterSlideDirection, setFilterSlideDirection] = useState<1 | -1>(1);
  const [expandedBranchIds, setExpandedBranchIds] = useState<Set<string>>(() => new Set());
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<DefenseWorkspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [readerNodeId, setReaderNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<NotebookExplanationMode>("quick");
  const [preview, setPreview] = useState<FilePreviewUi | null>(null);
  const [selectedQuestionContexts, setSelectedQuestionContexts] = useState<FileExplanationSelectedContext[]>([]);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [trainingFocuses, setTrainingFocuses] = useState<TrainingFocusItem[]>([]);
  const [trainingFocusError, setTrainingFocusError] = useState<string | null>(null);
  const [updatingTrainingFocusNodeId, setUpdatingTrainingFocusNodeId] = useState<string | null>(null);
  const showCreatedIntro = searchParams.get("intro") === "created";

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(async () => {
        if (cancelled) return null;
        setIsLoadingMap(true);
        setMapError(null);
        return loadKnowledgeMap(projectId);
      })
      .then((nextMap) => {
        if (!nextMap || cancelled) return;
        startTransition(() => {
          setKnowledgeMap(nextMap);
          setActiveNodeId((current) => nextMap.nodes.some((node) => node.id === current) ? current : nextMap.nodes[0]?.id ?? "");
          setExpandedBranchIds(new Set());
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setKnowledgeMap(createEmptyKnowledgeMap(projectId));
        setActiveNodeId("");
        setMapError(messageFromError(error, "知识地图读取失败。"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMap(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(async () => fetchProjectTrainingFocuses(projectId))
      .then((payload) => {
        if (cancelled) return;
        setTrainingFocuses(payload.focuses ?? []);
        setTrainingFocusError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setTrainingFocusError(messageFromError(error, "讲练重点读取失败。"));
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(async () => {
        if (cancelled) return null;
        setIsLoadingWorkspace(true);
        setWorkspaceError(null);
        return fetchProjectWorkspace(projectId);
      })
      .then((nextWorkspace) => {
        if (cancelled) return;
        setWorkspace(nextWorkspace);
      })
      .catch((error) => {
        if (cancelled) return;
        setWorkspace(null);
        setWorkspaceError(messageFromError(error, "项目资料状态读取失败。"));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingWorkspace(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const shouldHoldWorkspaceFallback = shouldShowKnowledgeMapLoadingState({
    apiNodeCount: knowledgeMap.nodes.length,
    generation: knowledgeMap.generation,
    isLoadingMap,
    isLoadingWorkspace,
    workspace,
  });
  const effectiveKnowledgeMap = useMemo(
    () => shouldHoldWorkspaceFallback ? knowledgeMap : mergeWorkspaceKnowledgeMap(knowledgeMap, workspace),
    [knowledgeMap, shouldHoldWorkspaceFallback, workspace],
  );
  const scene = useMemo(() => buildKnowledgeMapScene(effectiveKnowledgeMap), [effectiveKnowledgeMap]);
  const sanitizedExpandedBranchIds = useMemo(
    () => new Set(
      [...expandedBranchIds].filter((branchId) => scene.nodesById[branchId]?.depth === 1),
    ),
    [expandedBranchIds, scene],
  );
  const activeNode = useMemo(
    () => scene.nodesById[activeNodeId] ?? scene.nodesById[scene.rootId] ?? null,
    [activeNodeId, scene],
  );
  const overviewProjection = useMemo(
    () => projectKnowledgeMapScene(scene, {
      activeNodeId,
      expandedBranchIds: sanitizedExpandedBranchIds,
      filter,
      query,
    }),
    [activeNodeId, filter, query, sanitizedExpandedBranchIds, scene],
  );
  const workspaceKnowledgeMap = useMemo(
    () => workspace?.files.length ? createWorkspaceKnowledgeMap(workspace) : null,
    [workspace],
  );
  const readerNodesById = useMemo(() => {
    const nodesById = new Map<string, KnowledgeMapNodeUi>();
    for (const node of scene.nodes) nodesById.set(node.id, node);
    for (const node of workspaceKnowledgeMap?.nodes ?? []) {
      if (node.kind === "file" && !nodesById.has(node.id)) nodesById.set(node.id, node);
    }
    return nodesById;
  }, [scene.nodes, workspaceKnowledgeMap]);
  const readerSceneNode = useMemo(
    () => readerNodeId ? scene.nodesById[readerNodeId] ?? null : null,
    [readerNodeId, scene],
  );
  const readerNode = useMemo(
    () => readerNodeId ? readerNodesById.get(readerNodeId) ?? null : null,
    [readerNodeId, readerNodesById],
  );
  const readerFocusNode = useMemo(
    () => resolveReaderFocusNode(scene, activeNode, readerSceneNode),
    [activeNode, readerSceneNode, scene],
  );
  const readerFocusNodeId = readerFocusNode?.id;
  const readerFileGroups = useMemo(
    () => buildKnowledgeReaderFileGroups({
      activeFileNodeId: readerNodeId,
      focusNode: readerFocusNode ?? activeNode,
      scene,
      workspace,
    }),
    [activeNode, readerFocusNode, readerNodeId, scene, workspace],
  );
  const trainingFocusNodeIds = useMemo(
    () => new Set(trainingFocuses.map((focus) => focus.knowledgeNodeId)),
    [trainingFocuses],
  );
  const queryStateKey = searchParams.toString();
  const explanationChat = useFileExplanationChat({
    focusNodeId: readerFocusNodeId,
    focusNodeTitle: readerFocusNode?.title,
    mode,
    node: readerNode,
    projectId,
  });

  const replaceKnowledgeMapQuery = useCallback((next: {
    evidenceNodeId?: string | null;
    mode?: "overview" | "reader";
    nodeId?: string | null;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    params.delete("nodeId");
    params.delete("evidenceNodeId");
    if (next.mode === "reader") {
      params.set("mode", "reader");
      if (next.nodeId) params.set("nodeId", next.nodeId);
      if (next.evidenceNodeId) params.set("evidenceNodeId", next.evidenceNodeId);
    } else if (next.nodeId) {
      params.set("nodeId", next.nodeId);
    }
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!scene.nodes.length) return;
    const params = new URLSearchParams(queryStateKey);
    const modeParam = params.get("mode");
    const nodeIdParam = params.get("nodeId");
    const evidenceNodeIdParam = params.get("evidenceNodeId");

    if (modeParam === "reader" && evidenceNodeIdParam && readerNodesById.has(evidenceNodeIdParam)) {
      const evidenceSceneNode = scene.nodesById[evidenceNodeIdParam] ?? null;
      const focusNodeId = nodeIdParam && scene.nodesById[nodeIdParam]
        ? nodeIdParam
        : resolveReaderFocusNode(scene, null, evidenceSceneNode)?.id;
      startTransition(() => {
        if (focusNodeId) setActiveNodeId(focusNodeId);
        setSelectedQuestionContexts([]);
        setReaderNodeId(evidenceNodeIdParam);
      });
      return;
    }

    if (readerNodeId) {
      startTransition(() => {
        setSelectedQuestionContexts([]);
        setReaderNodeId(null);
      });
    }

    if (nodeIdParam && scene.nodesById[nodeIdParam] && !readerNodeId) {
      startTransition(() => setActiveNodeId(nodeIdParam));
    }
  }, [queryStateKey, readerNodeId, readerNodesById, scene]);

  useEffect(() => {
    onReaderModeChange?.(Boolean(readerNode));
  }, [onReaderModeChange, readerNode]);

  useEffect(() => () => {
    onReaderModeChange?.(false);
  }, [onReaderModeChange]);

  useEffect(() => {
    onReaderBackHandlerChange?.(() => {
      setSelectedQuestionContexts([]);
      setReaderNodeId(null);
      replaceKnowledgeMapQuery({ mode: "overview", nodeId: activeNodeId || scene.rootId });
    });
    return () => onReaderBackHandlerChange?.(null);
  }, [activeNodeId, onReaderBackHandlerChange, replaceKnowledgeMapQuery, scene.rootId]);

  const sigmaNodes = useMemo(
    () => overviewProjection.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      kind: node.kind,
      tone: node.tone,
      summary: node.summary,
      dimmed: node.dimmed,
      active: node.active,
      depth: node.depth,
      position: node.position,
      expandable: node.expandable,
      expanded: node.expanded,
      childCount: node.childCount,
      metadata: {
        fileKind: node.node.fileKind,
        riskLevel: node.node.riskLevel,
        semanticType: node.node.semanticType,
        path: node.path,
      },
    })),
    [overviewProjection.nodes],
  );
  const sigmaEdges = useMemo(
    () => overviewProjection.edges.map((edge) => ({
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      label: edge.label,
      active: edge.active,
      kind: edge.kind,
      emphasis: edge.emphasis,
    })),
    [overviewProjection.edges],
  );
  const introProjectTitle = workspace?.project.name || activeNode?.title || "新项目";

  useEffect(() => {
    let cancelled = false;
    if (!readerNode) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setPreview(null);
        setReaderError(null);
      });
      return () => {
        cancelled = true;
      };
    }

    void Promise.resolve()
      .then(async () => {
        if (cancelled) return;
        setReaderError(null);
        setPreview(null);
        const nextPreview = await loadFileNodePreview(projectId, readerNode, undefined, { focusNodeId: readerFocusNodeId });
        if (cancelled) return;
        setPreview(nextPreview);
      })
      .catch((error) => {
        if (cancelled) return;
        setReaderError(messageFromError(error, "资料预览读取失败。"));
        setPreview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, readerFocusNodeId, readerNode]);

  function handleNodeSelect(nodeId: string) {
    const node = scene.nodesById[nodeId];
    if (!node) return;

    startTransition(() => {
      setActiveNodeId(nodeId);
      setSelectedQuestionContexts([]);
      setReaderNodeId(null);
      if (node.depth === 1 && node.expandable) {
        setExpandedBranchIds((current) => {
          const next = new Set(current);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
        });
      }
    });
    replaceKnowledgeMapQuery({ mode: "overview", nodeId });
  }

  function handleNodeOpen(nodeId: string) {
    const node = scene.nodesById[nodeId];
    if (!node) return;
    if (node.kind === "training") {
      const action = typeof node.raw.metadata.action === "string" ? node.raw.metadata.action : undefined;
      if (action === "open-slide-script") {
        router.push(projectRoute(projectId, "scripts"));
        return;
      }
      if (action === "explain-file" && node.fileId) {
        const fileNode = scene.nodes.find((candidate) => candidate.kind === "file" && candidate.fileId === node.fileId);
        if (fileNode && getKnowledgeNodeActivation(fileNode) === "reader") {
          startTransition(() => {
            setActiveNodeId(fileNode.id);
            setSelectedQuestionContexts([]);
            setReaderNodeId(fileNode.id);
          });
          replaceKnowledgeMapQuery({
            evidenceNodeId: fileNode.id,
            mode: "reader",
            nodeId: activeNode?.id ?? scene.rootId,
          });
          return;
        }
      }
      if (action === "explain-file") {
        startTransition(() => {
          setActiveNodeId(node.id);
          setSelectedQuestionContexts([]);
          setReaderNodeId(null);
        });
        replaceKnowledgeMapQuery({ mode: "overview", nodeId: node.id });
        return;
      }
    }
    const activation = getKnowledgeNodeOpenAction({ ...node, metadata: node.raw.metadata });
    if (activation === "scripts") {
      router.push(projectRoute(projectId, "scripts"));
      return;
    }
    if (activation === "reader") {
      setSelectedQuestionContexts([]);
      setReaderNodeId(node.id);
      const focusNodeId = resolveReaderFocusNode(scene, activeNode, node)?.id ?? activeNode?.id ?? node.id;
      replaceKnowledgeMapQuery({
        evidenceNodeId: node.id,
        mode: "reader",
        nodeId: focusNodeId,
      });
      return;
    }
    startTransition(() => {
      setActiveNodeId(node.id);
      setSelectedQuestionContexts([]);
      setReaderNodeId(null);
    });
    replaceKnowledgeMapQuery({ mode: "overview", nodeId: node.id });
  }

  async function handleTrainingFocusToggle(nodeId: string) {
    const node = scene.nodesById[nodeId];
    if (!node || !isTrainingFocusEligible(node)) return;
    setUpdatingTrainingFocusNodeId(nodeId);
    setTrainingFocusError(null);
    try {
      const result = trainingFocusNodeIds.has(nodeId)
        ? await removeProjectTrainingFocus(projectId, nodeId)
        : await addProjectTrainingFocus(projectId, nodeId);
      setTrainingFocuses(result.focuses ?? []);
    } catch (error) {
      setTrainingFocusError(messageFromError(error, "讲练重点更新失败。"));
    } finally {
      setUpdatingTrainingFocusNodeId(null);
    }
  }

  function handleEvidenceOpen(evidenceNodeId: string) {
    const node = scene.nodesById[evidenceNodeId];
    if (!node) return;
    const activation = getKnowledgeNodeActivation(node);
    if (activation === "scripts") {
      router.push(projectRoute(projectId, "scripts"));
      return;
    }
    if (activation !== "reader") return;

    startTransition(() => {
      setSelectedQuestionContexts([]);
      setReaderNodeId(node.id);
    });
    replaceKnowledgeMapQuery({
      evidenceNodeId: node.id,
      mode: "reader",
      nodeId: activeNode?.id ?? scene.rootId,
    });
  }

  function handleReaderFileSelect(nodeId: string) {
    const node = readerNodesById.get(nodeId);
    if (!node) return;
    const activation = getKnowledgeNodeActivation(node);

    if (activation === "scripts") {
      router.push(projectRoute(projectId, "scripts"));
      return;
    }

    if (activation !== "reader") return;

    startTransition(() => {
      setSelectedQuestionContexts([]);
      setReaderNodeId(node.id);
    });
    replaceKnowledgeMapQuery({
      evidenceNodeId: node.id,
      mode: "reader",
      nodeId: readerFocusNodeId ?? activeNode?.id ?? scene.rootId,
    });
  }

  function handlePreviewContextAdd(context: FileExplanationSelectedContext) {
    setSelectedQuestionContexts((current) => {
      const next = [context, ...current.filter((item) => item.text !== context.text)];
      return next.slice(0, 3);
    });
  }

  function handlePreviewContextRemove(contextId: string) {
    setSelectedQuestionContexts((current) => current.filter((context) => context.id !== contextId));
  }

  async function handleExplanationSubmit(question: string) {
    await explanationChat.submit(question, selectedQuestionContexts);
    setSelectedQuestionContexts([]);
  }

  function handleFilterChange(nextFilter: KnowledgeGraphFilter) {
    if (nextFilter === filter) return;

    const currentIndex = graphFilters.findIndex((item) => item.id === filter);
    const nextIndex = graphFilters.findIndex((item) => item.id === nextFilter);
    setFilterSlideDirection(nextIndex >= currentIndex ? 1 : -1);

    startTransition(() => setFilter(nextFilter));
  }

  if (mapError || (!isLoadingMap && scene.nodes.length === 0)) {
    const emptyState = describeEmptyKnowledgeMapState({
      generation: knowledgeMap.generation,
      isLoadingWorkspace,
      mapError,
      workspace,
      workspaceError,
    });

    return (
      <KnowledgeResizableShell mode="overview">
        <KnowledgeMapStatePanel
          description={emptyState.description}
          loading={emptyState.loading}
          title={emptyState.title}
        />
      </KnowledgeResizableShell>
    );
  }

  if (isLoadingMap && scene.nodes.length === 0) {
    return (
      <KnowledgeResizableShell mode="overview">
        <KnowledgeMapStatePanel
          description="正在读取项目资料、文件节点和材料关系。"
          loading
          title="正在加载知识地图"
        />
      </KnowledgeResizableShell>
    );
  }

  const overviewActiveNode = activeNode ?? scene.nodes[0]!;

  return (
    <KnowledgeResizableShell mode={readerNode ? "reader" : "overview"}>
      <CreatedKnowledgeMapIntro
        nodeCount={sigmaNodes.length}
        projectTitle={introProjectTitle}
        show={showCreatedIntro && !readerNode && !isLoadingMap && !isLoadingWorkspace && sigmaNodes.length > 1}
      />
      {readerNode ? (
        <KnowledgeReaderPanels
          activeNodeId={readerNode.id}
          chatInput={explanationChat.input}
          chatMessages={explanationChat.messages}
          chatStatus={explanationChat.status}
          contextSelections={selectedQuestionContexts}
          fileGroups={readerFileGroups}
          isChatReady={explanationChat.isReady}
          isNarrowLayout={isNarrowLayout}
          mode={mode}
          onFileSelect={handleReaderFileSelect}
          onContextAdd={handlePreviewContextAdd}
          onContextRemove={handlePreviewContextRemove}
          onInputChange={explanationChat.setInput}
          onModeChange={setMode}
          onSubmit={handleExplanationSubmit}
          preview={preview}
          readerNode={readerNode}
          readerError={readerError ?? explanationChat.error}
        />
      ) : (
        <KnowledgeOverviewPanels
          activeNode={overviewActiveNode}
          activeNodeId={activeNodeId}
          edges={sigmaEdges}
          filter={filter}
          filterSlideDirection={filterSlideDirection}
          isNarrowLayout={isNarrowLayout}
          nodes={sigmaNodes}
          onEvidenceOpen={handleEvidenceOpen}
          onFilterChange={handleFilterChange}
          onNodeOpen={() => handleNodeOpen(overviewActiveNode.id)}
          onQueryChange={setQuery}
          onSelect={handleNodeSelect}
          onTrainingFocusToggle={handleTrainingFocusToggle}
          query={query}
          trainingFocusError={trainingFocusError}
          trainingFocusNodeIds={trainingFocusNodeIds}
          updatingTrainingFocusNodeId={updatingTrainingFocusNodeId}
        />
      )}
    </KnowledgeResizableShell>
  );
}

function describeEmptyKnowledgeMapState({
  generation,
  isLoadingWorkspace,
  mapError,
  workspace,
  workspaceError,
}: {
  generation: KnowledgeMapUi["generation"];
  isLoadingWorkspace: boolean;
  mapError: string | null;
  workspace: DefenseWorkspace | null;
  workspaceError: string | null;
}) {
  if (mapError) {
    return {
      description: mapError,
      loading: false,
      title: "知识地图读取失败",
    };
  }

  if (generation.status === "failed") {
    return {
      description: generation.error
        ? `表达地图生成失败：${generation.error}`
        : "表达地图生成失败，请检查模型配置后重新生成。",
      loading: false,
      title: "表达地图生成失败",
    };
  }

  if (generation.status === "queued" || generation.status === "running" || generation.status === "retryable") {
    return {
      description: "资料解析已完成，正在生成面向答辩讲点的表达地图。",
      loading: true,
      title: "表达地图生成中",
    };
  }

  if (isLoadingWorkspace) {
    return {
      description: "正在读取项目资料和后台处理状态。",
      loading: true,
      title: "正在检查资料状态",
    };
  }

  if (workspaceError) {
    return {
      description: workspaceError,
      loading: false,
      title: "项目资料状态读取失败",
    };
  }

  const files = workspace?.files ?? [];
  const tasks = workspace?.processingTasks ?? [];
  const processingTasks = tasks.filter((task) => task.status === "processing");
  const pendingTasks = tasks.filter((task) => task.status === "pending");
  const failedTasks = tasks.filter((task) => task.status === "failed");

  if (processingTasks.length) {
    return {
      description: `${files.length} 份资料已接入，${processingTasks.length} 个解析任务正在处理。完成后这里会显示文件、风险和训练入口。`,
      loading: true,
      title: "资料解析中",
    };
  }

  if (pendingTasks.length) {
    return {
      description: `${files.length} 份资料已接入，${pendingTasks.length} 个解析任务还在队列中。后台开始处理后会自动生成知识地图。`,
      loading: true,
      title: "资料已上传，等待解析",
    };
  }

  if (failedTasks.length) {
    const firstError = failedTasks.find((task) => task.error)?.error;
    return {
      description: firstError
        ? `${failedTasks.length} 个解析任务失败：${firstError}`
        : `${failedTasks.length} 个解析任务失败，请重新上传或检查文件格式。`,
      loading: false,
      title: "资料解析失败",
    };
  }

  if (files.length) {
    return {
      description: `${files.length} 份资料已接入，但还没有生成知识节点。后台处理完成后会显示知识地图。`,
      loading: false,
      title: "等待生成知识地图",
    };
  }

  return {
    description: "当前项目还没有可展示的知识地图数据。上传并处理资料后，这里会显示文件、风险和训练入口。",
    loading: false,
    title: "暂无知识地图",
  };
}

function useIsNarrowKnowledgeLayout() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const sync = () => setIsNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isNarrow;
}

function KnowledgeMapStatePanel({
  description,
  loading = false,
  title,
}: {
  description: string;
  loading?: boolean;
  title: string;
}) {
  const stateImage = detailStateImages[loading ? "loading" : "empty"];
  const shouldShowDescription = !loading && /失败|错误/u.test(title) && description.trim().length > 0;

  return (
    <section className="presento-detail-state presento-detail-state-knowledge">
      <Image
        alt={stateImage.alt}
        className="presento-detail-state-image"
        height={stateImage.height}
        priority={loading}
        sizes="(max-width: 768px) 70vw, 420px"
        src={stateImage.src}
        width={stateImage.width}
      />
      <div className="presento-detail-state-copy">
        <h2>{title}</h2>
        {shouldShowDescription ? <p>{description}</p> : null}
      </div>
    </section>
  );
}

function KnowledgeResizableShell({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "overview" | "reader";
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 32, mass: 0.82 };

  return (
    <div className="presento-knowledge-room">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          animate={{ opacity: 1, x: 0, scale: 1 }}
          className="presento-knowledge-mode"
          exit={{ opacity: 0, x: reduceMotion ? 0 : -18, scale: reduceMotion ? 1 : 0.992 }}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.992 }}
          key={mode}
          transition={transition}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function CreatedKnowledgeMapIntro({
  nodeCount,
  projectTitle,
  show,
}: {
  nodeCount: number;
  projectTitle: string;
  show: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), reduceMotion ? 700 : 2300);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion, show]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="presento-created-map-intro"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28 }}
        >
          <motion.div
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: [0.92, 1, 1.04], y: [18, 0, -8] }}
            className="presento-created-map-intro-node"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.72, y: 26 }}
            transition={{ duration: 0.86, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="presento-created-map-intro-pulse" aria-hidden="true" />
            <strong>{projectTitle}</strong>
            <small>项目原点</small>
          </motion.div>
          <motion.div
            animate={reduceMotion ? { opacity: 1 } : { opacity: [0, 1, 0.86], scale: [0.82, 1.04, 1] }}
            className="presento-created-map-intro-burst"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.78 }}
            transition={{ delay: reduceMotion ? 0 : 0.62, duration: 0.92, ease: [0.16, 1, 0.3, 1] }}
          >
            {Array.from({ length: Math.min(Math.max(nodeCount - 1, 4), 8) }).map((_, index) => (
              <span key={index} style={{ "--i": index } as CSSProperties} />
            ))}
          </motion.div>
          <motion.p
            animate={{ opacity: 1, y: 0 }}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            transition={{ delay: reduceMotion ? 0 : 0.9, duration: 0.4 }}
          >
            资料已接入，知识地图正在展开
          </motion.p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function KnowledgeOverviewPanels({
  activeNode,
  activeNodeId,
  edges,
  filter,
  filterSlideDirection,
  isNarrowLayout,
  nodes,
  onEvidenceOpen,
  onFilterChange,
  onNodeOpen,
  onQueryChange,
  onSelect,
  onTrainingFocusToggle,
  query,
  trainingFocusError,
  trainingFocusNodeIds,
  updatingTrainingFocusNodeId,
}: {
  activeNode: KnowledgeMapSceneNode;
  activeNodeId: string;
  edges: KnowledgeSigmaEdge[];
  filter: KnowledgeGraphFilter;
  filterSlideDirection: 1 | -1;
  isNarrowLayout: boolean;
  nodes: KnowledgeSigmaNode[];
  onEvidenceOpen: (nodeId: string) => void;
  onFilterChange: (filter: KnowledgeGraphFilter) => void;
  onNodeOpen: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (nodeId: string) => void;
  onTrainingFocusToggle: (nodeId: string) => void;
  query: string;
  trainingFocusError: string | null;
  trainingFocusNodeIds: Set<string>;
  updatingTrainingFocusNodeId: string | null;
}) {
  return (
    <div className="presento-knowledge-overview-shell">
      <ResizablePanelGroup
        className="presento-knowledge-resizable presento-knowledge-overview-resizable"
        orientation={isNarrowLayout ? "vertical" : "horizontal"}
      >
        <ResizablePanel defaultSize={isNarrowLayout ? "68%" : "72%"} minSize={overviewGraphMinSize}>
          <KnowledgeGraphPane
            activeNodeId={activeNodeId}
            edges={edges}
            filter={filter}
            filterSlideDirection={filterSlideDirection}
            nodes={nodes}
            onFilterChange={onFilterChange}
            onQueryChange={onQueryChange}
            onSelect={onSelect}
            query={query}
          />
        </ResizablePanel>
        <ResizableHandle className="presento-knowledge-resize-handle" withHandle />
        <ResizablePanel
          collapsedSize="0%"
          collapsible
          defaultSize={isNarrowLayout ? "32%" : "28%"}
          maxSize={overviewDetailMaxSize}
          minSize={overviewDetailMinReadableSize}
        >
          {nodes.length ? (
            <KnowledgeDetailPane
              node={activeNode}
              onOpenEvidence={onEvidenceOpen}
              onOpenReader={onNodeOpen}
              onTrainingFocusToggle={onTrainingFocusToggle}
              trainingFocusError={trainingFocusError}
              trainingFocusNodeIds={trainingFocusNodeIds}
              updatingTrainingFocusNodeId={updatingTrainingFocusNodeId}
            />
          ) : (
            <KnowledgeFilterDetailEmpty filter={filter} />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function KnowledgeFilterDetailEmpty({ filter }: { filter: KnowledgeGraphFilter }) {
  const copy = filterEmptyCopy(filter);
  return (
    <section className="presento-knowledge-pane presento-knowledge-detail-panel">
      <div className="presento-knowledge-detail-empty">
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
    </section>
  );
}

function KnowledgeGraphPane({
  activeNodeId,
  edges,
  filter,
  filterSlideDirection,
  nodes,
  onFilterChange,
  onQueryChange,
  onSelect,
  query,
}: {
  activeNodeId: string;
  edges: KnowledgeSigmaEdge[];
  filter: KnowledgeGraphFilter;
  filterSlideDirection: 1 | -1;
  nodes: KnowledgeSigmaNode[];
  onFilterChange: (filter: KnowledgeGraphFilter) => void;
  onQueryChange: (query: string) => void;
  onSelect: (nodeId: string) => void;
  query: string;
}) {
  const reduceMotion = useReducedMotion();
  const graphTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };
  const graphSlideVariants = {
    enter: (direction: number) => ({
      clipPath: reduceMotion
        ? "inset(0% 0% 0% 0%)"
        : direction > 0
          ? "inset(0% 12% 0% 0%)"
          : "inset(0% 0% 0% 12%)",
      opacity: reduceMotion ? 1 : 0,
      scale: reduceMotion ? 1 : 0.985,
      x: reduceMotion ? 0 : direction * 42,
    }),
    center: {
      clipPath: "inset(0% 0% 0% 0%)",
      opacity: 1,
      scale: 1,
      x: 0,
    },
    exit: (direction: number) => ({
      clipPath: reduceMotion
        ? "inset(0% 0% 0% 0%)"
        : direction > 0
          ? "inset(0% 0% 0% 12%)"
          : "inset(0% 12% 0% 0%)",
      opacity: reduceMotion ? 1 : 0,
      scale: reduceMotion ? 1 : 0.985,
      x: reduceMotion ? 0 : direction * -42,
    }),
  };

  return (
    <section className="presento-knowledge-pane presento-knowledge-graph-pane">
      <div className="presento-knowledge-graph-content">
        <div className="presento-knowledge-toolbar">
          <label className="presento-knowledge-search">
            <Search aria-hidden="true" />
            <input
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索节点 / 文件 / 风险问题"
              value={query}
            />
          </label>
          <div className="presento-knowledge-filter-row">
            <span className="presento-knowledge-filter-label">筛选</span>
            <Select value={filter} onValueChange={(nextFilter) => onFilterChange(nextFilter as KnowledgeGraphFilter)}>
              <SelectTrigger
                aria-label="筛选知识图谱节点"
                className="presento-knowledge-filter-select-trigger"
                data-testid="knowledge-map-filter-select-trigger"
                size="sm"
              >
                <SelectValue placeholder="选择筛选条件" />
              </SelectTrigger>
              <SelectContent className="presento-knowledge-filter-select-content" position="popper">
                <SelectGroup>
                  {graphFilters.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="presento-knowledge-graph-stage">
          {nodes.length ? (
            <AnimatePresence custom={filterSlideDirection} initial={false} mode="wait">
              <motion.div
                animate="center"
                className="presento-knowledge-graph-motion"
                custom={filterSlideDirection}
                exit="exit"
                initial="enter"
                key={filter}
                transition={graphTransition}
                variants={graphSlideVariants}
              >
                <SigmaKnowledgeGraph
                  activeId={activeNodeId}
                  edges={edges}
                  nodes={nodes}
                  onSelect={onSelect}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="presento-knowledge-filter-empty">
              <h3>{filterEmptyCopy(filter).title}</h3>
              <p>{filterEmptyCopy(filter).description}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function filterEmptyCopy(filter: KnowledgeGraphFilter) {
  if (filter === "weakness") {
    return {
      title: "还没有薄弱点",
      description: "薄弱点会在模拟讲练和复盘后生成；当前知识地图还没有这类节点。",
    };
  }
  if (filter === "risk") {
    return {
      title: "还没有风险节点",
      description: "当前知识地图暂时没有识别出高危追问或风险讲点。",
    };
  }
  if (filter === "file") {
    return {
      title: "还没有文件节点",
      description: "当前筛选下没有可展示的项目材料节点。",
    };
  }
  return {
    title: "没有匹配节点",
    description: "换一个筛选条件，或清空搜索后再查看。",
  };
}

function KnowledgeReaderPanels({
  activeNodeId,
  chatInput,
  chatMessages,
  chatStatus,
  contextSelections,
  fileGroups,
  isChatReady,
  isNarrowLayout,
  mode,
  onContextAdd,
  onContextRemove,
  onFileSelect,
  onInputChange,
  onModeChange,
  onSubmit,
  preview,
  readerNode,
  readerError,
}: {
  activeNodeId: string;
  chatInput: string;
  chatMessages: FileExplanationStreamMessage[];
  chatStatus: "loading-cache" | "submitted" | "streaming" | "ready" | "error";
  contextSelections: FileExplanationSelectedContext[];
  fileGroups: KnowledgeReaderFileGroup[];
  isChatReady: boolean;
  isNarrowLayout: boolean;
  mode: NotebookExplanationMode;
  onContextAdd: (context: FileExplanationSelectedContext) => void;
  onContextRemove: (contextId: string) => void;
  onFileSelect: (nodeId: string) => void;
  onInputChange: (value: string) => void;
  onModeChange: (mode: NotebookExplanationMode) => void;
  onSubmit: (question: string) => void | Promise<void>;
  preview: FilePreviewUi | null;
  readerNode: KnowledgeMapNodeUi;
  readerError: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const explanationPanelRef = useRef<PanelImperativeHandle | null>(null);
  const [isExplanationCollapsed, setIsExplanationCollapsed] = useState(false);
  const explanationCollapsedPercent = 0;
  const explanationPanelMotion: Pick<MotionProps, "animate" | "exit" | "initial" | "transition"> = reduceMotion
    ? {
        animate: { opacity: 1, scale: 1, x: 0 },
        exit: { opacity: 0, scale: 1, x: 0 },
        initial: { opacity: 0, scale: 1, x: 0 },
        transition: { duration: 0 },
      }
    : {
        animate: { opacity: 1, scale: 1, x: 0 },
        exit: { opacity: 0, scale: 0.992, x: -18 },
        initial: { opacity: 0, scale: 0.992, x: 18 },
        transition: { type: "spring", stiffness: 260, damping: 32, mass: 0.82 },
      };
  const handleExplanationResize = useCallback((panelSize: PanelSize) => {
    const isCollapsed = panelSize.asPercentage <= explanationCollapsedPercent + 0.5;
    setIsExplanationCollapsed((current) => (current === isCollapsed ? current : isCollapsed));
  }, [explanationCollapsedPercent]);
  return (
    <ResizablePanelGroup
      className="presento-knowledge-resizable presento-knowledge-reader-resizable"
      orientation={isNarrowLayout ? "vertical" : "horizontal"}
    >
      <ResizablePanel
        className="presento-knowledge-file-library-resizable-panel"
        defaultSize={isNarrowLayout ? "24%" : "220px"}
        maxSize={isNarrowLayout ? "32%" : "260px"}
        minSize="64px"
      >
        <KnowledgeFileLibraryPanel
          activeNodeId={activeNodeId}
          fileGroups={fileGroups}
          onFileSelect={onFileSelect}
        />
      </ResizablePanel>
      <ResizableHandle className="presento-knowledge-resize-handle" withHandle />
      <ResizablePanel defaultSize={isNarrowLayout ? "40%" : "52%"} minSize={isNarrowLayout ? "28%" : "30%"}>
        {preview ? (
          <FilePreviewPanel onContextAdd={onContextAdd} preview={preview} />
        ) : (
          <section className="presento-knowledge-pane presento-knowledge-preview-panel">
            <PreviewSkeleton variant={previewSkeletonVariant(readerNode)} />
          </section>
        )}
      </ResizablePanel>
      <ResizableHandle className="presento-knowledge-resize-handle" withHandle />
      <ResizablePanel
        collapsedSize={`${explanationCollapsedPercent}%`}
        collapsible
        defaultSize={isNarrowLayout ? "36%" : "34%"}
        minSize={isNarrowLayout ? "28%" : "22%"}
        onResize={handleExplanationResize}
        panelRef={explanationPanelRef}
      >
        <div className="presento-knowledge-explain-panel-shell">
          <AnimatePresence initial={false} mode="wait">
            {isExplanationCollapsed ? (
              null
            ) : (
              <motion.div className="presento-knowledge-explain-motion" key="explain-panel" {...explanationPanelMotion}>
                <ExplanationPanel
                  chatInput={chatInput}
                  chatMessages={chatMessages}
                  chatStatus={chatStatus}
                  contextSelections={contextSelections}
                  error={readerError}
                  isChatReady={isChatReady}
                  mode={mode}
                  nodeTitle={readerNode.title}
                  onContextRemove={onContextRemove}
                  onInputChange={onInputChange}
                  onModeChange={onModeChange}
                  onSubmit={onSubmit}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function KnowledgeFileLibraryPanel({
  activeNodeId,
  fileGroups,
  onFileSelect,
}: {
  activeNodeId: string;
  fileGroups: KnowledgeReaderFileGroup[];
  onFileSelect: (nodeId: string) => void;
}) {
  return (
    <section className="presento-knowledge-pane presento-knowledge-file-library-panel">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <ScrollArea className="presento-knowledge-file-library-scroll">
          <div className="presento-knowledge-file-library-tree">
            <Tree
              className="presento-knowledge-file-magic-tree"
              indicator={false}
              initialExpandedItems={expandedKnowledgeFileTreeIds(fileGroups)}
              initialSelectedId={activeNodeId}
              sort="none"
            >
              {fileGroups.map((group) => (
                <KnowledgeFileTreeNodeRow
                  activeNodeId={activeNodeId}
                  key={group.id}
                  node={{
                    children: group.children,
                    count: group.count,
                    id: group.id,
                    kind: "folder",
                    label: group.label,
                  }}
                  onFileSelect={onFileSelect}
                />
              ))}
            </Tree>
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}

function KnowledgeFileTreeNodeRow({
  activeNodeId,
  node,
  onFileSelect,
}: {
  activeNodeId: string;
  node: KnowledgeReaderFileTreeNode;
  onFileSelect: (nodeId: string) => void;
}) {
  if (node.kind === "file") {
    return (
      <KnowledgeFileTreeItem
        label={node.label}
        node={node.node}
        openAction={node.openAction}
        onSelect={onFileSelect}
        relation={node.relation}
        selected={node.node.id === activeNodeId}
        status={node.status}
        statusText={node.statusText}
      />
    );
  }

  return (
    <Folder
      className="presento-knowledge-file-folder-trigger"
      element={(
        <span className="presento-knowledge-file-folder-copy">
          <span>{node.label}</span>
          <small>{node.count}</small>
        </span>
      )}
      isSelectable
      value={node.id}
    >
      {node.children.map((child) => (
        <KnowledgeFileTreeNodeRow
          activeNodeId={activeNodeId}
          key={child.id}
          node={child}
          onFileSelect={onFileSelect}
        />
      ))}
    </Folder>
  );
}

function KnowledgeFileTreeItem({
  label,
  node,
  openAction,
  onSelect,
  relation,
  selected,
  status,
  statusText,
}: {
  label: string;
  node: KnowledgeMapNodeUi;
  openAction: KnowledgeReaderFileOpenAction;
  onSelect: (nodeId: string) => void;
  relation: KnowledgeReaderFileRelation;
  selected: boolean;
  status: KnowledgeReaderFileStatus;
  statusText?: string;
}) {
  const disabled = openAction === "disabled";
  const relationLabel = fileRelationLabel(relation);
  const statusLabel = status === "ready" ? null : fileStatusLabel(status, statusText);
  return (
    <File
      className={cn(
        "presento-knowledge-file-tree-item",
        selected && "presento-knowledge-file-tree-item-active",
        disabled && "presento-knowledge-file-tree-item-disabled",
        relation !== "normal" && `presento-knowledge-file-tree-item-${relation}`,
      )}
      fileIcon={<KnowledgeFileIcon node={node} />}
      handleSelect={() => {
        if (!disabled) onSelect(node.id);
      }}
      isSelectable={!disabled}
      isSelect={selected}
      value={node.id}
    >
      <span className="presento-knowledge-file-tree-copy">
        <strong>{label}</strong>
        <small>
          <span>{fileKindLabel(node)}</span>
          {relationLabel ? <em>{relationLabel}</em> : null}
          {statusLabel ? <em>{statusLabel}</em> : null}
        </small>
      </span>
    </File>
  );
}

function KnowledgeFileIcon({ node }: { node: KnowledgeMapNodeUi }) {
  if (node.fileKind === "presentation" || node.fileKind === "ppt" || node.fileKind === "pptx" || node.fileKind === "presentation-pdf") return <Presentation aria-hidden="true" />;
  if (node.fileKind === "code") return <FileCode2 aria-hidden="true" />;
  if (node.fileKind === "sql") return <DatabaseZap aria-hidden="true" />;
  if (node.fileKind === "xlsx" || node.fileKind === "csv") return <FileSpreadsheet aria-hidden="true" />;
  if (node.fileKind === "zip") return <FileArchive aria-hidden="true" />;
  return <FileText aria-hidden="true" />;
}

function KnowledgeDetailPane({
  node,
  onOpenEvidence,
  onOpenReader,
  onTrainingFocusToggle,
  trainingFocusError,
  trainingFocusNodeIds,
  updatingTrainingFocusNodeId,
}: {
  node: KnowledgeMapSceneNode;
  onOpenEvidence: (nodeId: string) => void;
  onOpenReader: () => void;
  onTrainingFocusToggle: (nodeId: string) => void;
  trainingFocusError: string | null;
  trainingFocusNodeIds: Set<string>;
  updatingTrainingFocusNodeId: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <aside className="presento-knowledge-pane presento-knowledge-detail-panel">
      <div className="presento-knowledge-detail-motion-stage">
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className="presento-knowledge-detail-motion"
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6, filter: reduceMotion ? "blur(0px)" : "blur(1px)" }}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8, filter: reduceMotion ? "blur(0px)" : "blur(1px)" }}
            key={node.id}
            transition={transition}
          >
            <NodeDetailContent
              node={node}
              onOpenEvidence={onOpenEvidence}
              onOpenReader={onOpenReader}
              onTrainingFocusToggle={onTrainingFocusToggle}
              trainingFocusError={trainingFocusError}
              trainingFocusNodeIds={trainingFocusNodeIds}
              updatingTrainingFocusNodeId={updatingTrainingFocusNodeId}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}

function NodeDetailContent({
  node,
  onOpenEvidence,
  onTrainingFocusToggle,
  onOpenReader,
  trainingFocusError,
  trainingFocusNodeIds,
  updatingTrainingFocusNodeId,
}: {
  node: KnowledgeMapSceneNode;
  onOpenEvidence: (nodeId: string) => void;
  onTrainingFocusToggle: (nodeId: string) => void;
  onOpenReader: () => void;
  trainingFocusError: string | null;
  trainingFocusNodeIds: Set<string>;
  updatingTrainingFocusNodeId: string | null;
}) {
  const activation = getKnowledgeNodeActivation(node);
  const openAction = getKnowledgeNodeOpenAction({ ...node, metadata: node.raw.metadata });
  const expression = node.expression;
  const evidenceRefs = node.evidenceRefs.slice(0, 3);
  const canToggleTrainingFocus = isTrainingFocusEligible(node);
  const isTrainingFocus = trainingFocusNodeIds.has(node.id);
  const isUpdatingTrainingFocus = updatingTrainingFocusNodeId === node.id;
  const oneSentence = expression?.oneSentence || node.summary || "这是一个需要定位清楚项目价值、实现方式和个人贡献的答辩讲点。";
  const talkTrack = expression?.talkTrack || node.actions[0] || "上台时先讲问题场景，再讲做法和取舍，最后落到项目材料与训练动作。";
  const topQuestion = expression?.topQuestion || node.riskQuestions[0] || "老师可能追问这个点的材料依据、边界和差异化。";
  const roleLabel = node.nodeRole === "mainline" ? "答辩主线" : node.nodeRole === "expression" ? "核心表达节点" : node.nodeRole === "evidence" ? "证据资料" : "答辩风险";
  return (
    <>
      <header className="presento-knowledge-pane-header">
        <div className="min-w-0">
          <div className="presento-knowledge-panel-eyebrow">
            <span>节点表达卡</span>
          </div>
          <h2 className="presento-knowledge-detail-title">{node.title}</h2>
          <p className="presento-knowledge-detail-meta">
            {roleLabel}
            {node.evidenceRefs.length ? ` · ${node.evidenceRefs.length} 份项目材料` : ""}
          </p>
        </div>
        <div className={cn("presento-knowledge-detail-mark", `presento-knowledge-detail-mark-${node.riskLevel}`)}>
          <Target aria-hidden="true" />
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="flex flex-col gap-4">
          <div className="presento-knowledge-detail-badges">
            <RiskBadge risk={node.riskLevel} />
            {node.nodeRole ? <Badge variant="outline">{node.nodeRole}</Badge> : <Badge variant="outline">{node.kind}</Badge>}
            {node.semanticType ? <Badge variant="secondary">{semanticTypeLabel(node.semanticType)}</Badge> : null}
            {node.fileKind ? <Badge variant="secondary">{node.fileKind}</Badge> : null}
            {node.expandable && node.childCount ? <Badge className="presento-knowledge-badge-soft">可展开 {node.childCount}</Badge> : null}
          </div>
          <ExpressionCardBlock title="一句话定位">
            {oneSentence}
          </ExpressionCardBlock>
          <ExpressionCardBlock title="答辩讲法">
            {talkTrack}
          </ExpressionCardBlock>
          <ExpressionCardBlock title="最可能被问" tone="risk">
            {topQuestion}
          </ExpressionCardBlock>
          <section className="presento-knowledge-detail-block">
            <div className="flex items-center gap-2 text-sm font-black">
              <FileText aria-hidden="true" />
              项目材料
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {evidenceRefs.length ? evidenceRefs.map((ref) => (
                <Button
                  className="presento-knowledge-evidence-chip"
                  key={`${node.id}-${ref.nodeId}`}
                  onClick={() => onOpenEvidence(ref.nodeId)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <FileText data-icon="inline-start" aria-hidden="true" />
                  {ref.label}
                </Button>
              )) : node.evidence.slice(0, 3).map((item) => (
                <span className="presento-knowledge-file-chip" key={item}>
                  <CheckCircle2 aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
      <div className="presento-knowledge-pane-actions">
        {canToggleTrainingFocus ? (
          <Button
            className={cn("presento-knowledge-primary-action", isTrainingFocus ? "presento-knowledge-primary-action-added" : "")}
            disabled={isUpdatingTrainingFocus}
            onClick={() => onTrainingFocusToggle(node.id)}
            type="button"
            variant={isTrainingFocus ? "outline" : "default"}
          >
            <Target data-icon="inline-start" aria-hidden="true" />
            {isUpdatingTrainingFocus ? "正在更新..." : isTrainingFocus ? "已加入讲练重点" : "加入讲练重点"}
          </Button>
        ) : openAction === "reader" || openAction === "scripts" ? (
          <Button className="presento-knowledge-primary-action" onClick={onOpenReader} type="button">
            {activation === "reader" ? "查看项目材料" : "查看逐页讲稿"}
          </Button>
        ) : null}
        {evidenceRefs.length ? (
          <Button className="presento-knowledge-secondary-action" onClick={() => onOpenEvidence(evidenceRefs[0].nodeId)} type="button" variant="outline">
            查看材料
          </Button>
        ) : null}
        {trainingFocusError ? <p className="text-xs font-bold text-[#c56a09]">{trainingFocusError}</p> : null}
      </div>
    </>
  );
}

function ExpressionCardBlock({
  children,
  title,
  tone,
}: {
  children: ReactNode;
  title: string;
  tone?: "risk";
}) {
  return (
    <section className={cn("presento-knowledge-expression-block", tone === "risk" && "presento-knowledge-expression-block-risk")}>
      <div className="presento-knowledge-expression-label">{title}</div>
      <p>{children}</p>
    </section>
  );
}

function FilePreviewPanel({
  onContextAdd,
  preview,
}: {
  onContextAdd: (context: FileExplanationSelectedContext) => void;
  preview: FilePreviewUi;
}) {
  const [previewZoom, setPreviewZoom] = useState(1);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const pdfFallback = <PdfPreview preview={preview} />;
  const codeFallback = <CodePreview preview={preview} />;
  const tableFallback = <TablePreview preview={preview} />;
  const docFallback = <DocPreview preview={preview} />;
  const zoomLabel = `${Math.round(previewZoom * 100)}%`;
  const changeZoom = useCallback((delta: number) => {
    setPreviewZoom((current) => Math.min(1.8, Math.max(0.7, Number((current + delta).toFixed(2)))));
  }, []);
  const resetZoom = useCallback(() => setPreviewZoom(1), []);
  const shouldFillPreview = preview.viewer === "code" || preview.viewer === "sql" || preview.viewer === "table";
  const previewZoomStyle = {
    "--presento-preview-inverse-zoom": Number((1 / previewZoom).toFixed(4)),
    "--presento-preview-zoom": previewZoom,
  } as CSSProperties;

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    window.addEventListener("click", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
    };
  }, [closeContextMenu, contextMenu]);

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().replace(/\s+/gu, " ").trim() ?? "";
    if (!selectedText || !previewRef.current || !selection?.rangeCount) return;
    const anchorNode = selection.anchorNode;
    if (anchorNode && !previewRef.current.contains(anchorNode)) return;
    event.preventDefault();
    const panelRect = previewRef.current.getBoundingClientRect();
    const menuOffset = 10;
    setContextMenu({
      x: Math.max(12, Math.min(event.clientX + menuOffset, panelRect.right - 176)),
      y: Math.max(12, Math.min(event.clientY + menuOffset, panelRect.bottom - 48)),
      text: selectedText.slice(0, 1200),
    });
  }

  function addSelectedContext() {
    if (!contextMenu) return;
    onContextAdd({
      id: `selected-context-${Date.now()}`,
      text: contextMenu.text,
      fileName: preview.fileName ?? preview.title,
    });
    setContextMenu(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <section
      className="presento-knowledge-pane presento-knowledge-preview-panel"
      onContextMenu={handleContextMenu}
      ref={previewRef}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="presento-knowledge-preview-scroll">
          <div
            className={cn(
              "presento-knowledge-preview-zoom-stage",
              shouldFillPreview && "presento-knowledge-preview-zoom-stage-fill",
            )}
            style={previewZoomStyle}
          >
            <div
              className={cn(
                "presento-knowledge-preview-zoom-content",
                shouldFillPreview && "presento-knowledge-preview-zoom-content-fill",
              )}
            >
              {preview.viewer === "pdf" ? <PdfFileViewer fallback={pdfFallback} preview={preview} /> : null}
              {preview.viewer === "docx" ? <DocumentFileViewer key={preview.fileId ?? preview.assetUrl ?? preview.fileName ?? preview.title} preview={preview} /> : null}
              {preview.viewer === "code" || preview.viewer === "sql" ? <CodeFileViewer fallback={codeFallback} preview={preview} /> : null}
              {preview.viewer === "table" ? <TableFileViewer fallback={tableFallback} preview={preview} /> : null}
              {preview.viewer === "details" || preview.viewer === "presentation" ? docFallback : null}
            </div>
          </div>
        </div>
      </div>
      <div className="presento-knowledge-preview-zoom-actions" aria-label={`预览缩放 ${zoomLabel}`}>
        <Button aria-label="缩小预览" onClick={() => changeZoom(-0.1)} size="icon-xs" type="button" variant="ghost">
          <ZoomOut data-icon="inline-start" aria-hidden="true" />
        </Button>
        <Button aria-label="重置预览缩放" onClick={resetZoom} size="icon-xs" type="button" variant="ghost">
          <span aria-hidden="true">1</span>
        </Button>
        <Button aria-label="放大预览" onClick={() => changeZoom(0.1)} size="icon-xs" type="button" variant="ghost">
          <ZoomIn data-icon="inline-start" aria-hidden="true" />
        </Button>
      </div>
      {contextMenu ? (
        <div
          className="presento-selection-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={addSelectedContext} type="button">
            添加为提问上下文
          </button>
        </div>
      ) : null}
    </section>
  );
}

function PreviewSkeleton({ variant = "document" }: { variant?: "code" | "document" | "pdf" | "table" }) {
  const rows = variant === "table" ? 8 : variant === "code" ? 12 : variant === "pdf" ? 6 : 5;

  return (
    <div className={cn("presento-preview-skeleton", `presento-preview-skeleton-${variant}`)}>
      <Skeleton className="presento-preview-skeleton-title" />
      <div className="presento-preview-skeleton-body">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton
            className="presento-preview-skeleton-line"
            key={index}
            style={{ width: `${index % 3 === 0 ? 72 : index % 3 === 1 ? 92 : 82}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function previewSkeletonVariant(node: KnowledgeMapNodeUi): "code" | "document" | "pdf" | "table" {
  if (node.viewer === "code" || node.viewer === "sql") return "code";
  if (node.viewer === "table") return "table";
  if (node.viewer === "pdf" || node.viewer === "presentation") return "pdf";
  return "document";
}

function ExplanationPanel({
  chatInput,
  chatMessages,
  chatStatus,
  contextSelections,
  error,
  isChatReady,
  mode,
  nodeTitle,
  onContextRemove,
  onInputChange,
  onModeChange,
  onSubmit,
}: {
  chatInput: string;
  chatMessages: FileExplanationStreamMessage[];
  chatStatus: "loading-cache" | "submitted" | "streaming" | "ready" | "error";
  contextSelections: FileExplanationSelectedContext[];
  error: string | null;
  isChatReady: boolean;
  mode: NotebookExplanationMode;
  nodeTitle: string;
  onContextRemove: (contextId: string) => void;
  onInputChange: (value: string) => void;
  onModeChange: (mode: NotebookExplanationMode) => void;
  onSubmit: (question: string) => void | Promise<void>;
}) {
  const isBusy = chatStatus === "loading-cache" || chatStatus === "submitted" || chatStatus === "streaming";
  const starterPrompts = useMemo(
    () => getFileExplanationStarterPrompts(mode, nodeTitle),
    [mode, nodeTitle],
  );
  const busyLabel = getFileExplanationBusyLabel(chatStatus);
  const displayTitle = useMemo(() => basenameFromDisplayPath(nodeTitle), [nodeTitle]);

  async function submitQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !isChatReady || isBusy) return;
    await onSubmit(trimmed);
  }

  return (
    <section className="presento-knowledge-pane presento-knowledge-explain-panel">
      <header className="presento-knowledge-pane-header">
        <div className="flex items-center gap-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-emerald-50">
            <Image
              alt=""
              aria-hidden="true"
              className="object-cover"
              fill
              sizes="56px"
              src="/brand/knowledge-guide-thinking.png"
            />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-[var(--presento-ink)]" title={displayTitle}>
              {displayTitle}
            </h2>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Tabs onValueChange={(value) => onModeChange(value as NotebookExplanationMode)} value={mode}>
          <TabsList className="w-full">
            <TabsTrigger value="quick">速通模式</TabsTrigger>
            <TabsTrigger value="mastery">精通模式</TabsTrigger>
          </TabsList>
        </Tabs>
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold leading-6 text-red-700">
            {error}
          </p>
        ) : null}
        <Conversation className="presento-knowledge-conversation">
          {chatMessages.length === 0 && !isBusy ? (
            <ConversationEmptyState
              className="px-5 py-6"
              description="先让 AI 帮你速通材料，再继续追问答辩时最容易被卡住的点。"
              title="围绕当前资料开始对话"
            >
              <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50">
                  <MessageSquareText className="size-7 text-emerald-700" />
                </div>
                <div>
                  <div className="text-sm font-black text-[var(--presento-ink)]">像正式答辩前排练一样继续问</div>
                  <div className="mt-1 text-xs font-semibold leading-6 text-[var(--presento-muted)]">
                    你可以先让它帮你讲清材料，再追问高风险点、核心函数、老师可能继续问的问题。
                  </div>
                </div>
                <div className="flex w-full flex-wrap justify-center gap-2">
                  {starterPrompts.map((prompt) => (
                    <Button
                      className="h-auto max-w-full whitespace-normal rounded-full px-4 py-2 text-left text-xs font-bold leading-5"
                      disabled={!isChatReady}
                      key={prompt}
                      onClick={() => {
                        void submitQuestion(prompt);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            <ConversationContent className="gap-5 px-4 py-4">
              {chatMessages.map((message) => {
                const text = getFileExplanationMessageText(message);
                const citations = getFileExplanationMessageCitations(message);
                if (!text && citations.length === 0) return null;
                return (
                  <Message from={message.role} key={message.id}>
                    <MessageContent className="text-[15px] leading-7">
                      {text ? <MessageResponse>{text}</MessageResponse> : null}
                      {citations.length > 0 ? (
                        <Sources className="mt-3">
                          <SourcesTrigger count={citations.length}>材料来源 {citations.length}</SourcesTrigger>
                          <SourcesContent>
                            {citations.map((citation, index) => (
                              <Source
                                href="#"
                                key={`${citation.fileName ?? citation.codePath ?? citation.fileId ?? "citation"}-${index}`}
                                onClick={(event) => event.preventDefault()}
                                title={formatCitationLabel(citation)}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      ) : null}
                    </MessageContent>
                  </Message>
                );
              })}
              {isBusy && busyLabel ? (
                <Message from="assistant">
                  <MessageContent className="text-[15px]">
                    <div className="flex items-center gap-3 text-sm font-bold text-[var(--presento-muted)]">
                      <Loader className="border-emerald-200 border-t-emerald-700" />
                      <span>{busyLabel}</span>
                    </div>
                  </MessageContent>
                </Message>
              ) : null}
            </ConversationContent>
          )}
        </Conversation>
        {contextSelections.length > 0 ? (
          <div className="presento-selected-contexts" aria-label="已添加的提问上下文">
            {contextSelections.map((context) => (
              <button
                className="presento-selected-context-chip"
                key={context.id}
                onClick={() => onContextRemove(context.id)}
                title="点击移除这段上下文"
                type="button"
              >
                <span>{context.text}</span>
                <small>移除</small>
              </button>
            ))}
          </div>
        ) : null}
        <PromptInput
          onSubmit={(message) => submitQuestion(message.text)}
        >
          <PromptInputBody>
            <PromptInputTextarea
              disabled={!isChatReady}
              onChange={(event) => onInputChange(event.currentTarget.value)}
              placeholder={isChatReady ? "继续追问当前资料" : "AI 正在准备当前资料的上下文"}
              value={chatInput}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools aria-hidden="true" />
            <PromptInputSubmit
              disabled={!chatInput.trim() || !isChatReady}
              status={chatStatus === "streaming" ? "streaming" : chatStatus === "submitted" ? "submitted" : "ready"}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}

function formatCitationLabel(citation: NotebookCitation) {
  const source = citation.fileName ?? citation.codePath ?? citation.fileId ?? "当前材料";
  const location =
    typeof citation.lineStart === "number"
      ? `第 ${citation.lineStart}${typeof citation.lineEnd === "number" && citation.lineEnd !== citation.lineStart ? `-${citation.lineEnd}` : ""} 行`
      : typeof citation.page === "number"
        ? `第 ${citation.page} 页`
        : typeof citation.slide === "number"
          ? `第 ${citation.slide} 页`
          : typeof citation.sheet === "string"
            ? citation.sheet
            : "";
  return location ? `${source} · ${location}` : source;
}

function basenameFromDisplayPath(value: string) {
  return value
    .replace(/[》]+$/u, "")
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .at(-1) || value;
}

function PdfPreview({ preview }: { preview: FilePreviewUi }) {
  const pages = preview.pages.length ? preview.pages : [{ page: 1, title: preview.title, text: preview.text }];
  return (
    <div className="flex flex-col gap-3">
      {pages.map((page) => (
        <article className="presento-knowledge-pdf-page" key={page.page}>
          <div className="text-xs font-black text-[var(--presento-muted)]">Page {page.page}</div>
          <h3>{page.title}</h3>
          <p>{page.text}</p>
        </article>
      ))}
    </div>
  );
}

function DocPreview({ preview }: { preview: FilePreviewUi }) {
  return (
    <div className="presento-knowledge-doc">
      <p>{preview.text || "当前资料暂无正文预览，AI 会基于已解析片段进行讲解。"}</p>
    </div>
  );
}

function CodePreview({ preview }: { preview: FilePreviewUi }) {
  const lines = preview.text.split("\n").filter(Boolean);
  return (
    <div className="presento-knowledge-code">
      <div className="presento-knowledge-code-header">
        <Code2 aria-hidden="true" />
        <span>{preview.codePath ?? preview.title}</span>
      </div>
      <pre>
        {lines.map((line, index) => (
          <code key={`${line}-${index}`}>
            <span>{index + 1}</span>
            {line}
          </code>
        ))}
      </pre>
    </div>
  );
}

function TablePreview({ preview }: { preview: FilePreviewUi }) {
  return (
    <div className="presento-knowledge-table-wrap">
      <div className="mb-3 flex items-center gap-2 text-sm font-black">
        <Table2 aria-hidden="true" />
        {preview.sheetName ?? "工作表"}
      </div>
      <table className="presento-knowledge-table">
        <thead>
          <tr>
            {preview.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, index) => (
            <tr key={`row-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBadge({ risk }: { risk: KnowledgeMapNodeUi["riskLevel"] }) {
  if (risk === "high") return <Badge className="presento-risk-badge presento-risk-badge-high">高风险</Badge>;
  if (risk === "low") return <Badge className="presento-risk-badge presento-risk-badge-low">低风险</Badge>;
  return <Badge className="presento-risk-badge presento-risk-badge-medium">中风险</Badge>;
}

function semanticTypeLabel(value: string) {
  if (value === "api") return "接口";
  if (value === "table") return "数据表";
  if (value === "flow") return "流程";
  if (value === "architecture") return "架构";
  return "功能模块";
}

function isTrainingFocusEligible(node: KnowledgeMapSceneNode) {
  return trainingFocusEligibleKinds.has(node.kind);
}

function buildKnowledgeReaderFileGroups({
  activeFileNodeId,
  focusNode,
  scene,
  workspace,
}: {
  activeFileNodeId?: string | null;
  focusNode: KnowledgeMapSceneNode | null;
  scene: KnowledgeMapScene;
  workspace: DefenseWorkspace | null;
}): KnowledgeReaderFileGroup[] {
  const sceneFileNodes = scene.nodes
    .filter((node) => node.kind === "file")
    .toSorted((left, right) => left.order - right.order);
  const sceneFileNodesByFileId = new Map(sceneFileNodes.map((node) => [node.fileId, node]).filter((entry): entry is [string, KnowledgeMapSceneNode] => Boolean(entry[0])));
  const workspaceMap = workspace?.files.length ? createWorkspaceKnowledgeMap(workspace) : null;
  const workspaceFileNodes = workspaceMap?.nodes.filter((node) => node.kind === "file") ?? [];
  const fileItemsByFileId = new Map<string, Extract<KnowledgeReaderFileTreeNode, { kind: "file" }>>();
  const relationContext = createReaderRelationContext(scene, focusNode, activeFileNodeId);

  for (const workspaceNode of workspaceFileNodes) {
    if (!workspaceNode.fileId) continue;
    const sceneNode = sceneFileNodesByFileId.get(workspaceNode.fileId);
    const displayNode = sceneNode ?? workspaceNode;
    fileItemsByFileId.set(workspaceNode.fileId, createReaderFileItem({
      displayNode,
      pathNode: workspaceNode,
      relationContext,
      sceneNode,
      workspace,
    }));
  }

  for (const sceneNode of sceneFileNodes) {
    if (sceneNode.fileId && fileItemsByFileId.has(sceneNode.fileId)) continue;
    const key = sceneNode.fileId ?? sceneNode.id;
    fileItemsByFileId.set(key, createReaderFileItem({
      displayNode: sceneNode,
      relationContext,
      sceneNode,
      workspace,
    }));
  }

  const fileItems = [...fileItemsByFileId.values()]
    .toSorted(compareReaderFileItems);
  if (!fileItems.length) return [];

  const projectNode = scene.nodesById[scene.rootId];
  const label = workspace?.project.name?.trim() || projectNode?.title?.trim() || "项目资料";
  return [{
    id: `file-group-${scene.projectId}`,
    label,
    count: fileItems.length,
    children: buildKnowledgeFilePathTree(fileItems),
  }];
}

function createReaderRelationContext(
  scene: KnowledgeMapScene,
  focusNode: KnowledgeMapSceneNode | null,
  activeFileNodeId?: string | null,
) {
  const activeNode = activeFileNodeId ? scene.nodesById[activeFileNodeId] : null;
  const evidenceNodeIds = new Set<string>();
  const evidenceFileIds = new Set<string>();
  const relatedFileIds = new Set<string>();
  const focusMainlineIds = new Set<string>();

  if (focusNode) {
    for (const ref of focusNode.evidenceRefs) {
      evidenceNodeIds.add(ref.nodeId);
      const evidenceNode = scene.nodesById[ref.nodeId];
      if (evidenceNode?.fileId) evidenceFileIds.add(evidenceNode.fileId);
    }
    for (const parentId of [...focusNode.parentIds, ...focusNode.sceneParentIds]) {
      const parent = scene.nodesById[parentId];
      if (parent?.nodeRole === "mainline" || parent?.layer === 1) focusMainlineIds.add(parent.id);
    }
  }

  if (focusMainlineIds.size) {
    for (const node of scene.nodes) {
      if (node.kind !== "file" || !node.fileId) continue;
      const parentIds = new Set([...node.parentIds, ...node.sceneParentIds]);
      if ([...focusMainlineIds].some((mainlineId) => parentIds.has(mainlineId))) {
        relatedFileIds.add(node.fileId);
      }
    }
  }

  return {
    activeFileId: activeNode?.fileId,
    activeNodeId: activeNode?.id ?? activeFileNodeId ?? undefined,
    evidenceFileIds,
    evidenceNodeIds,
    relatedFileIds,
  };
}

function createReaderFileItem({
  displayNode,
  pathNode,
  relationContext,
  sceneNode,
  workspace,
}: {
  displayNode: KnowledgeMapNodeUi;
  pathNode?: KnowledgeMapNodeUi;
  relationContext: ReturnType<typeof createReaderRelationContext>;
  sceneNode?: KnowledgeMapSceneNode;
  workspace: DefenseWorkspace | null;
}): Extract<KnowledgeReaderFileTreeNode, { kind: "file" }> {
  const task = displayNode.fileId
    ? workspace?.processingTasks.find((item) => item.fileId === displayNode.fileId)
    : undefined;
  const status = readerFileStatus(task, Boolean(sceneNode));
  const relation = readerFileRelation(displayNode, relationContext);
  const activation = getKnowledgeNodeActivation(sceneNode ?? displayNode);
  const openAction = status === "ready" && (activation === "reader" || activation === "scripts")
    ? activation
    : "disabled";
  return {
    id: `file-${displayNode.id}`,
    kind: "file",
    label: knowledgeFilePathParts(pathNode ?? displayNode).at(-1) ?? displayNode.title ?? "未命名资料",
    node: displayNode,
    openAction,
    pathParts: knowledgeFilePathParts(pathNode ?? displayNode),
    relation,
    status,
    statusText: task?.error,
  };
}

function readerFileRelation(
  node: KnowledgeMapNodeUi,
  context: ReturnType<typeof createReaderRelationContext>,
): KnowledgeReaderFileRelation {
  if (node.id === context.activeNodeId || (node.fileId && node.fileId === context.activeFileId)) return "active";
  if (context.evidenceNodeIds.has(node.id) || (node.fileId && context.evidenceFileIds.has(node.fileId))) return "evidence";
  if (node.fileId && context.relatedFileIds.has(node.fileId)) return "related";
  return "normal";
}

function readerFileStatus(task: DefenseWorkspace["processingTasks"][number] | undefined, hasSceneNode: boolean): KnowledgeReaderFileStatus {
  if (task?.status === "completed") return "ready";
  if (task?.status === "failed") return "failed";
  if (task?.status === "processing") return "processing";
  if (task?.status === "pending") return "pending";
  if (!task && !hasSceneNode) return "ready";
  return "ready";
}

function compareReaderFileItems(
  left: Extract<KnowledgeReaderFileTreeNode, { kind: "file" }>,
  right: Extract<KnowledgeReaderFileTreeNode, { kind: "file" }>,
) {
  return left.pathParts.join("/").localeCompare(right.pathParts.join("/"), "zh-Hans-CN");
}

function resolveReaderFocusNode(
  scene: KnowledgeMapScene,
  activeNode: KnowledgeMapSceneNode | null,
  readerNode: KnowledgeMapSceneNode | null,
) {
  if (activeNode?.nodeRole === "expression") return activeNode;
  if (activeNode?.kind === "module" && activeNode.layer === 2) return activeNode;
  if (!readerNode) return activeNode?.nodeRole === "mainline" ? activeNode : null;

  const expressionParentId = readerNode.parentIds.find((parentId) => {
    const parent = scene.nodesById[parentId];
    return parent?.nodeRole === "expression" || (parent?.kind === "module" && parent.layer === 2);
  });
  if (expressionParentId) return scene.nodesById[expressionParentId] ?? null;

  const sceneParentId = readerNode.sceneParentIds.find((parentId) => {
    const parent = scene.nodesById[parentId];
    return parent?.nodeRole === "expression" || (parent?.kind === "module" && parent.layer === 2);
  });
  return sceneParentId ? scene.nodesById[sceneParentId] ?? null : activeNode;
}

function buildKnowledgeFilePathTree(nodes: Extract<KnowledgeReaderFileTreeNode, { kind: "file" }>[]): KnowledgeReaderFileTreeNode[] {
  const root: KnowledgeReaderMutableFolder = {
    children: new Map(),
    files: [],
    id: "root",
    label: "root",
  };

  for (const item of nodes) {
    const path = item.pathParts;
    let folder = root;
    for (const segment of path.slice(0, -1)) {
      const existing = folder.children.get(segment);
      if (existing) {
        folder = existing;
        continue;
      }
      const nextFolder: KnowledgeReaderMutableFolder = {
        children: new Map(),
        files: [],
        id: `${folder.id}/${segment}`,
        label: segment,
      };
      folder.children.set(segment, nextFolder);
      folder = nextFolder;
    }
    folder.files.push(item);
  }

  return materializeKnowledgeFileTree(root);
}

function expandedKnowledgeFileTreeIds(fileGroups: KnowledgeReaderFileGroup[]) {
  const ids: string[] = [];
  const visit = (node: KnowledgeReaderFileTreeNode) => {
    if (node.kind !== "folder") return;
    ids.push(node.id);
    node.children.forEach(visit);
  };

  for (const group of fileGroups) {
    ids.push(group.id);
    group.children.forEach(visit);
  }

  return ids;
}

type KnowledgeReaderMutableFolder = {
  id: string;
  label: string;
  children: Map<string, KnowledgeReaderMutableFolder>;
  files: Extract<KnowledgeReaderFileTreeNode, { kind: "file" }>[];
};

function materializeKnowledgeFileTree(folder: KnowledgeReaderMutableFolder): KnowledgeReaderFileTreeNode[] {
  const childFolders: KnowledgeReaderFileTreeNode[] = [...folder.children.values()]
    .toSorted((left, right) => left.label.localeCompare(right.label, "zh-Hans-CN"))
    .map((child) => {
      const children = materializeKnowledgeFileTree(child);
      return {
        id: `folder-${child.id}`,
        kind: "folder",
        label: child.label,
        count: countKnowledgeFileTreeItems(children),
        children,
      };
    });
  const files = folder.files.toSorted((left, right) => {
    return compareReaderFileItems(left, right);
  });
  return [...childFolders, ...files];
}

function countKnowledgeFileTreeItems(nodes: KnowledgeReaderFileTreeNode[]): number {
  return nodes.reduce((count, node) => count + (node.kind === "file" ? 1 : node.count), 0);
}

function knowledgeFilePathParts(node: KnowledgeMapNodeUi) {
  const fallbackName = node.title || node.preview.fileName || "未命名资料";
  const path = node.preview.fileName || node.title || fallbackName;
  const parts = path
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..");
  return parts.length ? parts : [fallbackName];
}

function fileRelationLabel(relation: KnowledgeReaderFileRelation) {
  if (relation === "active") return "当前";
  if (relation === "evidence") return "材料";
  if (relation === "related") return "相关";
  return "";
}

function fileStatusLabel(status: KnowledgeReaderFileStatus, statusText?: string) {
  if (status === "processing") return "解析中";
  if (status === "failed") return statusText ? "解析失败" : "失败";
  if (status === "pending") return "待解析";
  return "";
}

function fileKindLabel(node: KnowledgeMapNodeUi) {
  if (node.fileKind === "presentation-pdf") return "PPT 讲稿";
  if (node.fileKind === "presentation" || node.fileKind === "ppt" || node.fileKind === "pptx") return "PPT 原稿";
  if (node.fileKind === "pdf") return "PDF 文档";
  if (node.fileKind === "document" || node.fileKind === "docx") return "项目文档";
  if (node.fileKind === "code") return "代码文件";
  if (node.fileKind === "database" || node.fileKind === "sql") return "数据库脚本";
  if (node.fileKind === "dataset" || node.fileKind === "xlsx" || node.fileKind === "csv") return "数据表";
  if (node.fileKind === "asset") return "图片素材";
  if (node.fileKind === "other") return "其他资料";
  return node.fileKind?.toUpperCase() ?? "资料";
}
