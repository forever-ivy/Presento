"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bot,
  Box,
  Brain,
  ChartSpline,
  ChevronDown,
  Cpu,
  FileQuestion,
  FileText,
  FolderKanban,
  Home,
  Link2,
  Map,
  MessageSquareText,
  Mic,
  Pin,
  PinOff,
  Plus,
  Radio,
  Target,
  UploadCloud,
} from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dock, DockIcon } from "@/components/ui/dock";
import { DotPattern } from "@/components/magicui/dot-pattern";
import {
  createKnowledgeMapFlow,
  type KnowledgeMapFlowNodeData,
} from "@/lib/knowledge-map-flow";
import { presentoBrandLogo } from "@/lib/brand";
import {
  extractProjectIdFromPathname,
  extractProjectStepFromPathname,
  projectManagementRoute,
  projectRoute,
  type ProjectRouteStep,
} from "@/lib/project-routes";
import { fetchProjects, type ProjectListItem } from "@/lib/projects-api";
import { cn } from "@/lib/utils";

export { cn } from "@/lib/utils";

export type PresentoTone =
  | "blue"
  | "gray"
  | "orange"
  | "green"
  | "red"
  | "purple"
  | "cyan";

export type KnowledgeNodeView = {
  id: string;
  title: string;
  type: string;
  tone: PresentoTone;
  x: number;
  y: number;
  risk: string;
  description: string;
  evidence: string[];
  actions: string[];
};

type AppShellContextValue = {
  leftExpanded: boolean;
  setLeftExpanded: (value: boolean) => void;
};

const AppShellContext = createContext<AppShellContextValue | null>(null);
const presentoScrollLockClass = "presento-app-scroll-lock";
let presentoScrollLockCount = 0;

const navigationItems: Array<{
  href?: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  step?: ProjectRouteStep;
}> = [
  { href: projectManagementRoute, label: "项目管理", icon: FolderKanban },
  { step: "knowledge", label: "知识地图", icon: Map },
  { step: "files", label: "资料导入", icon: UploadCloud },
  { step: "scripts", label: "逐页讲稿", icon: FileQuestion },
  { step: "defense", label: "模拟讲练", icon: Mic, badge: "HOT" },
  { step: "deepDive", label: "薄弱点", icon: Target },
  { step: "review", label: "复盘", icon: MessageSquareText },
  { step: "skills", label: "Agent Skills", icon: Cpu },
  { step: "pcg", label: "PCG 连接", icon: Radio },
];

export function AppFrame({
  children,
  ambient = true,
}: {
  children: ReactNode;
  ambient?: boolean;
}) {
  useEffect(() => {
    presentoScrollLockCount += 1;
    document.documentElement.classList.add(presentoScrollLockClass);

    return () => {
      presentoScrollLockCount = Math.max(0, presentoScrollLockCount - 1);
      if (presentoScrollLockCount === 0) {
        document.documentElement.classList.remove(presentoScrollLockClass);
      }
    };
  }, []);

  return (
    <AppShellContext.Provider value={{ leftExpanded: false, setLeftExpanded: () => undefined }}>
      <main className="presento-shell">
        {ambient ? (
          <div className="presento-ambient" aria-hidden="true">
            <DotPattern
              className="presento-dot-pattern"
              cr={1.45}
              cx={1.5}
              cy={1.5}
              glow={false}
              height={16}
              width={16}
            />
          </div>
        ) : null}
        {children}
      </main>
    </AppShellContext.Provider>
  );
}

function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    return {
      leftExpanded: true,
      setLeftExpanded: () => undefined,
    };
  }
  return context;
}

