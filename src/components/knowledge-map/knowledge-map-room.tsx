"use client";

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Code2,
  ChevronRight,
  DatabaseZap,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FolderIcon,
  Gauge,
  Layers3,
  MessageSquareText,
  Presentation,
  Search,
  Sparkles,
  Table2,
  Target,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
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
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { SigmaKnowledgeGraph } from "@/components/sigma-knowledge-graph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  appendFileExplanationTurn,
  createFileExplanation,
  createMockKnowledgeMap,
  getKnowledgeNodeActivation,
  loadFileNodePreview,
  loadKnowledgeMap,
  type FileExplanationUi,
  type FilePreviewUi,
  type KnowledgeMapNodeUi,
} from "@/lib/knowledge-map-client";
import {
  buildKnowledgeMapScene,
  projectKnowledgeMapScene,
  type KnowledgeMapScene,
  type KnowledgeMapSceneNode,
  type KnowledgeMapSceneRenderNode,
} from "@/lib/knowledge-map-scene";
import type { NotebookCitation, NotebookExplanationMode } from "@shared/domain";
import { cn } from "@/lib/utils";

const graphFilters = [
  { id: "all", label: "全部" },
  { id: "risk", label: "高危" },
  { id: "weakness", label: "薄弱点" },
  { id: "file", label: "文件" },
  { id: "training", label: "训练入口" },
] as const;

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
  nodes: KnowledgeMapSceneNode[];
};

