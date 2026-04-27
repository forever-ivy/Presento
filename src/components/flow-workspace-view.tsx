"use client";

import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  Code,
  FileQuestion,
  FileText,
  FileUp,
  Map,
  MessageSquareText,
  Mic,
  Play,
  Radio,
  Search,
  Sparkles,
  Target,
  UploadCloud,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { AppFrame, PageWrap, TopNav, cn } from "@/components/presento-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DotPattern } from "@/components/magicui/dot-pattern";
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/components/ui/scroll-based-velocity";
import {
  FLOW_MAP_OVERVIEW_MAX_ZOOM,
  FLOW_MAP_OVERVIEW_MIN_ZOOM,
  FLOW_MAP_OVERVIEW_PADDING,
  createFlowWorkspaceFlow,
  flowRouteToMode,
  flowStepToRoute,
  getFlowCameraAction,
  getFlowNodeMotionState,
  shouldAnimateFlowModeTransition,
  getFlowWorkspaceInitialRoomStep,
  getFlowTransitionPreset,
  getFlowWorkspaceTransitionStep,
  getFlowStepById,
  getFlowStepByRoute,
  type FlowMode,
  type FlowRoomKind,
  type FlowStepId,
  type FlowStep,
  type FlowWorkspaceNodeData,
} from "@/lib/flow-workspace";
import {
  demoDeepDives,
  demoDefenseTurns,
  demoFiles,
  demoKnowledgeNodes,
  demoProcessingTasks,
  demoProject,
  demoReviewMetrics,
  demoSkillInvocations,
  demoSkillPacks,
  demoSlideScripts,
} from "@/lib/demo-data";
import { uploadDefenseFiles } from "@/lib/upload-files";
import { useWorkspace } from "@/lib/use-workspace";

gsap.registerPlugin(useGSAP);

const ENTER_MS = 820;
const EXIT_MS = 460;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const BACKGROUND_COPY_VISIBLE_MS = 10_000;
const BACKGROUND_COPY_FADE_MS = 900;
const BACKGROUND_COPY_EXIT_NAV_DELAY_MS = 180;
let pendingReturnStepId: FlowStepId | null = null;

export function FlowWorkspaceView() {
  const pathname = usePathname();
  const router = useRouter();
  const targetMode = flowRouteToMode(pathname);
  const activeStep = getFlowStepByRoute(pathname);
  const [mode, setMode] = useState<FlowMode>(() => (targetMode === "map" ? "map" : "entering"));
  const [lastRoomStep, setLastRoomStep] = useState(() => {
    const pendingReturnStep = pendingReturnStepId ? getFlowStepById(pendingReturnStepId) : null;
    if (targetMode === "map") pendingReturnStepId = null;

    return getFlowWorkspaceInitialRoomStep({
      activeStep,
      pendingReturnStep,
      targetMode,
    });
  });
  const workspaceRef = useRef<HTMLElement | null>(null);
  const initializedRef = useRef(false);
  const pendingModeRef = useRef(targetMode);
  const previousTargetModeRef = useRef<Exclude<FlowMode, "entering"> | null>(null);
  const delayedNavigationTimerRef = useRef<number | null>(null);
  const backgroundShowTimerRef = useRef<number | null>(null);
  const backgroundHideTimerRef = useRef<number | null>(null);
  const [backgroundVisible, setBackgroundVisible] = useState(() => targetMode === "map");

  const visibleRoomStep = targetMode === "inside" ? activeStep : lastRoomStep;
  const transitionStep = getFlowWorkspaceTransitionStep({
    activeStep,
    lastRoomStep,
    targetMode,
  });

  useEffect(() => {
    pendingModeRef.current = targetMode;
    const isInitialRender = !initializedRef.current;
    const previousTargetMode = previousTargetModeRef.current;
    const animateTransition = shouldAnimateFlowModeTransition({
      isInitialRender,
      previousTargetMode,
      targetMode,
    });

    previousTargetModeRef.current = targetMode;
    initializedRef.current = true;

    if (!animateTransition) {
      setMode(targetMode);
      return;
    }

    const enteringTimer = window.setTimeout(() => setMode("entering"), 0);

    const doneTimer = window.setTimeout(() => {
      if (pendingModeRef.current === "map") setMode("map");
      if (pendingModeRef.current === "inside") setMode("inside");
    }, targetMode === "map" ? EXIT_MS : ENTER_MS);

    return () => {
      window.clearTimeout(enteringTimer);
      window.clearTimeout(doneTimer);
    };
  }, [pathname, targetMode]);

  useEffect(() => {
    if (backgroundShowTimerRef.current) {
      window.clearTimeout(backgroundShowTimerRef.current);
      backgroundShowTimerRef.current = null;
    }
    if (backgroundHideTimerRef.current) {
      window.clearTimeout(backgroundHideTimerRef.current);
      backgroundHideTimerRef.current = null;
    }

    if (mode !== "map") return;

    backgroundShowTimerRef.current = window.setTimeout(() => {
      setBackgroundVisible(true);
      backgroundShowTimerRef.current = null;

      backgroundHideTimerRef.current = window.setTimeout(() => {
        setBackgroundVisible(false);
        backgroundHideTimerRef.current = null;
      }, BACKGROUND_COPY_VISIBLE_MS);
    }, 0);

    return () => {
      if (backgroundShowTimerRef.current) {
        window.clearTimeout(backgroundShowTimerRef.current);
        backgroundShowTimerRef.current = null;
      }
      if (backgroundHideTimerRef.current) {
        window.clearTimeout(backgroundHideTimerRef.current);
        backgroundHideTimerRef.current = null;
      }
    };
  }, [mode]);

  useEffect(() => {
    return () => {
      if (delayedNavigationTimerRef.current) {
        window.clearTimeout(delayedNavigationTimerRef.current);
      }
      if (backgroundShowTimerRef.current) {
        window.clearTimeout(backgroundShowTimerRef.current);
      }
      if (backgroundHideTimerRef.current) {
        window.clearTimeout(backgroundHideTimerRef.current);
      }
    };
  }, []);

  function navigateWithBackgroundExit(href: string) {
    if (href === pathname) return;

    if (delayedNavigationTimerRef.current) {
      window.clearTimeout(delayedNavigationTimerRef.current);
      delayedNavigationTimerRef.current = null;
    }

    if (mode === "map" && backgroundVisible) {
      setBackgroundVisible(false);
      // Let the fade begin, but do not block dock navigation for the full copy fade.
      delayedNavigationTimerRef.current = window.setTimeout(() => {
        delayedNavigationTimerRef.current = null;
        startTransition(() => router.push(href));
      }, BACKGROUND_COPY_EXIT_NAV_DELAY_MS);
      return;
    }

    startTransition(() => router.push(href));
  }

  function enterStep(stepId: FlowStepId) {
    pendingReturnStepId = null;
    setLastRoomStep(getFlowStepById(stepId));
    navigateWithBackgroundExit(flowStepToRoute(stepId));
  }

  function exitStep() {
    pendingReturnStepId = activeStep.id;
    setLastRoomStep(activeStep);
    startTransition(() => router.push("/"));
  }

  return (
    <AppFrame>
      <TopNav onNavigate={navigateWithBackgroundExit} />
      <PageWrap className="presento-map-page">
        <section className={cn("presento-flow-workspace", `presento-flow-workspace-${mode}`)} ref={workspaceRef}>
          {mode === "map" ? <MapBackgroundCopy visible={backgroundVisible} /> : null}
          <FlowTransitionDirector
            activeStep={transitionStep}
            mode={mode}
            scopeRef={workspaceRef}
            targetMode={targetMode}
          />
          <ReactFlowProvider>
            <FlowWorkspaceCanvas activeId={transitionStep.id} mode={mode} onEnterStep={enterStep} targetMode={targetMode} />
          </ReactFlowProvider>

          {mode !== "map" ? (
            <>
              <StepRoomShell step={visibleRoomStep} />
              <StepRoom activeId={visibleRoomStep.id} key={visibleRoomStep.id} onBack={exitStep} />
            </>
          ) : null}
        </section>
      </PageWrap>
    </AppFrame>
  );
}