export function PageWrap({
  children,
  animateEntrance = true,
  width = "max-w-none",
  className,
}: {
  children: ReactNode;
  animateEntrance?: boolean;
  width?: string;
  className?: string;
}) {
  const { leftExpanded } = useAppShell();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "presento-workspace",
        leftExpanded ? "presento-workspace-expanded" : "presento-workspace-collapsed",
        width,
        className,
      )}
      initial={animateEntrance ? { opacity: 0, y: 8 } : false}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      aria-label="Presento 首页"
      className={cn("presento-brand-link", compact && "presento-brand-link-compact")}
      href="/"
    >
      <Image
        alt={presentoBrandLogo.alt}
        className="presento-brand-logo"
        height={presentoBrandLogo.height}
        priority
        src={presentoBrandLogo.src}
        width={presentoBrandLogo.width}
      />
    </Link>
  );
}

type TopNavDetailState = {
  contextLabel?: string;
  title: string;
  onBack: () => void;
};

type TopNavDetailTransition = {
  direction: -1 | 1;
  durationMs: number;
  from: Pick<TopNavDetailState, "title"> & { contextLabel?: string };
  key: number;
  to: Pick<TopNavDetailState, "title"> & { contextLabel?: string };
};

type TopNavDetailEntrance = {
  durationMs: number;
  key: string | number;
};

type TopNavDetailExit = {
  durationMs: number;
  key: string | number;
};