export function KnowledgeMapRoom({ projectId = "demo" }: { projectId?: string }) {
  const router = useRouter();
  const isNarrowLayout = useIsNarrowKnowledgeLayout();
  const [knowledgeMap, setKnowledgeMap] = useState(() => createMockKnowledgeMap(projectId));
  const [activeNodeId, setActiveNodeId] = useState("project");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof graphFilters)[number]["id"]>("all");
  const [expandedBranchIds, setExpandedBranchIds] = useState<Set<string>>(() => new Set());
  const [readerNodeId, setReaderNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<NotebookExplanationMode>("quick");
  const [preview, setPreview] = useState<FilePreviewUi | null>(null);
  const [explanation, setExplanation] = useState<FileExplanationUi | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadKnowledgeMap(projectId)
      .then((nextMap) => {
        if (cancelled) return;
        setKnowledgeMap(nextMap);
        setActiveNodeId((current) => nextMap.nodes.some((node) => node.id === current) ? current : nextMap.nodes[0]?.id ?? "project");
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const scene = useMemo(() => buildKnowledgeMapScene(knowledgeMap), [knowledgeMap]);
  const sanitizedExpandedBranchIds = useMemo(
    () => new Set(
      [...expandedBranchIds].filter((branchId) => scene.nodesById[branchId]?.depth === 1),
    ),
    [expandedBranchIds, scene],
  );
  const activeNode = useMemo(
    () => scene.nodesById[activeNodeId] ?? scene.nodesById[scene.rootId],
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
  const readerFileGroups = useMemo(() => buildKnowledgeReaderFileGroups(scene), [scene]);
  const activeOverviewNode = useMemo(
    () => overviewProjection.nodes.find((node) => node.id === activeNode.id) ?? null,
    [activeNode.id, overviewProjection.nodes],
  );
  const readerNode = useMemo(
    () => readerNodeId ? scene.nodesById[readerNodeId] ?? null : null,
    [readerNodeId, scene],
  );

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

  useEffect(() => {
    if (!readerNode) return;
    let cancelled = false;

    void Promise.resolve()
      .then(async () => {
        if (cancelled) return;
        setIsLoadingExplanation(true);
        setPreview(readerNode.preview);
        setExplanation(null);
        const [nextPreview, nextExplanation] = await Promise.all([
          loadFileNodePreview(projectId, readerNode),
          createFileExplanation(projectId, readerNode, mode),
        ]);
        if (cancelled) return;
        return { nextPreview, nextExplanation };
      })
      .then((result) => {
        if (!result || cancelled) return;
        setPreview(result.nextPreview);
        setExplanation(result.nextExplanation);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingExplanation(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, projectId, readerNode]);

  function handleNodeSelect(nodeId: string) {
    const node = scene.nodesById[nodeId];
    if (!node) return;

    startTransition(() => {
      setActiveNodeId(nodeId);
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
  }

  function handleNodeOpen(nodeId: string) {
    const node = scene.nodesById[nodeId];
    if (!node) return;
    const activation = getKnowledgeNodeActivation(node);
    if (activation === "scripts") {
      router.push("/projects/demo/scripts");
      return;
    }
    if (activation === "reader") {
      setReaderNodeId(node.id);
      return;
    }
    router.push("/projects/demo/defense");
  }

  function handleReaderFileSelect(nodeId: string) {
    const node = scene.nodesById[nodeId];
    if (!node) return;
    const activation = getKnowledgeNodeActivation(node);

    if (activation === "scripts") {
      router.push("/projects/demo/scripts");
      return;
    }

    if (activation !== "reader") return;

    startTransition(() => {
      setActiveNodeId(node.id);
      setReaderNodeId(node.id);
    });
  }

  async function handleSubmit(message: PromptInputMessage) {
    const question = message.text.trim();
    if (!question || !explanation) return;
    setIsSending(true);
    setChatInput("");
    const nextSession = await appendFileExplanationTurn(projectId, explanation, question);
    setExplanation(nextSession);
    setIsSending(false);
  }

  return (
    <KnowledgeResizableShell mode={readerNode ? "reader" : "overview"}>
      {readerNode ? (
        <KnowledgeReaderPanels
          activeNodeId={activeNodeId}
          chatInput={chatInput}
          explanation={explanation}
          fileGroups={readerFileGroups}
          isLoadingExplanation={isLoadingExplanation}
          isNarrowLayout={isNarrowLayout}
          isSending={isSending}
          mode={mode}
          onBack={() => setReaderNodeId(null)}
          onFileSelect={handleReaderFileSelect}
          onInputChange={setChatInput}
          onModeChange={setMode}
          onSubmit={handleSubmit}
          preview={preview ?? readerNode.preview}
          readerNode={readerNode}
        />
      ) : (
        <KnowledgeOverviewPanels
          activeNode={activeNode}
          activeOverviewNode={activeOverviewNode}
          activeNodeId={activeNodeId}
          edges={sigmaEdges}
          filter={filter}
          isNarrowLayout={isNarrowLayout}
          nodes={sigmaNodes}
          onFilterChange={setFilter}
          onNodeOpen={() => handleNodeOpen(activeNode.id)}
          onQueryChange={setQuery}
          onSelect={handleNodeSelect}
          query={query}
        />
      )}
    </KnowledgeResizableShell>
  );
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

function useHasDesktopDockLayout() {
  const [hasDesktopDock, setHasDesktopDock] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setHasDesktopDock(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return hasDesktopDock;
}

function KnowledgeResizableShell({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "overview" | "reader";
}) {
  const reduceMotion = useReducedMotion();
  const hasDesktopDock = useHasDesktopDockLayout();
  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 32, mass: 0.82 };

  return (
    <div
      className="presento-knowledge-room"
      style={
        hasDesktopDock
          ? { paddingLeft: "calc(var(--presento-detail-safe-start) + var(--presento-detail-inline-gutter))" }
          : undefined
      }
    >
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

function KnowledgeOverviewPanels({
  activeNode,
  activeOverviewNode,
  activeNodeId,
  edges,
  filter,
  isNarrowLayout,
  nodes,
  onFilterChange,
  onNodeOpen,
  onQueryChange,
  onSelect,
  query,
}: {
  activeNode: KnowledgeMapSceneNode;
  activeOverviewNode: KnowledgeMapSceneRenderNode | null;
  activeNodeId: string;
  edges: KnowledgeSigmaEdge[];
  filter: (typeof graphFilters)[number]["id"];
  isNarrowLayout: boolean;
  nodes: KnowledgeSigmaNode[];
  onFilterChange: (filter: (typeof graphFilters)[number]["id"]) => void;
  onNodeOpen: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (nodeId: string) => void;
  query: string;
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
          <KnowledgeDetailPane node={activeNode} overviewNode={activeOverviewNode} onOpenReader={onNodeOpen} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function KnowledgeGraphPane({
  activeNodeId,
  edges,
  filter,
  nodes,
  onFilterChange,
  onQueryChange,
  onSelect,
  query,
}: {
  activeNodeId: string;
  edges: KnowledgeSigmaEdge[];
  filter: (typeof graphFilters)[number]["id"];
  nodes: KnowledgeSigmaNode[];
  onFilterChange: (filter: (typeof graphFilters)[number]["id"]) => void;
  onQueryChange: (query: string) => void;
  onSelect: (nodeId: string) => void;
  query: string;
}) {
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
            {graphFilters.map((item) => (
              <button
                className={cn("presento-knowledge-filter", filter === item.id && "presento-knowledge-filter-active")}
                key={item.id}
                onClick={() => onFilterChange(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="presento-knowledge-graph-stage">
          <SigmaKnowledgeGraph
            activeId={activeNodeId}
            edges={edges}
            nodes={nodes}
            onSelect={onSelect}
          />
        </div>
      </div>
    </section>
  );
}

function KnowledgeReaderPanels({
  activeNodeId,
  chatInput,
  explanation,
  fileGroups,
  isLoadingExplanation,
  isNarrowLayout,
  isSending,
  mode,
  onBack,
  onFileSelect,
  onInputChange,
  onModeChange,
  onSubmit,
  preview,
  readerNode,
}: {
  activeNodeId: string;
  chatInput: string;
  explanation: FileExplanationUi | null;
  fileGroups: KnowledgeReaderFileGroup[];
  isLoadingExplanation: boolean;
  isNarrowLayout: boolean;
  isSending: boolean;
  mode: NotebookExplanationMode;
  onBack: () => void;
  onFileSelect: (nodeId: string) => void;
  onInputChange: (value: string) => void;
  onModeChange: (mode: NotebookExplanationMode) => void;
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
  preview: FilePreviewUi;
  readerNode: KnowledgeMapNodeUi;
}) {
  return (
    <ResizablePanelGroup
      className="presento-knowledge-resizable presento-knowledge-reader-resizable"
      orientation={isNarrowLayout ? "vertical" : "horizontal"}
    >
      <ResizablePanel defaultSize={isNarrowLayout ? "24%" : "22%"} minSize={isNarrowLayout ? "18%" : "18%"}>
        <KnowledgeFileLibraryPanel
          activeNodeId={activeNodeId}
          fileGroups={fileGroups}
          onBack={onBack}
          onFileSelect={onFileSelect}
          readerNode={readerNode}
        />
      </ResizablePanel>
      <ResizableHandle className="presento-knowledge-resize-handle" withHandle />
      <ResizablePanel defaultSize={isNarrowLayout ? "40%" : "44%"} minSize={isNarrowLayout ? "28%" : "30%"}>
        <FilePreviewPanel node={readerNode} preview={preview} />
      </ResizablePanel>
      <ResizableHandle className="presento-knowledge-resize-handle" withHandle />
      <ResizablePanel defaultSize={isNarrowLayout ? "36%" : "34%"} minSize={isNarrowLayout ? "28%" : "28%"}>
        <ExplanationPanel
          chatInput={chatInput}
          explanation={explanation}
          isLoading={isLoadingExplanation}
          isSending={isSending}
          mode={mode}
          node={readerNode}
          onInputChange={onInputChange}
          onModeChange={onModeChange}
          onSubmit={onSubmit}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function KnowledgeFileLibraryPanel({
  activeNodeId,
  fileGroups,
  onBack,
  onFileSelect,
  readerNode,
}: {
  activeNodeId: string;
  fileGroups: KnowledgeReaderFileGroup[];
  onBack: () => void;
  onFileSelect: (nodeId: string) => void;
  readerNode: KnowledgeMapNodeUi;
}) {
  return (
    <section className="presento-knowledge-pane presento-knowledge-file-library-panel">
      <header className="presento-knowledge-pane-header presento-knowledge-pane-header-compact">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black">
            <FolderIcon aria-hidden="true" />
            已接入文件
          </h2>
          <p className="mt-2 font-semibold text-[var(--presento-muted)]">
            像资料导入页一样浏览项目资料，当前文件会同步中间预览和右侧讲解。
          </p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Button className="w-full rounded-xl font-black" onClick={onBack} type="button" variant="outline">
          <ArrowLeft aria-hidden="true" />
          返回图谱
        </Button>
        <div className="presento-knowledge-file-current">
          <FileText aria-hidden="true" />
          <div>
            <span>当前资料</span>
            <strong>{readerNode.title}</strong>
          </div>
        </div>
        <ScrollArea className="presento-knowledge-file-library-scroll">
          <div className="presento-knowledge-file-library-tree">
            {fileGroups.map((group) => (
              <Collapsible className="presento-knowledge-file-group" defaultOpen key={group.id}>
                <CollapsibleTrigger asChild>
                  <Button className="presento-knowledge-file-group-trigger" type="button" variant="ghost">
                    <ChevronRight className="presento-knowledge-file-group-chevron" aria-hidden="true" />
                    <FolderIcon aria-hidden="true" />
                    <span>{group.label}</span>
                    <small>{group.nodes.length}</small>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="presento-knowledge-file-group-content">
                  {group.nodes.map((node) => (
                    <KnowledgeFileTreeItem
                      active={node.id === activeNodeId}
                      key={node.id}
                      node={node}
                      onSelect={onFileSelect}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}

function KnowledgeFileTreeItem({
  active,
  node,
  onSelect,
}: {
  active: boolean;
  node: KnowledgeMapSceneNode;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <Button
      className={cn("presento-knowledge-file-tree-item", active && "presento-knowledge-file-tree-item-active")}
      onClick={() => onSelect(node.id)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span className="presento-knowledge-file-tree-spacer" aria-hidden="true" />
      <KnowledgeFileIcon node={node} />
      <span className="presento-knowledge-file-tree-copy">
        <strong>{node.title}</strong>
        <small>{fileKindLabel(node)}</small>
      </span>
    </Button>
  );
}

function KnowledgeFileIcon({ node }: { node: KnowledgeMapNodeUi }) {
  if (node.fileKind === "ppt" || node.fileKind === "presentation-pdf") return <Presentation aria-hidden="true" />;
  if (node.fileKind === "code") return <FileCode2 aria-hidden="true" />;
  if (node.fileKind === "sql") return <DatabaseZap aria-hidden="true" />;
  if (node.fileKind === "xlsx" || node.fileKind === "csv") return <FileSpreadsheet aria-hidden="true" />;
  if (node.fileKind === "zip") return <FileArchive aria-hidden="true" />;
  return <FileText aria-hidden="true" />;
}

function KnowledgeDetailPane({
  node,
  overviewNode,
  onOpenReader,
}: {
  node: KnowledgeMapSceneNode;
  overviewNode: KnowledgeMapSceneRenderNode | null;
  onOpenReader: () => void;
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
            <NodeDetailContent node={node} overviewNode={overviewNode} onOpenReader={onOpenReader} />
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}

function NodeDetailContent({
  node,
  overviewNode,
  onOpenReader,
}: {
  node: KnowledgeMapSceneNode;
  overviewNode: KnowledgeMapSceneRenderNode | null;
  onOpenReader: () => void;
}) {
  const activation = getKnowledgeNodeActivation(node);
  const layerLabel = layerLabelForNode(node.depth);
  const branchLabel = overviewNode?.path[1] ?? null;
  return (
    <>
      <header className="presento-knowledge-pane-header">
        <div className="min-w-0">
          <div className="presento-knowledge-panel-eyebrow">
            <span>{layerLabel}</span>
            {branchLabel ? <span>· 分支 {branchLabel}</span> : null}
          </div>
          <h2 className="text-lg font-black">{node.title}</h2>
          {node.summary ? (
            <p className="mt-2 font-semibold leading-6 text-[var(--presento-muted)]">
              {node.summary}
            </p>
          ) : null}
        </div>
        <NodeKindIcon node={node} />
      </header>
      <ScrollArea className="min-h-0 flex-1 pr-3">
        <div className="flex flex-col gap-4">
          {overviewNode?.path.length ? (
            <section className="presento-knowledge-detail-block presento-knowledge-detail-block-muted">
              <div className="flex items-center gap-2 text-sm font-black">
                <Layers3 aria-hidden="true" />
                策展路径
              </div>
              <div className="presento-knowledge-path-chips">
                {overviewNode.path.map((segment) => (
                  <span className="presento-knowledge-path-chip" key={segment}>
                    {segment}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <RiskBadge risk={node.riskLevel} />
            <Badge variant="outline">{node.kind}</Badge>
            {node.fileKind ? <Badge variant="secondary">{node.fileKind}</Badge> : null}
            {node.expandable && node.childCount ? <Badge className="presento-knowledge-badge-soft">可展开 {node.childCount}</Badge> : null}
          </div>
          <DetailBlock icon={<FileText aria-hidden="true" />} title="证据链" items={node.evidence} />
          <DetailBlock icon={<MessageSquareText aria-hidden="true" />} title="高危追问" items={node.riskQuestions.length ? node.riskQuestions : ["老师可能追问证据来源、个人负责范围和技术边界。"]} />
          <DetailBlock icon={<Target aria-hidden="true" />} title="推荐动作" items={node.actions} />
        </div>
      </ScrollArea>
      <div className="presento-knowledge-pane-actions">
        <Button className="rounded-xl bg-[var(--presento-navy)] font-black text-white" onClick={onOpenReader} type="button">
          {activation === "reader" ? "打开资料讲解" : activation === "scripts" ? "查看逐页讲稿" : "围绕此节点讲练"}
        </Button>
        <Button className="rounded-xl font-black" type="button" variant="outline">
          加入薄弱点修复
        </Button>
      </div>
    </>
  );
}

function FilePreviewPanel({ node, preview }: { node: KnowledgeMapNodeUi; preview: FilePreviewUi }) {
  return (
    <section className="presento-knowledge-pane presento-knowledge-preview-panel">
      <header className="presento-knowledge-pane-header">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">{node.title}</h2>
            <p className="mt-2 font-semibold text-[var(--presento-muted)]">
              {node.fileKind?.toUpperCase()} · 解析状态已就绪
            </p>
          </div>
          <NodeKindIcon node={node} />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <ScrollArea className="h-full pr-3">
          {preview.viewer === "pdf" ? <PdfPreview preview={preview} /> : null}
          {preview.viewer === "docx" ? <DocPreview preview={preview} /> : null}
          {preview.viewer === "code" || preview.viewer === "sql" ? <CodePreview preview={preview} /> : null}
          {preview.viewer === "table" ? <TablePreview preview={preview} /> : null}
          {preview.viewer === "details" || preview.viewer === "presentation" ? <DocPreview preview={preview} /> : null}
        </ScrollArea>
      </div>
    </section>
  );
}

function ExplanationPanel({
  chatInput,
  explanation,
  isLoading,
  isSending,
  mode,
  node,
  onInputChange,
  onModeChange,
  onSubmit,
}: {
  chatInput: string;
  explanation: FileExplanationUi | null;
  isLoading: boolean;
  isSending: boolean;
  mode: NotebookExplanationMode;
  node: KnowledgeMapNodeUi;
  onInputChange: (value: string) => void;
  onModeChange: (mode: NotebookExplanationMode) => void;
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
}) {
  const citations = explanation?.citations ?? [];
  return (
    <section className="presento-knowledge-pane presento-knowledge-explain-panel">
      <header className="presento-knowledge-pane-header">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Sparkles aria-hidden="true" />
              AI 资料讲解
            </h2>
            <p className="mt-2 font-semibold text-[var(--presento-muted)]">
              始终围绕答辩准备、证据引用和训练动作。
            </p>
          </div>
          <Badge variant={explanation?.source === "api" ? "default" : "secondary"}>
            {explanation?.source === "api" ? "API" : "Mock"}
          </Badge>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Tabs onValueChange={(value) => onModeChange(value as NotebookExplanationMode)} value={mode}>
          <TabsList className="w-full">
            <TabsTrigger value="quick">速通模式</TabsTrigger>
            <TabsTrigger value="mastery">精通模式</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="presento-knowledge-summary">
          <div className="text-xs font-black text-[var(--presento-muted)]">当前文件</div>
          <div className="mt-1 text-sm font-black">{node.title}</div>
          {isLoading || explanation?.summary || node.summary ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--presento-muted)]">
              {isLoading ? "正在生成讲解..." : explanation?.summary ?? node.summary}
            </p>
          ) : null}
        </div>
        {citations.length ? <CitationSources citations={citations} /> : null}
        <Conversation className="presento-knowledge-conversation">
          <ConversationContent>
            {(explanation?.turns ?? []).map((turn) => (
              <Message from={turn.role} key={turn.id}>
                <MessageContent>
                  <MessageResponse>{turn.content}</MessageResponse>
                </MessageContent>
              </Message>
            ))}
          </ConversationContent>
        </Conversation>
        <PromptInput onSubmit={onSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(event) => onInputChange(event.currentTarget.value)}
              value={chatInput}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <span className="text-xs font-bold text-[var(--presento-muted)]">回答会优先引用当前文件</span>
            <PromptInputSubmit disabled={!chatInput.trim() || !explanation} status={isSending ? "submitted" : "ready"} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}

function CitationSources({ citations }: { citations: NotebookCitation[] }) {
  return (
    <Sources open>
      <SourcesTrigger count={citations.length} />
      <SourcesContent>
        {citations.map((citation, index) => (
          <Source href="#" key={`${citation.fileName ?? "source"}-${index}`} title={formatCitation(citation)} />
        ))}
      </SourcesContent>
    </Sources>
  );
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
      <div className="flex flex-wrap gap-2">
        {preview.outline.map((item) => (
          <Badge key={item} variant="secondary">{item}</Badge>
        ))}
      </div>
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

function DetailBlock({ icon, items, title }: { icon: ReactNode; items: string[]; title: string }) {
  return (
    <section className="presento-knowledge-detail-block">
      <div className="flex items-center gap-2 text-sm font-black">
        {icon}
        {title}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <div className="presento-knowledge-detail-row" key={item}>
            <CheckCircle2 aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiskBadge({ risk }: { risk: KnowledgeMapNodeUi["riskLevel"] }) {
  if (risk === "high") return <Badge className="bg-red-50 text-red-700">高风险</Badge>;
  if (risk === "low") return <Badge className="bg-emerald-50 text-emerald-700">低风险</Badge>;
  return <Badge className="bg-amber-50 text-amber-700">中风险</Badge>;
}

function NodeKindIcon({ node }: { node: KnowledgeMapNodeUi }) {
  const icon = node.kind === "file"
    ? <FileText aria-hidden="true" />
    : node.kind === "risk"
      ? <Gauge aria-hidden="true" />
      : node.kind === "weakness"
        ? <Target aria-hidden="true" />
        : node.kind === "module"
          ? <Layers3 aria-hidden="true" />
        : <BookOpen aria-hidden="true" />;
  return <div className={cn("presento-knowledge-node-icon", `presento-knowledge-node-icon-${node.tone}`)}>{icon}</div>;
}

function buildKnowledgeReaderFileGroups(scene: KnowledgeMapScene): KnowledgeReaderFileGroup[] {
  const groups = new Map<string, KnowledgeReaderFileGroup>();

  for (const node of scene.nodes) {
    if (node.kind !== "file") continue;
    const label = fileGroupLabel(scene, node);
    const id = `file-group-${label}`;
    const group = groups.get(id) ?? { id, label, nodes: [] };
    group.nodes.push(node);
    groups.set(id, group);
  }

  const preferredOrder = ["演示资料", "项目文档", "代码与数据", "项目资料"];
  return [...groups.values()]
    .map((group) => ({
      ...group,
      nodes: group.nodes.toSorted((left, right) => left.order - right.order),
    }))
    .toSorted((left, right) => {
      const leftIndex = preferredOrder.indexOf(left.label);
      const rightIndex = preferredOrder.indexOf(right.label);
      const normalizedLeft = leftIndex === -1 ? preferredOrder.length : leftIndex;
      const normalizedRight = rightIndex === -1 ? preferredOrder.length : rightIndex;
      if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
      return left.label.localeCompare(right.label, "zh-Hans-CN");
    });
}

function fileGroupLabel(scene: KnowledgeMapScene, node: KnowledgeMapSceneNode) {
  const fileKind = node.fileKind ?? "";
  if (node.sourceId === "source-presentation" || fileKind === "ppt" || fileKind === "presentation-pdf") {
    return "演示资料";
  }
  if (node.sourceId === "source-code" || node.sourceId === "source-data" || ["code", "zip", "sql", "xlsx", "csv"].includes(fileKind)) {
    return "代码与数据";
  }
  if (node.sourceId === "source-docs" || ["pdf", "docx", "md", "txt"].includes(fileKind)) {
    return "项目文档";
  }

  const branchNode = scene.nodesById[node.branchId];
  return branchNode && branchNode.id !== scene.rootId ? branchNode.title : "项目资料";
}

function fileKindLabel(node: KnowledgeMapNodeUi) {
  if (node.fileKind === "presentation-pdf") return "PPT 讲稿";
  if (node.fileKind === "ppt") return "PPT 原稿";
  if (node.fileKind === "pdf") return "PDF 文档";
  if (node.fileKind === "docx") return "项目文档";
  if (node.fileKind === "code") return "代码文件";
  if (node.fileKind === "sql") return "数据库脚本";
  if (node.fileKind === "xlsx" || node.fileKind === "csv") return "数据表";
  return node.fileKind?.toUpperCase() ?? "资料";
}

function layerLabelForNode(depth: 0 | 1 | 2 | 3) {
  if (depth === 0) return "项目核心";
  if (depth === 1) return "二层主枝";
  if (depth === 2) return "三层展开节点";
  return "训练入口";
}

function formatCitation(citation: NotebookCitation) {
  const segments = [citation.fileName ?? "未知来源"];
  if (citation.page) segments.push(`第 ${citation.page} 页`);
  if (citation.sheet) segments.push(citation.cellRange ? `${citation.sheet}!${citation.cellRange}` : citation.sheet);
  if (citation.codePath) {
    const lines = citation.lineStart ? `:${citation.lineStart}${citation.lineEnd ? `-${citation.lineEnd}` : ""}` : "";
    segments.push(`${citation.codePath}${lines}`);
  }
  return segments.join(" · ");
}