function FlowTransitionDirector({
  activeStep,
  mode,
  scopeRef,
  targetMode,
}: {
  activeStep: FlowStep;
  mode: FlowMode;
  scopeRef: RefObject<HTMLElement | null>;
  targetMode: Exclude<FlowMode, "entering">;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const preset = useMemo(() => getFlowTransitionPreset(mode, activeStep), [activeStep, mode]);
  const mapPreset = useMemo(() => getFlowTransitionPreset("map", activeStep), [activeStep]);

  useGSAP(
    () => {
      if (!scopeRef.current) return;

      const canvas = ".presento-process-canvas";
      const room = ".presento-step-room";
      const shell = ".presento-step-room-shell";

      if (reduceMotion) {
        gsap.set(canvas, {
          opacity: preset.canvas.opacity,
          scale: mode === "inside" ? preset.canvas.scale : 1,
          filter: mode === "inside" ? `blur(${preset.canvas.blur}px) saturate(${preset.canvas.saturation})` : "blur(0px) saturate(1)",
        });
        gsap.set(shell, {
          clipPath: mode === "map" ? mapPreset.portalShell.clipFrom : preset.portalShell.clipTo,
          opacity: mode === "map" ? 0 : 0.72,
          scale: 1,
          y: 0,
        });
        gsap.set(room, {
          opacity: mode === "inside" ? 1 : 0,
          scale: 1,
          y: 0,
        });
        return;
      }

      const timeline = gsap.timeline({
        defaults: { ease: preset.ease, force3D: true, overwrite: "auto" },
      });

      if (mode === "map") {
        timeline
          .to(canvas, {
            duration: mapPreset.canvas.duration / 1000,
            scale: mapPreset.canvas.scale,
            filter: "blur(0px) saturate(1)",
            opacity: mapPreset.canvas.opacity,
            ease: "power2.inOut",
          }, 0.1);
        return;
      }

      if (mode === "entering" && targetMode === "map") {
        timeline
          .to(shell, {
            duration: mapPreset.portalShell.duration / 1000,
            clipPath: mapPreset.portalShell.clipFrom,
            opacity: 0,
            scale: mapPreset.portalShell.scaleFrom,
            y: mapPreset.portalShell.yFrom,
            ease: "power2.inOut",
          }, 0)
          .to(room, {
            duration: mapPreset.room.duration / 1000,
            opacity: 0,
            scale: mapPreset.room.scaleFrom,
            y: mapPreset.room.yFrom,
            ease: "power2.inOut",
          }, 0)
          .to(canvas, {
            duration: mapPreset.canvas.duration / 1000,
            scale: mapPreset.canvas.scale,
            filter: "blur(0px) saturate(1)",
            opacity: mapPreset.canvas.opacity,
            ease: "power2.inOut",
          }, 0.22);
        return;
      }

      timeline
        .to(canvas, {
          duration: preset.canvas.duration / 1000,
          scale: preset.canvas.scale,
          filter: `blur(${preset.canvas.blur}px) saturate(${preset.canvas.saturation})`,
          opacity: preset.canvas.opacity,
          ease: "power3.out",
        }, mode === "inside" ? 0.12 : 0.18);

      if (mode === "entering") {
        timeline
          .set(shell, {
            clipPath: preset.portalShell.clipFrom,
            opacity: 0,
            scale: preset.portalShell.scaleFrom,
            y: preset.portalShell.yFrom,
            transformOrigin: "50% 48%",
          }, 0)
          .to(shell, {
            duration: preset.portalShell.duration / 1000,
            clipPath: preset.portalShell.clipTo,
            opacity: preset.portalShell.opacityTo,
            scale: 1,
            y: 0,
            ease: "power3.out",
          }, preset.portalShell.delay)
          .set(room, {
            opacity: 0,
            scale: preset.room.scaleFrom,
            y: preset.room.yFrom,
            transformOrigin: "50% 48%",
          }, 0);
      }

      if (mode === "inside") {
        timeline
          .to(shell, {
            duration: preset.portalShell.duration / 1000,
            clipPath: preset.portalShell.clipTo,
            opacity: preset.portalShell.opacityTo,
            scale: 1,
            y: 0,
            ease: "power3.out",
          }, 0)
          .fromTo(room, {
            opacity: 0,
            scale: preset.room.scaleFrom,
            y: preset.room.yFrom,
            transformOrigin: "50% 48%",
          }, {
            duration: preset.room.duration / 1000,
            opacity: 1,
            scale: 1,
            y: 0,
            ease: preset.name === "immersive" ? "expo.out" : "power3.out",
          }, preset.room.delay);
      }
    },
    {
      dependencies: [activeStep.id, mode, preset, mapPreset, reduceMotion, targetMode],
      revertOnUpdate: false,
      scope: scopeRef,
    },
  );

  return null;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(reducedMotionQuery);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function getDemoDefenseDeadlineMs() {
  if (demoProject.defenseAt) {
    const parsed = Date.parse(demoProject.defenseAt);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return Date.now() + 2 * DAY_MS;
}

function formatCountdownLabel(totalMinutes: number) {
  const minutes = Math.max(0, totalMinutes);
  const fullDays = Math.floor(minutes / (24 * 60));
  if (fullDays >= 1) return `${fullDays}天`;

  const fullHours = Math.floor(minutes / 60);
  if (fullHours >= 1) return `${fullHours}小时`;

  return `${Math.max(1, minutes)}分钟`;
}

function MapBackgroundCopy({ visible }: { visible: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const [deadlineMs] = useState(getDemoDefenseDeadlineMs);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, MINUTE_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const countdownMinutes = Math.max(
    0,
    Math.ceil((deadlineMs - now) / MINUTE_MS),
  );
  const countdownLabel = formatCountdownLabel(countdownMinutes);

  return (
    <motion.div
      animate={{ opacity: visible ? 1 : 0 }}
      aria-hidden="true"
      className="presento-flow-background-copy"
      initial={{ opacity: 0 }}
      transition={{ duration: BACKGROUND_COPY_FADE_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
    >
      <ScrollVelocityContainer className="presento-flow-background-copy-track">
        <ScrollVelocityRow
          baseVelocity={1.22}
          className="presento-flow-background-copy-row presento-flow-background-copy-row-primary"
          direction={-1}
          scrollReactivity={false}
        >
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-base">剩余</span>
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-red presento-flow-background-copy-accent-primary">
              {countdownLabel}
            </span>
          </span>
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-base">剩余</span>
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-red presento-flow-background-copy-accent-primary">
              {countdownLabel}
            </span>
          </span>
        </ScrollVelocityRow>
        <ScrollVelocityRow
          baseVelocity={0.86}
          className="presento-flow-background-copy-row presento-flow-background-copy-row-secondary"
          direction={1}
          scrollReactivity={false}
        >
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-lime presento-flow-background-copy-accent-secondary presento-flow-background-copy-accent-leading">
              {demoProject.readiness}%
            </span>
            <span className="presento-flow-background-copy-base">已经完成</span>
          </span>
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-lime presento-flow-background-copy-accent-secondary presento-flow-background-copy-accent-leading">
              {demoProject.readiness}%
            </span>
            <span className="presento-flow-background-copy-base">已经完成</span>
          </span>
        </ScrollVelocityRow>
      </ScrollVelocityContainer>
    </motion.div>
  );
}

function FlowWorkspaceCanvas({
  activeId,
  mode,
  onEnterStep,
  targetMode,
}: {
  activeId: FlowStepId;
  mode: FlowMode;
  onEnterStep: (stepId: FlowStepId) => void;
  targetMode: Exclude<FlowMode, "entering">;
}) {
  const flow = useMemo(() => createFlowWorkspaceFlow(activeId), [activeId]);
  const fitViewOptions = useMemo(() => ({
    padding: FLOW_MAP_OVERVIEW_PADDING,
    minZoom: FLOW_MAP_OVERVIEW_MIN_ZOOM,
    maxZoom: FLOW_MAP_OVERVIEW_MAX_ZOOM,
  }), []);
  const nodes = useMemo<Array<Node<FlowWorkspaceNodeData>>>(() => {
    return flow.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        mode,
      },
    }));
  }, [flow.nodes, mode]);
  const edges = useMemo<Array<Edge>>(() => flow.edges, [flow.edges]);

  return (
    <div className={cn("presento-process-canvas presento-flow", `presento-process-canvas-${mode}`)}>
      <DotPattern
        className="presento-graph-dot-pattern"
        cr={1.7}
        cx={1.5}
        cy={1.5}
        glow={false}
        height={15}
        width={15}
      />
      <ReactFlow
        defaultViewport={{ x: 500, y: 260, zoom: 0.62 }}
        edges={edges}
        fitView={targetMode === "map"}
        fitViewOptions={fitViewOptions}
        maxZoom={1.8}
        minZoom={FLOW_MAP_OVERVIEW_MIN_ZOOM}
        nodeTypes={flowWorkspaceNodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={(_, node) => onEnterStep(node.id as FlowStepId)}
        panOnDrag
        proOptions={{ hideAttribution: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <FlowCamera activeId={activeId} mode={mode} targetMode={targetMode} />
      </ReactFlow>
    </div>
  );
}

function StepRoomShell({ step }: { step: FlowStep }) {
  return (
    <div aria-hidden="true" className={cn("presento-step-room-shell", roomKindClass(step.roomKind))}>
      <div className="presento-step-room-shell-glow" />
      <div className="presento-step-room-shell-header">
        <div className={cn("presento-step-room-shell-icon", processIconToneClass(step.tone))}>
          <ProcessNodeIcon id={step.id} />
        </div>
        <div className="presento-step-room-shell-copy">
          <span>{roomKindLabel(step.roomKind)}</span>
          <strong>{step.label}</strong>
        </div>
        <div className="presento-step-room-shell-pill">{step.shortLabel}</div>
      </div>
      <div className="presento-step-room-shell-body">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}

function FlowCamera({
  activeId,
  mode,
  targetMode,
}: {
  activeId: FlowStepId;
  mode: FlowMode;
  targetMode: Exclude<FlowMode, "entering">;
}) {
  const reactFlow = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const activeStep = useMemo(() => getFlowStepById(activeId), [activeId]);
  const preset = useMemo(() => getFlowTransitionPreset(mode, activeStep), [activeStep, mode]);
  const cameraAction = useMemo(() => getFlowCameraAction(mode, targetMode), [mode, targetMode]);

  useEffect(() => {
    if (!nodesInitialized) return;

    if (cameraAction === "hold") return;

    if (cameraAction === "fit" && preset.camera.type === "fit") {
      void reactFlow.fitView({
        duration: preset.camera.duration,
        padding: preset.camera.padding,
        minZoom: preset.camera.minZoom,
        maxZoom: preset.camera.maxZoom,
      });
      return;
    }

    if (preset.camera.type !== "center") return;

    const node = reactFlow.getNode(activeId);
    if (!node) return;

    const nodeWidth = node.measured?.width ?? node.width ?? 376;
    const nodeHeight = node.measured?.height ?? node.height ?? 150;

    reactFlow.setCenter(node.position.x + nodeWidth / 2 + preset.camera.offset.x, node.position.y + nodeHeight / 2 + preset.camera.offset.y, {
      duration: preset.camera.duration,
      zoom: preset.camera.zoom,
    });
  }, [activeId, cameraAction, nodesInitialized, preset, reactFlow]);

  return null;
}

function FlowStepNode({ id, data }: NodeProps<Node<FlowWorkspaceNodeData>>) {
  const mode = data.mode ?? "map";
  const motionState = getFlowNodeMotionState(mode, data.active);

  return (
    <>
      <Handle className="presento-flow-handle" position={Position.Left} type="target" />
      <Handle className="presento-flow-handle" position={Position.Right} type="source" />
      <Handle className="presento-flow-handle" position={Position.Top} type="target" />
      <Handle className="presento-flow-handle" position={Position.Bottom} type="source" />
      <motion.article
        animate={motionState}
        className={cn(
          "presento-process-node",
          data.active && "presento-process-node-active",
          data.active && mode !== "map" && "presento-process-node-entered",
          processToneClass(data.tone),
        )}
        initial={false}
        layout
        transition={{ duration: 0.3, ease: [0.2, 0.95, 0.28, 1] }}
      >
        <header className="presento-process-node-header">
          <div className={cn("presento-process-node-icon", processIconToneClass(data.tone))}>
            <ProcessNodeIcon id={id as FlowStepId} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-black text-[var(--presento-faint)]">
              {data.shortLabel}
            </div>
            <h2 className="truncate text-[1.56rem] font-black leading-tight text-[var(--presento-ink)]">
              {data.label}
            </h2>
          </div>
          <Badge className={toneBadgeClass(data.tone)}>{statusLabel(data.status)}</Badge>
        </header>

        <p className="mt-3 text-[16px] font-semibold leading-7 text-[var(--presento-muted)]">
          {data.summary}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.metrics.map((metric) => (
            <Badge className="presento-room-badge-muted" key={metric}>
              {metric}
            </Badge>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 text-[14px] font-black text-[var(--presento-faint)]">
          <span className={cn("presento-flow-status-dot", data.active && "presento-flow-status-dot-active")} />
          <span>{data.stateLine}</span>
        </div>
      </motion.article>
    </>
  );
}

function StepRoom({
  activeId,
  onBack,
}: {
  activeId: FlowStepId;
  onBack: () => void;
}) {
  const step = getFlowStepById(activeId);

  return (
    <section
      className={cn("presento-step-room", roomKindClass(step.roomKind))}
    >
      <header className="presento-step-room-header">
        <Button
          className="rounded-xl border-[var(--presento-border)] bg-white/86 font-black"
          onClick={onBack}
          type="button"
          variant="outline"
        >
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          返回图谱
        </Button>
        <div className="min-w-0">
          <div className="text-xs font-black text-[var(--presento-blue-active)]">
            当前训练空间
          </div>
          <h1 className="truncate text-2xl font-black text-[var(--presento-ink)]">
            {step.label}
          </h1>
        </div>
        <div className="ml-auto hidden flex-wrap items-center gap-2 lg:flex">
          <Badge className={toneBadgeClass(step.tone)}>{roomKindLabel(step.roomKind)}</Badge>
          <Badge className="presento-room-badge-muted">{step.stateLine}</Badge>
        </div>
      </header>

      <ScrollArea className="presento-step-room-scroll">
        <main className="presento-step-room-body">
          <StepRoomContent stepId={activeId} />
        </main>
      </ScrollArea>
    </section>
  );
}

function StepRoomContent({ stepId }: { stepId: FlowStepId }) {
  if (stepId === "files") return <FilesRoom />;
  if (stepId === "knowledge") return <KnowledgeRoom />;
  if (stepId === "scripts") return <ScriptsRoom />;
  if (stepId === "defense") return <DefenseRoom />;
  if (stepId === "review") return <ReviewRoom />;
  if (stepId === "deepDive") return <DeepDiveRoom />;
  if (stepId === "skills") return <SkillsRoom />;
  return <PCGRoom />;
}

function FilesRoom() {
  const { workspace, summary, addFiles, runProcessing } = useWorkspace();
  const [isUploading, setIsUploading] = useState(false);
  const files = workspace?.files.length
    ? workspace.files.map((file) => ({
        name: file.name,
        status: file.status,
        source: file.source,
      }))
    : demoFiles;
  const tasks = workspace?.processingTasks.length ? workspace.processingTasks : demoProcessingTasks;

  async function uploadMore(fileList: FileList | null) {
    if (!fileList?.length) return;
    setIsUploading(true);

    try {
      const uploadedFiles = await uploadDefenseFiles(Array.from(fileList));
      addFiles(uploadedFiles);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <RoomGrid>
      <RoomCard
        action={<Badge className="presento-room-badge-blue">{summary?.fileCount ?? files.length} 份资料</Badge>}
        icon={<UploadCloud aria-hidden="true" />}
        title="知识源接入舱"
        description="把 PPT、报告、代码与数据接入 Presento，生成后续训练图谱。"
      >
        <label className="presento-room-upload">
          <FileUp aria-hidden="true" />
          <span>{isUploading ? "正在上传..." : "继续上传资料"}</span>
          <small>PDF/PPT、README、代码 zip、SQL、CSV/Excel</small>
          <input className="sr-only" multiple onChange={(event) => uploadMore(event.target.files)} type="file" />
        </label>
      </RoomCard>

      <RoomCard icon={<FileText aria-hidden="true" />} title="文件列表" description="流程图只展示状态，这里才展开具体文件。">
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <StatusRow badge={file.status} icon={<FileText aria-hidden="true" />} key={`${file.name}-${file.status}`} label={file.name} meta={file.source} />
          ))}
        </div>
      </RoomCard>

      <RoomCard className="lg:col-span-2" icon={<Bot aria-hidden="true" />} title="解析队列" description="读取、切片、索引、抽取节点、生成风险。">
        <div className="grid gap-3 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card className="gap-4 rounded-2xl border-[var(--presento-border)] bg-white/86 py-4 shadow-none" key={task.id}>
              <CardHeader className="px-4">
                <CardTitle className="truncate text-sm font-black">{task.title}</CardTitle>
                <CardDescription className="font-semibold">{task.engine}</CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <Progress className="bg-[var(--presento-border)] [&>div]:bg-[var(--presento-blue)]" value={task.progress} />
                <div className="mt-3 flex items-center justify-between gap-2 text-xs font-black text-[var(--presento-muted)]">
                  <span>{task.fileName}</span>
                  <Badge className={task.status === "completed" ? "presento-room-badge-green" : task.status === "processing" ? "presento-room-badge-orange" : "presento-room-badge-muted"}>
                    {task.status}
                  </Badge>
                </div>
                {workspace?.processingTasks.length && task.status === "processing" ? (
                  <Button className="mt-4 w-full rounded-xl font-black" onClick={() => runProcessing(task.id)} type="button" variant="outline">
                    写入解析结果
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </RoomCard>
    </RoomGrid>
  );
}

function KnowledgeRoom() {
  const projectNode = demoKnowledgeNodes[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <RoomCard
        action={<Badge className="presento-room-badge-blue">核心节点</Badge>}
        className="min-h-[520px]"
        icon={<Map aria-hidden="true" />}
        title="项目知识地图"
        description="把资料、证据链、高危追问和训练动作组织成可进入的项目大脑。"
      >
        <div className="presento-room-knowledge-orbit">
          <div className="presento-room-knowledge-center">
            <Sparkles aria-hidden="true" />
            <strong>{projectNode.title}</strong>
            <span>{projectNode.risk}</span>
          </div>
          {demoKnowledgeNodes.slice(1).map((node, index) => (
            <div className={cn("presento-room-knowledge-node", `presento-room-knowledge-node-${index}`)} key={node.id}>
              <Badge className={toneBadgeClass(node.tone)}>{node.type}</Badge>
              <strong>{node.title}</strong>
              <span>{node.risk}</span>
            </div>
          ))}
        </div>
      </RoomCard>

      <div className="grid gap-4">
        <RoomCard icon={<FileText aria-hidden="true" />} title="证据链" description="详情空间展示完整依据，外层图谱保持干净。">
          <div className="flex flex-col gap-2">
            {["答辩 PPT 第 1-3 页", "README.md 项目介绍", "backend.zip / routes/orders.ts", "orders.sql 表结构"].map((item) => (
              <StatusRow icon={<CheckCircle2 aria-hidden="true" />} key={item} label={item} meta="已关联" />
            ))}
          </div>
        </RoomCard>
        <RoomCard icon={<MessageSquareText aria-hidden="true" />} title="高危追问" description="进入讲练前先确认风险点。">
          <QuestionList
            items={["订单状态流转怎么设计？", "后厨接单后还能取消吗？", "这个模块是不是你负责的？", "数据库金额快照为什么需要冗余？"]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild className="rounded-xl bg-[var(--presento-navy)] font-black text-white">
              <Link href="/projects/demo/defense">围绕此节点讲练</Link>
            </Button>
            <Button asChild className="rounded-xl font-black" variant="outline">
              <Link href="/projects/demo/scripts">生成回答框架</Link>
            </Button>
          </div>
        </RoomCard>
      </div>
    </div>
  );
}

function ScriptsRoom() {
  const activeSlide = demoSlideScripts[1];

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
      <RoomCard icon={<FileQuestion aria-hidden="true" />} title="PPT 页" description="选择页面后生成对应讲解路径。">
        <div className="flex flex-col gap-2">
          {demoSlideScripts.slice(0, 5).map((slide) => (
            <button className={cn("presento-slide-thumb", slide.page === activeSlide.page && "presento-slide-thumb-active")} key={slide.page} type="button">
              <span>Slide {slide.page}</span>
              <strong>{slide.title}</strong>
              <small>{slide.duration} · {slide.status}</small>
            </button>
          ))}
        </div>
      </RoomCard>

      <RoomCard icon={<FileText aria-hidden="true" />} title={`Slide ${activeSlide.page} · ${activeSlide.title}`} description="正常版、30 秒版和关键词版都绑定当前页证据链。">
        <Tabs className="gap-4" defaultValue="normal">
          <TabsList className="bg-[var(--presento-hover)]">
            <TabsTrigger value="normal">正常版</TabsTrigger>
            <TabsTrigger value="short">30 秒版</TabsTrigger>
            <TabsTrigger value="keywords">关键词版</TabsTrigger>
          </TabsList>
          <TabsContent value="normal">
            <Textarea className="min-h-72 rounded-2xl border-[var(--presento-border)] bg-white/92 text-sm font-semibold leading-7" defaultValue={activeSlide.normal} />
          </TabsContent>
          <TabsContent value="short">
            <Textarea className="min-h-72 rounded-2xl border-[var(--presento-border)] bg-white/92 text-sm font-semibold leading-7" defaultValue={activeSlide.short} />
          </TabsContent>
          <TabsContent value="keywords">
            <div className="flex min-h-72 flex-wrap content-start gap-2 rounded-2xl border border-[var(--presento-border)] bg-white/92 p-4">
              {activeSlide.keywords.map((keyword) => (
                <Badge className="presento-room-badge-blue" key={keyword}>{keyword}</Badge>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </RoomCard>

      <RoomCard icon={<Target aria-hidden="true" />} title="本页高危" description="讲稿从这里直接进入同屏讲练。">
        <QuestionList items={activeSlide.risks} />
        <Button asChild className="mt-4 w-full rounded-xl bg-[var(--presento-navy)] font-black text-white">
          <Link href="/projects/demo/defense">
            <Mic data-icon="inline-start" aria-hidden="true" />
            用这一页开练
          </Link>
        </Button>
      </RoomCard>
    </div>
  );
}

function DefenseRoom() {
  return (
    <div className="presento-defense-room">
      <div className="presento-defense-topline">
        <Badge className="presento-room-badge-orange">严格老师模式</Badge>
        <Badge className="presento-room-badge-muted">第 2 页 / 18 页</Badge>
        <Badge className="presento-room-badge-blue">
          <Clock aria-hidden="true" />
          04:32
        </Badge>
      </div>

      <section className="presento-defense-stage">
        <div className="presento-defense-slide">
          <span>Slide 02</span>
          <h2>系统架构</h2>
          <p>订单流转 / 状态机 / 接口权限</p>
          <div className="grid gap-3 md:grid-cols-3">
            {["前端点餐", "后端订单服务", "数据库与后厨看板"].map((item) => (
              <div className="rounded-2xl border border-[var(--presento-border)] bg-white px-4 py-6 text-center text-sm font-black" key={item}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <RoomCard className="min-h-full" icon={<Bot aria-hidden="true" />} title="AI 老师追问" description="围绕当前 PPT 页连续追问，不是普通聊天。">
          <div className="flex flex-col gap-3">
            {demoDefenseTurns.map((turn) => (
              <div className={cn("presento-defense-message", turn.speaker === "我" && "presento-defense-message-user")} key={`${turn.speaker}-${turn.content}`}>
                <strong>{turn.speaker}</strong>
                <span>{turn.content}</span>
              </div>
            ))}
          </div>
          <Separator className="my-5 bg-[var(--presento-border)]" />
          <div className="grid gap-2">
            <Button className="rounded-xl font-black" variant="outline">给我关键词</Button>
            <Button className="rounded-xl font-black" variant="outline">生成回答框架</Button>
            <Button asChild className="rounded-xl font-black" variant="outline">
              <Link href="/projects/demo/deep-dive">卡住了，进入钻研</Link>
            </Button>
          </div>
        </RoomCard>
      </section>

      <section className="presento-defense-console">
        <Button className="size-14 rounded-full bg-[var(--presento-warning)] text-white hover:bg-[#c98722]" size="icon">
          <Mic aria-label="开始录音" />
        </Button>
        <Textarea className="min-h-16 flex-1 rounded-2xl border-[var(--presento-border)] bg-white/94 font-semibold" placeholder="也可以输入回答文本，作为语音训练兜底..." />
        <Button className="rounded-xl bg-[var(--presento-navy)] font-black text-white">
          <Play data-icon="inline-start" aria-hidden="true" />
          我讲完了
        </Button>
      </section>
    </div>
  );
}

function ReviewRoom() {
  return (
    <RoomGrid>
      <RoomCard action={<Badge className="presento-room-badge-green">82 / 100</Badge>} icon={<MessageSquareText aria-hidden="true" />} title="本轮一句话结论" description="表达主线清楚，但数据库设计和个人贡献仍有风险。">
        <div className="grid gap-3 sm:grid-cols-2">
          {demoReviewMetrics.map((metric) => (
            <div className="rounded-2xl border border-[var(--presento-border)] bg-white/88 p-4" key={metric.label}>
              <div className="text-xs font-black text-[var(--presento-muted)]">{metric.label}</div>
              <div className="mt-2 text-3xl font-black text-[var(--presento-ink)]">{metric.value}</div>
              <Progress className="mt-3 bg-[var(--presento-border)] [&>div]:bg-[var(--presento-blue)]" value={metric.value} />
            </div>
          ))}
        </div>
      </RoomCard>
      <RoomCard icon={<Target aria-hidden="true" />} title="下一轮训练任务" description="复盘结果会回流到薄弱点和知识地图。">
        <QuestionList items={["补数据库金额快照解释", "专项练第 2 页系统架构", "明确个人负责订单接口范围", "把高质量回答转成 30 秒口播"]} />
      </RoomCard>
      <RoomCard className="lg:col-span-2" icon={<Radio aria-hidden="true" />} title="内容二次创作建议" description="把训练后的清晰表达转成 QQ / 微视 / 腾讯视频素材。">
        <div className="grid gap-3 md:grid-cols-3">
          {["30 秒项目介绍", "1 分钟项目展示脚本", "微视短视频分镜"].map((item) => (
            <StatusRow badge="可生成" icon={<Sparkles aria-hidden="true" />} key={item} label={item} />
          ))}
        </div>
      </RoomCard>
    </RoomGrid>
  );
}

function DeepDiveRoom() {
  const first = demoDeepDives[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr_360px]">
      <RoomCard icon={<Target aria-hidden="true" />} title="薄弱点队列" description="从讲练、知识地图和复盘自动回流。">
        <div className="flex flex-col gap-2">
          {demoDeepDives.map((item, index) => (
            <button className={cn("presento-weakness-item", index === 0 && "presento-weakness-item-active")} key={item.title} type="button">
              <strong>{item.title}</strong>
              <span>{item.evidence}</span>
            </button>
          ))}
        </div>
      </RoomCard>

      <RoomCard icon={<Search aria-hidden="true" />} title={first.title} description="把答不上来的问题拆成依据、解释和可复述回答。">
        <div className="rounded-2xl border border-[var(--presento-border)] bg-white/88 p-5">
          <div className="text-xs font-black text-[var(--presento-blue-active)]">问题拆解</div>
          <p className="mt-3 text-sm font-semibold leading-7 text-[var(--presento-muted)]">
            需要说清订单状态枚举、取消权限边界，以及后厨接单后的异常处理。回答时不要只说“系统会处理”，要把状态机和证据链连起来。
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {first.checklist.map((item) => (
            <StatusRow icon={<CheckCircle2 aria-hidden="true" />} key={item} label={item} />
          ))}
        </div>
      </RoomCard>

      <RoomCard icon={<FileText aria-hidden="true" />} title="改答版本" description={first.evidence}>
        <Textarea
          className="min-h-56 rounded-2xl border-[var(--presento-border)] bg-white/92 text-sm font-semibold leading-7"
          defaultValue="如果后厨已经接单，订单会从待处理进入制作中。这个状态下用户端不再直接取消，而是进入人工确认或异常处理流程，避免后厨已经备餐但前端仍撤单造成数据和履约不一致。"
        />
        <div className="mt-4 grid gap-2">
          <Button asChild className="rounded-xl bg-[var(--presento-navy)] font-black text-white">
            <Link href="/projects/demo/defense">围绕此问题再练一次</Link>
          </Button>
          <Button className="rounded-xl font-black" variant="outline">加入逐页讲稿</Button>
        </div>
      </RoomCard>
    </div>
  );
}

function SkillsRoom() {
  const builtInSkills = ["项目速记", "项目知识地图", "逐页讲稿", "高危追问", "当前页追问", "代码 / 数据解释", "薄弱点钻研", "兜底回答", "复盘报告", "内容二次创作"];

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
      <RoomCard icon={<Bot aria-hidden="true" />} title="Skill Packs" description="能力包支撑解析、追问和复盘。">
        <div className="flex flex-col gap-2">
          {demoSkillPacks.map((pack) => (
            <StatusRow badge={pack.enabled ? "启用" : "停用"} icon={<Sparkles aria-hidden="true" />} key={pack.name} label={pack.name} meta={pack.desc} />
          ))}
        </div>
      </RoomCard>

      <RoomCard icon={<Code aria-hidden="true" />} title="内置 Skills" description="MVP 展示系统能力和可观察输入输出，不做公开市场。">
        <div className="grid gap-3 md:grid-cols-2">
          {builtInSkills.map((skill) => (
            <Card className="gap-3 rounded-2xl border-[var(--presento-border)] bg-white/88 py-4 shadow-none" key={skill}>
              <CardHeader className="px-4">
                <CardTitle className="text-sm font-black">{skill}</CardTitle>
                <CardDescription>系统内置 · 训练闭环</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 px-4">
                <Badge className="presento-room-badge-purple">可调用</Badge>
                <Badge className="presento-room-badge-muted">fallback 可用</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </RoomCard>

      <RoomCard icon={<MessageSquareText aria-hidden="true" />} title="最近调用" description="真实调用后可替换为 SkillInvocation 记录。">
        <div className="flex flex-col gap-2">
          {demoSkillInvocations.map((item) => (
            <StatusRow badge={item.status} icon={<Bot aria-hidden="true" />} key={`${item.skill}-${item.trigger}`} label={item.skill} meta={item.trigger} />
          ))}
        </div>
        <Separator className="my-5 bg-[var(--presento-border)]" />
        <div className="grid gap-2">
          <Button className="rounded-xl font-black" variant="outline">新建自定义 Skill</Button>
          <Button className="rounded-xl font-black" variant="outline">导入 JSON / YAML Skill</Button>
        </div>
      </RoomCard>
    </div>
  );
}

function PCGRoom() {
  const channels = [
    {
      title: "QQ 小组群",
      desc: "从复盘结果生成训练摘要、分工提醒和高危追问分享。",
      items: ["智在必得答辩组", "成员 4 人", "倒计时 2 天"],
    },
    {
      title: "微视口播",
      desc: "把讲稿和高质量回答压缩成 30 秒校园项目介绍。",
      items: ["30 秒项目亮点", "5 个镜头提示", "观众可能追问"],
    },
    {
      title: "腾讯视频项目展示",
      desc: "生成 1 分钟项目展示脚本和简介，承接成果传播。",
      items: ["1 分钟展示脚本", "标题与简介", "项目 FAQ"],
    },
  ];

  return (
    <RoomGrid>
      {channels.map((channel) => (
        <RoomCard icon={<Radio aria-hidden="true" />} key={channel.title} title={channel.title} description={channel.desc}>
          <div className="flex flex-col gap-2">
            {channel.items.map((item) => (
              <StatusRow badge="模拟" icon={<Sparkles aria-hidden="true" />} key={item} label={item} />
            ))}
          </div>
          <Button className="mt-4 w-full rounded-xl font-black" variant="outline">生成内容草稿</Button>
        </RoomCard>
      ))}
      <RoomCard className="lg:col-span-2" icon={<CheckCircle2 aria-hidden="true" />} title="接入说明" description="当前 Demo 为模拟接入，用于展示未来业务链路，不依赖真实 QQ、微视或腾讯视频接口。" />
    </RoomGrid>
  );
}

function RoomGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}

function RoomCard({
  action,
  children,
  className,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  description?: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <Card className={cn("presento-room-card", className)}>
      <CardHeader>
        <div className="flex items-start gap-3">
          {icon ? <div className="presento-room-card-icon">{icon}</div> : null}
          <div className="min-w-0">
            <CardTitle className="text-lg font-black text-[var(--presento-ink)]">{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-2 font-semibold leading-6 text-[var(--presento-muted)]">
                {description}
              </CardDescription>
            ) : null}
          </div>
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

function StatusRow({
  badge,
  icon,
  label,
  meta,
}: {
  badge?: string;
  icon?: ReactNode;
  label: string;
  meta?: string;
}) {
  return (
    <div className="presento-room-row">
      {icon ? <div className="presento-room-row-icon">{icon}</div> : null}
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-[var(--presento-ink)]">{label}</div>
        {meta ? <div className="truncate text-xs font-semibold text-[var(--presento-muted)]">{meta}</div> : null}
      </div>
      {badge ? <Badge className="presento-room-badge-muted">{badge}</Badge> : null}
    </div>
  );
}

function QuestionList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div className="presento-room-question" key={item}>
          <span>{index + 1}</span>
          <strong>{item}</strong>
        </div>
      ))}
    </div>
  );
}

function ProcessNodeIcon({ id }: { id: FlowStepId }) {
  if (id === "files") return <UploadCloud aria-hidden="true" />;
  if (id === "knowledge") return <Search aria-hidden="true" />;
  if (id === "scripts") return <FileQuestion aria-hidden="true" />;
  if (id === "defense") return <Mic aria-hidden="true" />;
  if (id === "review") return <MessageSquareText aria-hidden="true" />;
  if (id === "deepDive") return <Target aria-hidden="true" />;
  if (id === "skills") return <Bot aria-hidden="true" />;
  return <Radio aria-hidden="true" />;
}

function statusLabel(status: FlowWorkspaceNodeData["status"]) {
  return {
    completed: "已完成",
    active: "当前",
    risk: "建议",
    pending: "待处理",
    weakness: "薄弱点",
    capability: "能力层",
    output: "输出",
  }[status];
}

function roomKindLabel(kind: FlowRoomKind) {
  return {
    standard: "标准工作空间",
    explore: "探索空间",
    immersive: "沉浸训练舱",
  }[kind];
}

function roomKindClass(kind: FlowRoomKind) {
  return {
    standard: "presento-step-room-standard",
    explore: "presento-step-room-explore",
    immersive: "presento-step-room-immersive",
  }[kind];
}

function processToneClass(tone: FlowWorkspaceNodeData["tone"]) {
  return {
    blue: "presento-process-node-blue",
    gray: "presento-process-node-gray",
    orange: "presento-process-node-orange",
    green: "presento-process-node-green",
    red: "presento-process-node-red",
    purple: "presento-process-node-purple",
    cyan: "presento-process-node-cyan",
  }[tone];
}

function processIconToneClass(tone: FlowWorkspaceNodeData["tone"]) {
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

function toneBadgeClass(tone: FlowWorkspaceNodeData["tone"]) {
  return {
    blue: "presento-room-badge-blue",
    gray: "presento-room-badge-muted",
    orange: "presento-room-badge-orange",
    green: "presento-room-badge-green",
    red: "presento-room-badge-red",
    purple: "presento-room-badge-purple",
    cyan: "presento-room-badge-cyan",
  }[tone];
}

const flowWorkspaceNodeTypes = {
  flowStep: FlowStepNode,
};