export function TopNav({
  onNavigate,
  projectId,
  detailState,
  detailEntrance,
  detailExit,
  detailTransition,
  dockFixedSize = false,
  backgroundHintPinned,
  onToggleBackgroundHint,
}: {
  onNavigate?: (href: string) => void;
  projectId?: string;
  detailState?: TopNavDetailState;
  detailEntrance?: TopNavDetailEntrance;
  detailExit?: TopNavDetailExit;
  detailTransition?: TopNavDetailTransition;
  dockFixedSize?: boolean;
  backgroundHintPinned?: boolean;
  onToggleBackgroundHint?: () => void;
} = {}) {
  const pathname = usePathname();
  const activeProjectId = projectId ?? extractProjectIdFromPathname(pathname);
  const activeStep = extractProjectStepFromPathname(pathname) ?? "knowledge";
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const titleTransition = {
    duration: (detailTransition?.durationMs ?? 360) / 1000,
    ease: [0.2, 0.72, 0.24, 1] as const,
  };
  const detailEntranceTransition = {
    duration: (detailEntrance?.durationMs ?? 420) / 1000,
    ease: [0.2, 0.72, 0.24, 1] as const,
  };
  const detailExitTransition = {
    duration: (detailExit?.durationMs ?? 420) / 1000,
    ease: [0.2, 0.72, 0.24, 1] as const,
  };
  const titleDrift = detailTransition ? detailTransition.direction * 18 : 0;
  const showMapActions = !detailState || Boolean(detailExit);
  const currentProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const projectSwitchLabel = currentProject?.name ?? (activeProjectId ? "当前项目" : "选择项目");

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const nextProjects = await fetchProjects();
        if (!cancelled) {
          setProjects(nextProjects);
          setProjectsError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setProjects([]);
          setProjectsError(error instanceof Error ? error.message : "项目列表读取失败");
        }
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header className="presento-topbar">
        <div className="flex min-w-0 items-center">
          {detailState && detailExit ? (
            <div className="presento-topbar-left-stage">
              <motion.div
                animate={{ opacity: 0, scale: 0.985, x: -12, y: -2 }}
                className="presento-topbar-left-layer"
                initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                key={`${detailExit.key}-detail-out`}
                transition={detailExitTransition}
              >
                <TopNavDetailContent
                  detailState={detailState}
                  detailTransition={detailTransition}
                  titleDrift={titleDrift}
                  titleTransition={titleTransition}
                />
              </motion.div>
              <motion.div
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                className="presento-topbar-left-layer"
                initial={{ opacity: 0, scale: 0.985, x: 12, y: 2 }}
                key={`${detailExit.key}-brand-in`}
                transition={detailExitTransition}
              >
                <BrandMark />
              </motion.div>
            </div>
          ) : detailState ? (
            <motion.div
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              className="presento-topbar-detail"
              initial={
                detailEntrance
                  ? { opacity: 0, scale: 0.985, x: 12, y: 2 }
                  : false
              }
              key={detailEntrance?.key ?? "presento-topbar-detail"}
              transition={detailEntranceTransition}
            >
              <TopNavDetailContent
                detailState={detailState}
                detailTransition={detailTransition}
                titleDrift={titleDrift}
                titleTransition={titleTransition}
              />
            </motion.div>
          ) : (
            <BrandMark />
          )}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {showMapActions ? (
            <motion.div
              animate={{ opacity: 1, scale: 1, x: 0 }}
              className="inline-flex min-w-0"
              initial={detailExit ? { opacity: 0, scale: 0.985, x: 10 } : false}
              transition={detailExitTransition}
            >
            <DropdownMenu>
              <DropdownMenuTrigger className="presento-project-switch">
                <Box aria-hidden="true" />
                <span className="truncate">{projectSwitchLabel}</span>
                <ChevronDown aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="presento-project-menu">
                <DropdownMenuLabel className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[var(--presento-faint)]">
                  项目
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {projects.length ? projects.map((project) => (
                    <DropdownMenuItem asChild key={project.id}>
                      <Link
                        className={cn(
                          "flex items-center justify-between px-4 py-2 text-sm font-bold text-[var(--presento-muted)] transition hover:bg-[var(--presento-hover)]",
                          project.id === activeProjectId && "bg-emerald-50/60 text-[var(--presento-ink)]",
                        )}
                        href={projectRoute(project.id, activeStep)}
                      >
                        <span className="min-w-0 truncate">{project.name}</span>
                        {project.id === activeProjectId ? <span className="size-2 rounded-full bg-[var(--presento-blue)]" /> : null}
                      </Link>
                    </DropdownMenuItem>
                  )) : (
                    <DropdownMenuItem disabled>
                      <span className="px-4 py-2 text-sm font-bold text-[var(--presento-muted)]">
                        {projectsError ?? "暂无项目"}
                      </span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="my-1 h-px bg-[var(--presento-border)]" />
                <DropdownMenuItem asChild>
                  <Link
                    className="flex items-center gap-2 px-4 py-2 text-sm font-black text-[var(--presento-blue-active)] transition hover:bg-[var(--presento-hover)]"
                    href="/projects/new"
                  >
                    <Plus aria-hidden="true" />
                    项目管理
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </motion.div>
          ) : null}
          {onToggleBackgroundHint ? (
            <button
              aria-label={backgroundHintPinned ? "关闭背景提示常驻" : "开启背景提示常驻"}
              className={cn(
                "presento-topbar-icon-button",
                backgroundHintPinned && "presento-topbar-icon-button-active",
              )}
              onClick={onToggleBackgroundHint}
              title={backgroundHintPinned ? "背景提示：常驻显示" : "背景提示：显示 10 秒"}
              type="button"
            >
              {backgroundHintPinned ? <Pin aria-hidden="true" /> : <PinOff aria-hidden="true" />}
            </button>
          ) : null}
        </div>
      </header>

      <nav className="presento-dock-nav" aria-label="Presento navigation">
        <Dock
          className="presento-dock"
          disableMagnification={dockFixedSize}
          iconDistance={110}
          iconMagnification={58}
          iconSize={dockFixedSize ? 52 : 42}
          orientation="vertical"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const href = item.href ?? (activeProjectId ? projectRoute(activeProjectId, item.step ?? "knowledge") : projectManagementRoute);
            const active = item.href
              ? pathname === item.href
              : Boolean(activeProjectId && item.step === activeStep);

            return (
              <DockIcon
                className={cn("presento-dock-icon", active && "presento-dock-icon-active")}
                key={item.href ?? item.step}
              >
                <Link
                  aria-label={item.label}
                  className={cn("presento-dock-link", active && "presento-dock-link-active")}
                  data-label={item.label}
                  href={href}
                  onClick={(event) => {
                    if (!onNavigate || href === projectManagementRoute) return;
                    event.preventDefault();
                    onNavigate(href);
                  }}
                  title={item.label}
                >
                  <Icon aria-hidden="true" className="size-full" />
                  {item.badge ? <span className="presento-dock-badge">{item.badge}</span> : null}
                </Link>
              </DockIcon>
            );
          })}
        </Dock>
      </nav>

      <nav className="presento-mobile-nav" aria-label="Presento mobile navigation">
        {navigationItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const href = item.href ?? (activeProjectId ? projectRoute(activeProjectId, item.step ?? "knowledge") : projectManagementRoute);
          const active = item.href
            ? pathname === item.href
            : Boolean(activeProjectId && item.step === activeStep);
          return (
            <Link
              className={cn("presento-mobile-nav-item", active && "text-[var(--presento-blue)]")}
              href={href}
              key={item.href ?? item.step}
              onClick={(event) => {
                if (!onNavigate || href === projectManagementRoute) return;
                event.preventDefault();
                onNavigate(href);
              }}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function TopNavDetailContent({
  detailState,
  detailTransition,
  titleDrift,
  titleTransition,
}: {
  detailState: TopNavDetailState;
  detailTransition?: TopNavDetailTransition;
  titleDrift: number;
  titleTransition: {
    duration: number;
    ease: readonly [number, number, number, number];
  };
}) {
  return (
    <>
      <button
        aria-label="返回图谱"
        className="presento-topbar-back"
        onClick={detailState.onBack}
        type="button"
      >
        <ArrowLeft aria-hidden="true" />
      </button>
      <div className="presento-topbar-detail-copy-stage">
        {detailTransition ? (
          <>
            <motion.div
              animate={{
                opacity: 0,
                scale: 0.985,
                x: -titleDrift,
              }}
              className="presento-topbar-detail-copy presento-topbar-detail-copy-slide"
              initial={{
                opacity: 1,
                scale: 1,
                x: 0,
              }}
              key={`${detailTransition.key}-from`}
              transition={titleTransition}
            >
              <strong>{detailTransition.from.title}</strong>
            </motion.div>
            <motion.div
              animate={{ opacity: 1, scale: 1, x: 0 }}
              className="presento-topbar-detail-copy presento-topbar-detail-copy-slide"
              initial={{
                opacity: 0,
                scale: 0.985,
                x: titleDrift,
              }}
              key={`${detailTransition.key}-to`}
              transition={titleTransition}
            >
              <strong>{detailTransition.to.title}</strong>
            </motion.div>
          </>
        ) : (
          <div className="presento-topbar-detail-copy presento-topbar-detail-copy-static">
            <strong>{detailState.title}</strong>
          </div>
        )}
      </div>
    </>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <div className="presento-kicker mb-2">{eyebrow}</div> : null}
        <h1 className="presento-title">{title}</h1>
        {description ? (
          <p className="presento-muted mt-3 max-w-2xl text-base font-semibold leading-7">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("presento-card p-5", className)}>{children}</section>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("presento-panel p-5", className)}>{children}</section>;
}

export function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="text-[var(--presento-blue)]" aria-hidden="true" /> : null}
          <h2 className="presento-card-title">{title}</h2>
        </div>
        {description ? (
          <p className="presento-muted mt-2 text-sm font-semibold leading-6">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: PresentoTone;
}) {
  return <span className={cn("presento-badge", `presento-badge-${tone}`)}>{children}</span>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--presento-border)]">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--presento-blue),var(--presento-cyan))] transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function BackLink({ href = "/", label = "返回工作台" }: { href?: string; label?: string }) {
  return (
    <Link className="presento-button-secondary" href={href}>
      <ArrowLeft aria-hidden="true" />
      {label}
    </Link>
  );
}

export function MetricPill({
  label,
  value,
  desc,
  tone = "blue",
}: {
  label: string;
  value: string;
  desc: string;
  tone?: PresentoTone;
}) {
  return (
    <motion.div
      className="presento-metric-pill"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.16 }}
    >
      <div className="presento-muted text-xs font-black">{label}</div>
      <div className={cn("mt-1 text-2xl font-black tracking-tight", toneTextClass(tone))}>
        {value}
      </div>
      <p className="presento-muted mt-1 text-xs font-semibold leading-5">{desc}</p>
    </motion.div>
  );
}

export function FloatingMetricBar({
  metrics,
  action,
  className,
}: {
  metrics: Array<{ label: string; value: string; desc: string; tone?: PresentoTone }>;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("presento-floating-panel p-4", className)}>
      <div className="grid gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <MetricPill key={metric.label} {...metric} />
        ))}
      </div>
      {action ? <div className="mt-4 flex justify-end">{action}</div> : null}
    </div>
  );
}

export function CoachPanel({
  eyebrow = "AI 教练",
  title,
  description,
  children,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn("presento-coach-panel", className)}>
      <div className="flex items-center gap-2">
        <div className="presento-coach-avatar">
          <Bot aria-hidden="true" />
        </div>
        <div className="presento-kicker">{eyebrow}</div>
      </div>
      <h2 className="presento-card-title mt-3">{title}</h2>
      {description ? (
        <p className="presento-muted mt-2 text-sm font-semibold leading-6">{description}</p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
      {actions ? <div className="mt-5 flex flex-col gap-2">{actions}</div> : null}
    </aside>
  );
}

export function GraphCanvas({
  nodes,
  activeId,
  onSelect,
  height = "min-h-[560px]",
  compact = false,
}: {
  nodes: KnowledgeNodeView[];
  activeId: string;
  onSelect: (id: string) => void;
  height?: string;
  compact?: boolean;
}) {
  const flow = useMemo(() => createKnowledgeMapFlow(nodes, activeId), [activeId, nodes]);
  const flowNodes = useMemo<Array<Node<KnowledgeMapFlowNodeData>>>(() => {
    return flow.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        active: node.id === activeId,
      },
    }));
  }, [activeId, flow.nodes]);
  const flowEdges = useMemo<Array<Edge>>(() => {
    return flow.edges.map((edge) => ({
      ...edge,
      style: {
        stroke: edgeStrokeColor(edge.data?.tone ?? "gray"),
        strokeWidth: edge.source === activeId || edge.target === activeId ? 2.1 : 1.4,
      },
    }));
  }, [activeId, flow.edges]);

  return (
    <ReactFlowProvider>
      <div className={cn("presento-graph-canvas", "presento-flow", height, compact && "presento-graph-compact")}>
        <DotPattern
          className="presento-graph-dot-pattern"
          cr={1.45}
          cx={1.5}
          cy={1.5}
          glow={false}
          height={16}
          width={16}
        />
        <ReactFlow
          defaultViewport={{ x: 540, y: 330, zoom: compact ? 0.84 : 1 }}
          edges={flowEdges}
          fitView
          fitViewOptions={{ minZoom: 0.72, maxZoom: 1.08, padding: 0.28 }}
          maxZoom={1.24}
          minZoom={0.62}
          nodeTypes={knowledgeMapNodeTypes}
          nodes={flowNodes}
          nodesConnectable={false}
          nodesDraggable={false}
          onNodeClick={(_, node) => {
            startTransition(() => onSelect(node.id));
          }}
          panOnDrag
          proOptions={{ hideAttribution: true }}
        >
          <KnowledgeGraphControls />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

export const KnowledgeGraphMock = GraphCanvas;

export function RiskCard({
  title,
  desc,
  tone = "orange",
}: {
  title: string;
  desc: string;
  tone?: PresentoTone;
}) {
  return (
    <div className={cn("presento-risk-card", toneBorderClass(tone))}>
      <Badge tone={tone}>{title}</Badge>
      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--presento-muted)]">{desc}</p>
    </div>
  );
}

export function StatusRail({
  items,
}: {
  items: Array<{ label: string; state: string; tone?: PresentoTone }>;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {items.map((item) => (
        <div className="rounded-xl border border-[var(--presento-border)] bg-white/90 p-3 shadow-[var(--presento-card-shadow)]" key={item.label}>
          <div className="presento-muted text-xs font-black">{item.label}</div>
          <div className={cn("mt-1 text-sm font-black", toneTextClass(item.tone ?? "blue"))}>
            {item.state}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SlidePracticePanel({
  slide,
  children,
  className,
}: {
  slide: { page: string; title: string };
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("presento-slide-stage", className)}>
      <div className="presento-slide-screen">
        <div className="mb-8 flex items-center justify-between text-sm font-black text-[var(--presento-muted)]">
          <span>Slide {slide.page}</span>
          <span>{slide.title}</span>
        </div>
        <h2 className="text-4xl font-black tracking-tight text-[var(--presento-ink)] sm:text-5xl">
          {slide.title}
        </h2>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {["前端点餐", "后端订单服务", "数据库与后厨看板"].map((item) => (
            <div className="rounded-2xl border border-[var(--presento-border)] bg-white p-5 text-center text-base font-black shadow-[var(--presento-card-shadow)]" key={item}>
              {item}
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ScriptEditorPanel({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <Panel>
      <div className="mb-2 text-sm font-black">{title}</div>
      <textarea
        className="min-h-44 w-full resize-none rounded-xl border border-[var(--presento-input-border)] bg-white p-4 text-sm font-semibold leading-7 outline-none transition focus:border-[var(--presento-blue)] focus:ring-2 focus:ring-emerald-100"
        defaultValue={value}
      />
    </Panel>
  );
}

export function SkillCard({
  title,
  pack,
  source,
  status,
  desc,
  tone = "purple",
}: {
  title: string;
  pack: string;
  source: string;
  status: string;
  desc: string;
  tone?: PresentoTone;
}) {
  return (
    <article className="rounded-2xl border border-[var(--presento-border)] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--presento-lift-shadow)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{title}</h3>
          <p className="presento-muted mt-1 text-xs font-semibold">{pack}</p>
        </div>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <p className="presento-muted text-sm font-semibold leading-6">{desc}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="gray">{source}</Badge>
        <Badge tone="blue">可观察</Badge>
      </div>
    </article>
  );
}

export function SkillMonitorPanel({
  children,
  title = "系统调用监控",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <aside className="presento-skill-monitor">
      <div className="border-b border-slate-800 p-5 text-xs font-black uppercase tracking-widest text-slate-400">
        {title}
      </div>
      <div className="flex-1 overflow-y-auto p-5 font-mono text-[11px] leading-relaxed">
        {children}
      </div>
    </aside>
  );
}

export function PCGCard({
  title,
  status,
  desc,
  items,
  icon: Icon = Link2,
  tone = "blue",
}: {
  title: string;
  status: string;
  desc: string;
  items: string[];
  icon?: LucideIcon;
  tone?: PresentoTone;
}) {
  return (
    <Card className={cn("border-t-4", toneBorderTopClass(tone))}>
      <SectionHeading icon={Icon} title={title} action={<Badge tone={tone}>{status}</Badge>} />
      <p className="presento-muted text-sm font-semibold leading-6">{desc}</p>
      <div className="mt-5 flex flex-col gap-2">
        {items.map((item) => (
          <div className="rounded-xl border border-[var(--presento-border)] bg-[var(--presento-warm)] px-3 py-2 text-sm font-bold" key={item}>
            {item}
          </div>
        ))}
      </div>
    </Card>
  );
}

function KnowledgeCardNode({ id, data }: NodeProps<Node<KnowledgeMapFlowNodeData>>) {
  return (
    <>
      <Handle className="presento-flow-handle" position={Position.Top} type="target" />
      <Handle className="presento-flow-handle" position={Position.Bottom} type="source" />
      <Handle className="presento-flow-handle" position={Position.Left} type="target" />
      <Handle className="presento-flow-handle" position={Position.Right} type="source" />
      <motion.div
        animate={{ scale: data.active ? 1.08 : 1 }}
        className={cn(
          "presento-graph-node",
          data.active && "presento-graph-node-active",
          toneRingClass(data.tone),
        )}
        transition={{ duration: 0.18 }}
      >
        <div className={cn("presento-graph-icon", toneBgClass(data.tone))}>
          <KnowledgeNodeIcon id={id} />
        </div>
        <span className="truncate text-sm font-black">{data.title}</span>
      </motion.div>
    </>
  );
}

function KnowledgeNodeIcon({ id }: { id: string }) {
  if (id.includes("ppt")) return <FileText aria-hidden="true" />;
  if (id.includes("code")) return <Cpu aria-hidden="true" />;
  if (id.includes("db")) return <ChartSpline aria-hidden="true" />;
  if (id.includes("risk")) return <Bot aria-hidden="true" />;
  if (id.includes("weak")) return <Target aria-hidden="true" />;
  return <Brain aria-hidden="true" />;
}

function KnowledgeGraphControls() {
  const reactFlow = useReactFlow();

  return (
    <div className="presento-graph-controls">
      <button onClick={() => reactFlow.zoomIn({ duration: 180 })} type="button">
        +
      </button>
      <button onClick={() => reactFlow.zoomOut({ duration: 180 })} type="button">
        -
      </button>
      <button
        onClick={() => reactFlow.fitView({ duration: 220, padding: 0.28, minZoom: 0.72, maxZoom: 1.08 })}
        type="button"
      >
        <Home aria-hidden="true" />
      </button>
    </div>
  );
}

const knowledgeMapNodeTypes = {
  knowledgeCard: KnowledgeCardNode,
};

function toneBgClass(tone: PresentoTone) {
  return {
    blue: "bg-[var(--presento-blue)]",
    gray: "bg-[var(--presento-muted)]",
    orange: "bg-[var(--presento-warning)]",
    green: "bg-[var(--presento-success)]",
    red: "bg-[var(--presento-danger)]",
    purple: "bg-[var(--presento-ai)]",
    cyan: "bg-[var(--presento-cyan)]",
  }[tone];
}

function edgeStrokeColor(tone: PresentoTone) {
  return {
    blue: "rgba(16, 185, 129, 0.7)",
    gray: "rgba(203, 213, 225, 0.92)",
    orange: "rgba(223, 164, 74, 0.86)",
    green: "rgba(66, 184, 131, 0.86)",
    red: "rgba(224, 108, 117, 0.82)",
    purple: "rgba(139, 92, 246, 0.72)",
    cyan: "rgba(106, 159, 216, 0.76)",
  }[tone];
}

function toneTextClass(tone: PresentoTone) {
  return {
    blue: "text-[var(--presento-blue-active)]",
    gray: "text-[var(--presento-muted)]",
    orange: "text-[#c56a09]",
    green: "text-[#15803d]",
    red: "text-[#dc2626]",
    purple: "text-[#7c3aed]",
    cyan: "text-[#0891b2]",
  }[tone];
}

function toneRingClass(tone: PresentoTone) {
  return {
    blue: "border-blue-200",
    gray: "border-slate-200",
    orange: "border-orange-200",
    green: "border-emerald-200",
    red: "border-red-200",
    purple: "border-purple-200",
    cyan: "border-cyan-200",
  }[tone];
}

function toneBorderClass(tone: PresentoTone) {
  return {
    blue: "border-blue-100",
    gray: "border-slate-100",
    orange: "border-orange-100",
    green: "border-emerald-100",
    red: "border-red-100",
    purple: "border-purple-100",
    cyan: "border-cyan-100",
  }[tone];
}

function toneBorderTopClass(tone: PresentoTone) {
  return {
    blue: "border-t-[var(--presento-blue)]",
    gray: "border-t-slate-300",
    orange: "border-t-[var(--presento-warning)]",
    green: "border-t-[var(--presento-success)]",
    red: "border-t-[var(--presento-danger)]",
    purple: "border-t-[var(--presento-ai)]",
    cyan: "border-t-[var(--presento-cyan)]",
  }[tone];
}
