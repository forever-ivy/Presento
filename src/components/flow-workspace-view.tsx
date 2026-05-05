"use client";

import {
  Bot,
  CheckCircle2,
  Code,
  FileQuestion,
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
import { AnimatePresence, motion, type MotionProps } from "framer-motion";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { PanelSize } from "react-resizable-panels";
import {
  startTransition,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type WheelEvent,
} from "react";
import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  type Viewport,
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { DotPattern } from "@/components/magicui/dot-pattern";
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/components/ui/scroll-based-velocity";
import { KnowledgeMapRoom } from "@/components/knowledge-map/knowledge-map-room";
import { ProjectUploadWorkspace } from "@/components/project-upload-workspace";
import {
  RichScriptEditor,
  type RichScriptEditorHandle,
} from "@/components/rich-script-editor";
import {
  FLOW_MAP_OVERVIEW_MAX_ZOOM,
  FLOW_MAP_OVERVIEW_MIN_ZOOM,
  FLOW_MAP_OVERVIEW_PADDING,
  FLOW_NODE_FOCUS_MAX_ZOOM,
  createFlowWorkspaceFlow,
  flowRouteToMode,
  flowStepToRoute,
  getFlowBackgroundCopyAnimationMode,
  getFlowBackgroundCopyBehavior,
  getFlowCameraAction,
  getFlowNodeMotionState,
  getFlowPortalOriginStyle,
  getFlowStepSlideDirection,
  shouldAnimateFlowModeTransition,
  shouldRenderFlowRoomChrome,
  getFlowWorkspaceInitialRoomStep,
  getFlowTransitionPreset,
  getFlowWorkspaceTransitionStep,
  getFlowStepById,
  getFlowStepByRoute,
  type FlowBackgroundCopyBehavior,
  type FlowMode,
  type FlowRoomKind,
  type FlowStepId,
  type FlowStep,
  type FlowWorkspaceNodeData,
} from "@/lib/flow-workspace";
import { presentoBrandLogo } from "@/lib/brand";
import {
  createProjectContentExports,
  createProjectTrainingSession,
  fetchProjectContentExports,
  fetchProjectDeepDives,
  fetchProjectTrainingFocuses,
  fetchProjectSkillInvocations,
  fetchProjectSkillPacks,
  fetchProjectSlides,
  runSlideAssistantAction,
  type ContentExportItem,
  type DeepDiveItem,
  type ProjectSlide,
  type ProjectSlideDeck,
  type SlideAssistantAction,
  type SlideAssistantInsertResult,
  type SlideAssistantOverview,
  type SkillInvocationItem,
  type SkillPackItem,
  type TrainingFocusItem,
  type WeaknessItem,
} from "@/lib/project-data-api";
import { useProjectWorkspace } from "@/lib/use-workspace";

gsap.registerPlugin(useGSAP);

const DOCK_FOCUS_MS = 680;
const ENTER_MS = 1240;
const DOCK_ROOM_OPEN_MS = ENTER_MS - DOCK_FOCUS_MS;
const DOCK_ROUTE_SETTLE_MS = 80;
const ROOM_SWITCH_MS = 560;
const FLOW_DEFAULT_VIEWPORT = { x: 500, y: 260, zoom: 0.62 };
const EXIT_MS = 760;
const MAP_RETURN_CAMERA_MS = 1240;
const BACKGROUND_COPY_VISIBLE_MS = 10_000;
const BACKGROUND_COPY_FADE_MS = 900;
const BACKGROUND_COPY_PINNED_STORAGE_KEY = "presento.background-copy-pinned";
const DEFENSE_GALLERY_EXPANDED_SIZE = "168px";
const DEFENSE_GALLERY_COLLAPSED_SIZE = "20px";
const DEFENSE_GALLERY_COLLAPSED_THRESHOLD = 30;
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
const pcgNodeDetails = {
  weiyun: {
    title: "腾讯微云",
    description: "项目资料来源：PPT、报告、代码、录屏进入 Presento，作为表达增强的原始证据。",
    items: ["PPT", "报告", "代码", "录屏"],
  },
  inputDocs: {
    title: "腾讯文档",
    description: "协同内容来源：报告、讲稿、小组分工沉淀为可继续加工的表达素材。",
    items: ["报告", "讲稿", "分工"],
  },
  inputQq: {
    title: "QQ 群资料",
    description: "小组沟通来源：讨论记录、分工、训练提醒补齐协作过程上下文。",
    items: ["讨论记录", "分工", "训练提醒"],
  },
  presento: {
    title: "Presento",
    description: "AI 公共表达增强引擎：理解资料、提炼价值、重构表达、模拟追问。",
    items: ["理解资料", "提炼价值", "重构表达", "模拟追问"],
  },
  outputQq: {
    title: "QQ",
    description: "小组训练房、分享卡、进度同步回流到日常沟通。",
    items: ["训练房", "分享卡", "进度同步"],
  },
  outputDocs: {
    title: "腾讯文档",
    description: "逐页讲稿、Q&A、复盘报告沉淀为团队可编辑、可复用的协作文档。",
    items: ["逐页讲稿", "Q&A", "复盘报告"],
  },
  tencentVideo: {
    title: "腾讯视频",
    description: "项目展示视频、答辩高光、成长复盘形成面向外部展示的内容资产。",
    items: ["项目展示", "答辩高光", "成长复盘"],
  },
} as const;
const emptyProjectSlides: ProjectSlide[] = [];
let pendingReturnStepId: FlowStepId | null = null;
let pendingDockEntryStepId: FlowStepId | null = null;
let pendingDockEntryToken = 0;
let pendingDockEntryViewport: Viewport | null = null;
let pendingSettledDockEntryStepId: FlowStepId | null = null;
let pendingRoomSwitch: RoomSwitchState | null = null;
let pendingSettledMapReturn = false;

type RoomSwitchState = {
  direction: -1 | 1;
  from: FlowStep;
  key: number;
  startedAt: number;
  to: FlowStep;
};

function pushFlowHistory(href: string) {
  window.history.pushState(null, "", href);
}

function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function FlowWorkspaceView({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const targetMode = flowRouteToMode(pathname);
  const activeStep = getFlowStepByRoute(pathname);
  const settledDockEntry =
    targetMode === "inside" && pendingSettledDockEntryStepId === activeStep.id;
  const resumedDockEntry =
    targetMode === "inside" && pendingDockEntryStepId === activeStep.id;
  const resumedDockEntryToken = resumedDockEntry || settledDockEntry ? pendingDockEntryToken : 0;
  const resumedRoomSwitch =
    targetMode === "inside" && pendingRoomSwitch?.to.id === activeStep.id
      ? pendingRoomSwitch
      : null;
  const [modeState, setMode] = useState<FlowMode>(() => targetMode);
  const mode: FlowMode =
    targetMode === "map" && pendingSettledMapReturn ? "map" : modeState;
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
  const modeTransitionTimersRef = useRef<{
    done: number | null;
    entering: number | null;
  }>({ done: null, entering: null });
  const dockFocusTimerRef = useRef<number | null>(null);
  const roomSwitchTimerRef = useRef<number | null>(null);
  const returnToMapTimerRef = useRef<number | null>(null);
  const returningToMapRef = useRef(false);
  const flowInstanceRef = useRef<ReactFlowInstance<Node<FlowWorkspaceNodeData>, Edge> | null>(null);
  const [dockEntryHref, setDockEntryHref] = useState<string | null>(null);
  const [dockFocusPending, setDockFocusPending] = useState(false);
  const [returningToMap, setReturningToMap] = useState(false);
  const [roomSwitch, setRoomSwitch] = useState<RoomSwitchState | null>(() => resumedRoomSwitch);
  const [roomSwitchSettledStepId, setRoomSwitchSettledStepId] = useState<FlowStepId | null>(null);
  const [roomContentReady, setRoomContentReady] = useState(true);
  const [knowledgeReaderMode, setKnowledgeReaderMode] = useState(false);
  const knowledgeReaderBackHandlerRef = useRef<(() => void) | null>(null);
  const backgroundCopyPinned = useBackgroundCopyPinnedPreference();
  const [backgroundCopyCycle, setBackgroundCopyCycle] = useState(0);
  const [backgroundCopyExiting, setBackgroundCopyExiting] = useState(false);
  const backgroundCopyBehavior = useMemo(
    () => getFlowBackgroundCopyBehavior({ mode, pinned: backgroundCopyPinned }),
    [backgroundCopyPinned, mode],
  );
  const clearModeTransitionTimers = useCallback(() => {
    if (modeTransitionTimersRef.current.entering) {
      window.clearTimeout(modeTransitionTimersRef.current.entering);
      modeTransitionTimersRef.current.entering = null;
    }
    if (modeTransitionTimersRef.current.done) {
      window.clearTimeout(modeTransitionTimersRef.current.done);
      modeTransitionTimersRef.current.done = null;
    }
  }, []);

  const pendingDockEntryHref = dockEntryHref && dockEntryHref !== pathname
    ? dockEntryHref
    : null;
  const transitionTargetMode: Exclude<FlowMode, "entering"> = returningToMap
    ? "map"
    : pendingDockEntryHref
    ? "inside"
    : targetMode;
  const visibleRoomStep = roomSwitch
    ? roomSwitch.to
    : transitionTargetMode === "inside"
    ? pendingDockEntryHref
      ? lastRoomStep
      : activeStep
    : lastRoomStep;
  const transitionStep = returningToMap
    ? lastRoomStep
    : roomSwitch
    ? roomSwitch.to
    : pendingDockEntryHref
    ? lastRoomStep
    : getFlowWorkspaceTransitionStep({
        activeStep,
        lastRoomStep,
        targetMode,
      });

  useEffect(() => {
    pendingModeRef.current = targetMode;
    if (targetMode !== "map") {
      pendingSettledMapReturn = false;
    }
    clearModeTransitionTimers();
    const isInitialRender = !initializedRef.current;
    const previousTargetMode = previousTargetModeRef.current;
    const skipSettledMapTransition =
      targetMode === "map" && pendingSettledMapReturn;
    const skipSettledDockEntryTransition =
      targetMode === "inside" && pendingSettledDockEntryStepId === activeStep.id;

    const animateTransition =
      !skipSettledDockEntryTransition &&
      !skipSettledMapTransition &&
      (resumedDockEntry ||
        shouldAnimateFlowModeTransition({
          isInitialRender,
          previousTargetMode,
          targetMode,
        }));

    previousTargetModeRef.current = targetMode;
    initializedRef.current = true;

    if (skipSettledDockEntryTransition) {
      pendingSettledDockEntryStepId = null;
      pendingDockEntryStepId = null;
      pendingDockEntryViewport = null;
      const settleTimer = window.setTimeout(() => {
        setDockEntryHref(null);
        setDockFocusPending(false);
        setBackgroundCopyExiting(false);
        setMode("inside");
      }, 0);
      return () => window.clearTimeout(settleTimer);
    }

    if (skipSettledMapTransition) {
      const settleTimer = window.setTimeout(() => {
        returningToMapRef.current = false;
        setReturningToMap(false);
        setMode("map");
      }, 0);
      return () => window.clearTimeout(settleTimer);
    }

    if (!animateTransition) {
      setMode(targetMode);
      return;
    }

    modeTransitionTimersRef.current.entering = window.setTimeout(() => {
      modeTransitionTimersRef.current.entering = null;
      setMode("entering");
    }, 0);

    modeTransitionTimersRef.current.done = window.setTimeout(() => {
      modeTransitionTimersRef.current.done = null;
      if (pendingModeRef.current === "map") setMode("map");
      if (pendingModeRef.current === "inside") {
        setMode("inside");
        setDockEntryHref(null);
        setDockFocusPending(false);
        pendingDockEntryStepId = null;
        pendingSettledDockEntryStepId = null;
      }
    }, targetMode === "map" ? EXIT_MS : resumedDockEntry ? DOCK_ROOM_OPEN_MS : ENTER_MS);

    return clearModeTransitionTimers;
  }, [activeStep.id, clearModeTransitionTimers, pathname, resumedDockEntry, targetMode]);

  useEffect(() => {
    if (!roomSwitch) return;

    if (roomSwitchTimerRef.current) {
      window.clearTimeout(roomSwitchTimerRef.current);
    }

    const elapsedMs = Date.now() - roomSwitch.startedAt;
    const remainingMs = Math.max(0, ROOM_SWITCH_MS - elapsedMs);

    roomSwitchTimerRef.current = window.setTimeout(() => {
      roomSwitchTimerRef.current = null;
      pendingRoomSwitch = null;
      setRoomSwitchSettledStepId(roomSwitch.to.id);
      setRoomSwitch(null);
    }, remainingMs);

    return () => {
      if (roomSwitchTimerRef.current) {
        window.clearTimeout(roomSwitchTimerRef.current);
        roomSwitchTimerRef.current = null;
      }
    };
  }, [roomSwitch]);

  useEffect(() => {
    return () => {
      clearModeTransitionTimers();
      if (dockFocusTimerRef.current) {
        window.clearTimeout(dockFocusTimerRef.current);
      }
      if (roomSwitchTimerRef.current) {
        window.clearTimeout(roomSwitchTimerRef.current);
      }
      if (returnToMapTimerRef.current) {
        window.clearTimeout(returnToMapTimerRef.current);
      }
    };
  }, [clearModeTransitionTimers]);

  function navigateWithBackgroundExit(href: string) {
    if (href === pathname) return;
    if (returningToMapRef.current) return;

    clearModeTransitionTimers();
    if (dockFocusTimerRef.current) {
      window.clearTimeout(dockFocusTimerRef.current);
      dockFocusTimerRef.current = null;
    }
    if (roomSwitchTimerRef.current) {
      window.clearTimeout(roomSwitchTimerRef.current);
      roomSwitchTimerRef.current = null;
    }
    if (returnToMapTimerRef.current) {
      window.clearTimeout(returnToMapTimerRef.current);
      returnToMapTimerRef.current = null;
    }
    pendingSettledDockEntryStepId = null;
    pendingSettledMapReturn = false;

    if (mode === "map") {
      const targetStep = getFlowStepByRoute(href);
      setDockEntryHref(href);
      setDockFocusPending(true);
      setReturningToMap(false);
      returningToMapRef.current = false;
      setRoomSwitchSettledStepId(null);
      setRoomContentReady(false);
      setLastRoomStep(targetStep);
      setMode("entering");
      setBackgroundCopyExiting(true);
      dockFocusTimerRef.current = window.setTimeout(() => {
        setDockFocusPending(false);
        pendingDockEntryStepId = targetStep.id;
        pendingDockEntryToken += 1;
        pendingDockEntryViewport = flowInstanceRef.current?.getViewport() ?? null;
        setMode("inside");
        setRoomContentReady(true);

        dockFocusTimerRef.current = window.setTimeout(() => {
          dockFocusTimerRef.current = null;
          pendingSettledDockEntryStepId = targetStep.id;
          setRoomSwitchSettledStepId(targetStep.id);
          startTransition(() => pushFlowHistory(href));
        }, DOCK_ROOM_OPEN_MS + DOCK_ROUTE_SETTLE_MS);
      }, DOCK_FOCUS_MS);
      return;
    }

    if (targetMode === "inside" && flowRouteToMode(href) === "inside") {
      const targetStep = getFlowStepByRoute(href);
      const nextSwitch = {
        direction: getFlowStepSlideDirection(activeStep.id, targetStep.id),
        from: activeStep,
        key: Date.now(),
        startedAt: Date.now(),
        to: targetStep,
      } satisfies RoomSwitchState;

      setDockEntryHref(null);
      setDockFocusPending(false);
      setReturningToMap(false);
      returningToMapRef.current = false;
      setRoomSwitchSettledStepId(null);
      setRoomContentReady(true);
      pendingDockEntryViewport = null;
      pendingRoomSwitch = nextSwitch;
      setLastRoomStep(targetStep);
      setRoomSwitch(nextSwitch);
      setMode("inside");
      startTransition(() => pushFlowHistory(href));
      return;
    }

    setDockEntryHref(null);
    setDockFocusPending(false);
    setReturningToMap(false);
    returningToMapRef.current = false;
    setRoomSwitchSettledStepId(null);
    setRoomContentReady(true);
    pendingDockEntryViewport = null;
    startTransition(() => pushFlowHistory(href));
  }

  function enterStep(stepId: FlowStepId) {
    pendingReturnStepId = null;
    setLastRoomStep(getFlowStepById(stepId));
    navigateWithBackgroundExit(flowStepToRoute(stepId, projectId));
  }

  function cancelDockEntry() {
    clearModeTransitionTimers();
    if (dockFocusTimerRef.current) {
      window.clearTimeout(dockFocusTimerRef.current);
      dockFocusTimerRef.current = null;
    }

    pendingDockEntryStepId = null;
    pendingSettledDockEntryStepId = null;
    pendingDockEntryViewport = null;
    setDockEntryHref(null);
    setDockFocusPending(false);
    setBackgroundCopyExiting(false);
    setRoomContentReady(true);
    returningToMapRef.current = false;
    setMode("map");
  }

  function exitStep() {
    if (returningToMapRef.current) return;

    returningToMapRef.current = true;
    clearModeTransitionTimers();
    if (dockFocusTimerRef.current) {
      window.clearTimeout(dockFocusTimerRef.current);
      dockFocusTimerRef.current = null;
    }

    pendingReturnStepId = null;
    pendingDockEntryStepId = null;
    pendingSettledDockEntryStepId = null;
    pendingDockEntryToken += 1;
    pendingDockEntryViewport = null;
    pendingRoomSwitch = null;
    setDockEntryHref(null);
    setDockFocusPending(false);
    setBackgroundCopyExiting(false);
    setRoomSwitch(null);
    setRoomSwitchSettledStepId(null);
    setRoomContentReady(true);
    setLastRoomStep(activeStep);
    setReturningToMap(true);
    setMode("entering");

    returnToMapTimerRef.current = window.setTimeout(() => {
      returnToMapTimerRef.current = null;
      pendingSettledMapReturn = true;
      startTransition(() => pushFlowHistory("/"));
    }, EXIT_MS);
  }

  function exitKnowledgeReader() {
    knowledgeReaderBackHandlerRef.current?.();
    setKnowledgeReaderMode(false);
  }

  function toggleBackgroundHint() {
    const next = !backgroundCopyPinned;
    setBackgroundCopyPinnedPreference(next);
    if (!next) {
      setBackgroundCopyCycle((cycle) => cycle + 1);
    }
  }

  const topNavStep = pendingDockEntryHref ? lastRoomStep : activeStep;
  const topNavDetailState =
    targetMode === "inside" || pendingDockEntryHref
      ? {
          title: topNavStep.label,
          onBack: pendingDockEntryHref
            ? cancelDockEntry
            : activeStep.id === "knowledge" && knowledgeReaderMode
              ? exitKnowledgeReader
              : exitStep,
        }
      : undefined;
  const topNavDetailEntrance = pendingDockEntryHref
    ? {
        durationMs: DOCK_FOCUS_MS,
        key: pendingDockEntryHref,
      }
    : undefined;
  const topNavDetailExit = returningToMap
    ? {
        durationMs: EXIT_MS,
        key: activeStep.id,
      }
    : undefined;
  const topNavDetailTransition = roomSwitch
      ? {
        direction: roomSwitch.direction,
        durationMs: ROOM_SWITCH_MS,
        from: {
          title: roomSwitch.from.label,
        },
        key: roomSwitch.key,
        to: {
          title: roomSwitch.to.label,
        },
      }
    : undefined;
  const renderRoomChrome = shouldRenderFlowRoomChrome({
    dockFocusPending,
    mode,
  });
  const suppressRoomIntro = settledDockEntry || roomSwitchSettledStepId === visibleRoomStep.id;
  const backgroundAnimationStep = roomSwitch ? roomSwitch.from : transitionStep;

  return (
    <AppFrame>
      <TopNav
        backgroundHintPinned={targetMode === "map" || returningToMap ? backgroundCopyPinned : undefined}
        detailEntrance={topNavDetailEntrance}
        detailExit={topNavDetailExit}
        detailState={topNavDetailState}
        detailTransition={topNavDetailTransition}
        dockFixedSize
        onNavigate={navigateWithBackgroundExit}
        projectId={projectId}
        onToggleBackgroundHint={
          targetMode === "map" || returningToMap ? toggleBackgroundHint : undefined
        }
      />
      <PageWrap animateEntrance={false} className="presento-map-page">
        <section className={cn("presento-flow-workspace", `presento-flow-workspace-${mode}`)} ref={workspaceRef}>
          {mode === "map" ? (
            <MapBackgroundCopy
              behavior={backgroundCopyBehavior}
              exiting={backgroundCopyExiting}
              key={backgroundCopyPinned ? "persistent" : `timed-${backgroundCopyCycle}`}
            />
          ) : null}
          <FlowTransitionDirector
            activeStep={backgroundAnimationStep}
            dockEntryActive={pendingDockEntryHref !== null || resumedDockEntry || settledDockEntry}
            dockFocusPending={dockFocusPending}
            mode={mode}
            roomContentReady={roomContentReady}
            roomIntroSuppressed={suppressRoomIntro}
            roomSwitchActive={roomSwitch !== null}
            scopeRef={workspaceRef}
            targetMode={transitionTargetMode}
          />
          <ReactFlowProvider>
            <FlowWorkspaceCanvas
              activeId={backgroundAnimationStep.id}
              initialViewport={
                resumedDockEntry || settledDockEntry
                  ? pendingDockEntryViewport
                  : null
              }
              instantCameraFocusKey={resumedDockEntryToken}
              mode={mode}
              onFlowInit={(instance) => {
                flowInstanceRef.current = instance;
              }}
              onEnterStep={enterStep}
              smoothMapReturn={targetMode === "map" && pendingSettledMapReturn}
              suppressSettledMapFit={targetMode === "map" && pendingSettledMapReturn && returningToMap}
              targetMode={transitionTargetMode}
            />
          </ReactFlowProvider>

          {renderRoomChrome ? (
            <>
              {(mode === "inside" || returningToMap || roomSwitch) && roomContentReady ? (
                <StepRoom
                  activeId={roomSwitch ? roomSwitch.from.id : visibleRoomStep.id}
                  className={roomSwitch ? "presento-room-slide presento-room-slide-outgoing" : undefined}
                  instant={roomSwitch ? false : suppressRoomIntro}
                  key={roomSwitch ? roomSwitch.from.id : visibleRoomStep.id}
                  motionProps={roomSwitch ? getRoomSwitchMotionProps(roomSwitch, "outgoing") : undefined}
                  onKnowledgeReaderBackHandlerChange={(handler) => {
                    knowledgeReaderBackHandlerRef.current = handler;
                  }}
                  onKnowledgeReaderModeChange={setKnowledgeReaderMode}
                  projectId={projectId}
                />
              ) : null}
              {roomSwitch ? (
                <StepRoomIncomingSlide
                  onKnowledgeReaderBackHandlerChange={(handler) => {
                    knowledgeReaderBackHandlerRef.current = handler;
                  }}
                  onKnowledgeReaderModeChange={setKnowledgeReaderMode}
                  projectId={projectId}
                  transition={roomSwitch}
                />
              ) : null}
            </>
          ) : null}
        </section>
      </PageWrap>
    </AppFrame>
  );
}

function FlowTransitionDirector({
  activeStep,
  dockEntryActive,
  dockFocusPending,
  mode,
  roomContentReady,
  roomIntroSuppressed,
  roomSwitchActive,
  scopeRef,
  targetMode,
}: {
  activeStep: FlowStep;
  dockEntryActive: boolean;
  dockFocusPending: boolean;
  mode: FlowMode;
  roomContentReady: boolean;
  roomIntroSuppressed: boolean;
  roomSwitchActive: boolean;
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
      const getPortalOrigin = () => getActiveStepPortalOrigin(scopeRef.current!, activeStep.id);
      const canvasElement = scopeRef.current.querySelector<HTMLElement>(canvas);
      const roomElement = scopeRef.current.querySelector<HTMLElement>(room);
      const shellElement = scopeRef.current.querySelector<HTMLElement>(shell);

      if (!canvasElement) return;

      if (mode === "inside" && roomSwitchActive) {
        gsap.set(canvasElement, {
          opacity: preset.canvas.opacity,
          scale: preset.canvas.scale,
        });
        return;
      }

      if (reduceMotion) {
        gsap.set(canvasElement, {
          opacity: preset.canvas.opacity,
          scale: mode === "inside" ? preset.canvas.scale : 1,
        });
        if (shellElement) {
          gsap.set(shellElement, {
            opacity: mode === "map" ? 0 : preset.portalShell.opacityTo,
            scale: 1,
            y: 0,
          });
        }
        if (roomElement) {
          gsap.set(roomElement, {
            opacity: mode === "inside" ? 1 : 0,
            scale: 1,
            y: 0,
          });
        }
        return;
      }

      const timeline = gsap.timeline({
        defaults: { ease: preset.ease, force3D: true, overwrite: "auto" },
      });

      if (mode === "inside" && roomIntroSuppressed) {
        if (shellElement) {
          gsap.set(shellElement, {
            opacity: preset.portalShell.opacityTo,
            scale: 1,
            y: 0,
          });
        }
        if (roomElement) {
          gsap.set(roomElement, {
            opacity: 1,
            scale: 1,
            y: 0,
          });
        }
        return;
      }

      if (mode === "map") {
        timeline
          .to(canvasElement, {
            duration: mapPreset.canvas.duration / 1000,
            scale: mapPreset.canvas.scale,
            opacity: mapPreset.canvas.opacity,
            ease: "power2.inOut",
          }, 0.1);
        return;
      }

      if (mode === "entering" && targetMode === "map") {
        const portalOrigin = getPortalOrigin();

        if (shellElement) {
          timeline.to(shellElement, {
            duration: EXIT_MS / 1000,
            opacity: 0,
            scale: portalOrigin.exitScale,
            transformOrigin: portalOrigin.transformOrigin,
            y: portalOrigin.exitY,
            ease: "expo.inOut",
          }, 0);
        }

        if (roomElement) {
          timeline
            .fromTo(roomElement, {
              opacity: 1,
              scale: 1,
              transformOrigin: portalOrigin.transformOrigin,
              y: 0,
            }, {
              duration: EXIT_MS / 1000,
              scale: portalOrigin.exitScale,
              y: portalOrigin.exitY,
              ease: "expo.inOut",
            }, 0)
            .to(roomElement, {
              duration: 0.18,
              opacity: 0,
              ease: "power2.out",
            }, (EXIT_MS - 190) / 1000);
        }

        timeline
          .to(canvasElement, {
            duration: 0.58,
            scale: mapPreset.canvas.scale,
            opacity: mapPreset.canvas.opacity,
            ease: "power3.out",
          }, 0.12);
        return;
      }

      timeline
        .to(canvasElement, {
          duration: preset.canvas.duration / 1000,
          scale: preset.canvas.scale,
          opacity: preset.canvas.opacity,
          transformOrigin: "50% 50%",
          ease: mode === "entering" ? "expo.out" : "power3.out",
        }, mode === "inside" ? 0.12 : 0);

      if (mode === "entering" && dockFocusPending) {
        return;
      }

      if (mode === "entering") {
        const portalShellDelay = dockEntryActive ? 0 : preset.portalShell.delay;
        if (shellElement) {
          timeline
            .set(shellElement, {
              opacity: 0,
              scale: preset.portalShell.scaleFrom,
              y: preset.portalShell.yFrom,
              transformOrigin: () => getPortalOrigin().transformOrigin,
            }, portalShellDelay)
            .to(shellElement, {
              duration: preset.portalShell.duration / 1000,
              opacity: preset.portalShell.opacityTo,
              scale: 1,
              y: 0,
              ease: "expo.out",
            }, portalShellDelay);
        }
      }

      if (mode === "inside" && !roomSwitchActive) {
        const roomFromScale = dockEntryActive ? preset.portalShell.scaleFrom : preset.room.scaleFrom;
        const roomFromOpacity = dockEntryActive ? 0.86 : 0;
        const roomFromY = dockEntryActive ? 0 : preset.room.yFrom;
        const roomOrigin = dockEntryActive ? getPortalOrigin().transformOrigin : "50% 48%";

        if (shellElement) {
          timeline
            .to(shellElement, {
              duration: preset.portalShell.duration / 1000,
              opacity: preset.portalShell.opacityTo,
              scale: 1,
              y: 0,
              ease: "power3.out",
            }, 0);
        }

        if (roomContentReady && roomElement) {
          timeline.fromTo(roomElement, {
            opacity: roomFromOpacity,
            scale: roomFromScale,
            y: roomFromY,
            transformOrigin: roomOrigin,
          }, {
            duration: dockEntryActive ? preset.portalShell.duration / 1000 : preset.room.duration / 1000,
            opacity: 1,
            scale: 1,
            y: 0,
            ease: dockEntryActive || preset.name === "immersive" ? "expo.out" : "power3.out",
          }, preset.room.delay);
        }
      }
    },
    {
      dependencies: [
        activeStep.id,
        dockEntryActive,
        dockFocusPending,
        mode,
        preset,
        roomContentReady,
        roomIntroSuppressed,
        roomSwitchActive,
        mapPreset,
        reduceMotion,
        targetMode,
      ],
      revertOnUpdate: false,
      scope: scopeRef,
    },
  );

  return null;
}

function getActiveStepPortalOrigin(scope: HTMLElement, activeId: FlowStepId) {
  const containerBounds = scope.getBoundingClientRect();
  const nodeElement = scope.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${activeId}"] .presento-process-node`,
  );

  if (!nodeElement) {
    return {
      clipPath: "inset(43% 42% 43% 42% round 22px)",
      exitScale: 0.28,
      exitY: 0,
      transformOrigin: "50% 48%",
    };
  }

  const nodeBounds = nodeElement.getBoundingClientRect();
  const rawExitScale = Math.max(
    nodeBounds.width / containerBounds.width,
    nodeBounds.height / containerBounds.height,
  );
  const exitScale = Math.min(
    0.48,
    Math.max(
      0.24,
      rawExitScale * 0.92,
    ),
  );
  const exitY = Math.min(24, Math.max(14, nodeBounds.height * 0.06));

  return {
    ...getFlowPortalOriginStyle({
      containerHeight: containerBounds.height,
      containerWidth: containerBounds.width,
      sourceHeight: nodeBounds.height,
      sourceLeft: nodeBounds.left - containerBounds.left,
      sourceTop: nodeBounds.top - containerBounds.top,
      sourceWidth: nodeBounds.width,
    }),
    exitScale,
    exitY,
  };
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
}

function useBackgroundCopyPinnedPreference() {
  return useSyncExternalStore(
    subscribeBackgroundCopyPinnedPreference,
    getBackgroundCopyPinnedSnapshot,
    getBackgroundCopyPinnedServerSnapshot,
  );
}

const backgroundCopyPinnedPreferenceEvent = "presento:background-copy-pinned";
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeBackgroundCopyPinnedPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(backgroundCopyPinnedPreferenceEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(backgroundCopyPinnedPreferenceEvent, onStoreChange);
  };
}

function getBackgroundCopyPinnedSnapshot() {
  return window.localStorage.getItem(BACKGROUND_COPY_PINNED_STORAGE_KEY) === "true";
}

function getBackgroundCopyPinnedServerSnapshot() {
  return false;
}

function setBackgroundCopyPinnedPreference(pinned: boolean) {
  window.localStorage.setItem(BACKGROUND_COPY_PINNED_STORAGE_KEY, pinned ? "true" : "false");
  window.dispatchEvent(new Event(backgroundCopyPinnedPreferenceEvent));
}

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

function MapBackgroundCopy({
  behavior,
  exiting,
}: {
  behavior: FlowBackgroundCopyBehavior;
  exiting: boolean;
}) {
  const animationMode = getFlowBackgroundCopyAnimationMode({ behavior, exiting });
  const fadeDurationSeconds = BACKGROUND_COPY_FADE_MS / 1000;
  const timedDurationSeconds = (BACKGROUND_COPY_VISIBLE_MS + BACKGROUND_COPY_FADE_MS) / 1000;

  if (animationMode === "hidden") return null;

  return (
    <motion.div
      animate={
        animationMode === "timed"
          ? { opacity: [0, 1, 1, 0] }
          : { opacity: animationMode === "persistent" ? 1 : 0 }
      }
      aria-hidden="true"
      className="presento-flow-background-copy"
      initial={{ opacity: animationMode === "exiting" ? 1 : 0 }}
      transition={
        animationMode === "timed"
          ? {
              duration: timedDurationSeconds,
              ease: [0.22, 1, 0.36, 1],
              times: [0, 0.06, 1 - fadeDurationSeconds / timedDurationSeconds, 1],
            }
          : {
              duration: fadeDurationSeconds,
              ease: [0.22, 1, 0.36, 1],
            }
      }
    >
      <ScrollVelocityContainer className="presento-flow-background-copy-track">
        <ScrollVelocityRow
          baseVelocity={1.22}
          className="presento-flow-background-copy-row presento-flow-background-copy-row-primary"
          direction={-1}
          scrollReactivity={false}
        >
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-base">当前</span>
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-red presento-flow-background-copy-accent-primary">
              <span>项目</span>
              <span className="presento-flow-background-copy-unit-success">隔离</span>
            </span>
          </span>
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-base">当前</span>
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-red presento-flow-background-copy-accent-primary">
              <span>项目</span>
              <span className="presento-flow-background-copy-unit-success">隔离</span>
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
              真实
            </span>
            <span className="presento-flow-background-copy-base presento-flow-background-copy-base-complete">
              数据驱动
            </span>
          </span>
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-lime presento-flow-background-copy-accent-secondary presento-flow-background-copy-accent-leading">
              真实
            </span>
            <span className="presento-flow-background-copy-base presento-flow-background-copy-base-complete">
              数据驱动
            </span>
          </span>
        </ScrollVelocityRow>
      </ScrollVelocityContainer>
    </motion.div>
  );
}

function FlowWorkspaceCanvas({
  activeId,
  initialViewport,
  instantCameraFocusKey,
  mode,
  onEnterStep,
  onFlowInit,
  smoothMapReturn,
  suppressSettledMapFit,
  targetMode,
}: {
  activeId: FlowStepId;
  initialViewport: Viewport | null;
  instantCameraFocusKey: number;
  mode: FlowMode;
  onEnterStep: (stepId: FlowStepId) => void;
  onFlowInit: (instance: ReactFlowInstance<Node<FlowWorkspaceNodeData>, Edge>) => void;
  smoothMapReturn: boolean;
  suppressSettledMapFit: boolean;
  targetMode: Exclude<FlowMode, "entering">;
}) {
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance<Node<FlowWorkspaceNodeData>, Edge> | null>(null);
  const handleInstantCameraReady = useCallback(() => {
    pendingDockEntryViewport = null;
  }, []);
  const handleFlowInit = useCallback((instance: ReactFlowInstance<Node<FlowWorkspaceNodeData>, Edge>) => {
    setReactFlowInstance(instance);
    onFlowInit(instance);
  }, [onFlowInit]);
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
  const edges = useMemo<Array<Edge>>(() => {
    if (mode === "map") return flow.edges;

    return flow.edges.map((edge) => ({
      ...edge,
      animated: false,
    }));
  }, [flow.edges, mode]);
  const defaultViewport = initialViewport ?? FLOW_DEFAULT_VIEWPORT;

  return (
    <div
      className={cn(
        "presento-process-canvas presento-flow",
        `presento-process-canvas-${mode}`,
      )}
    >
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
        defaultViewport={defaultViewport}
        edges={edges}
        fitView={reactFlowInstance === null && mode === "map" && targetMode === "map"}
        fitViewOptions={fitViewOptions}
        maxZoom={FLOW_NODE_FOCUS_MAX_ZOOM}
        minZoom={FLOW_MAP_OVERVIEW_MIN_ZOOM}
        nodeTypes={flowWorkspaceNodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        onInit={handleFlowInit}
        onNodeClick={(_, node) => onEnterStep(node.id as FlowStepId)}
        panOnDrag
        proOptions={{ hideAttribution: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <FlowCamera
          activeId={activeId}
          instantCameraFocusKey={instantCameraFocusKey}
          mode={mode}
          onInstantCameraReady={handleInstantCameraReady}
          reactFlowInstance={reactFlowInstance}
          smoothMapReturn={smoothMapReturn}
          suppressSettledMapFit={suppressSettledMapFit}
          targetMode={targetMode}
        />
      </ReactFlow>
    </div>
  );
}

function FlowCamera({
  activeId,
  instantCameraFocusKey,
  mode,
  onInstantCameraReady,
  reactFlowInstance,
  smoothMapReturn,
  suppressSettledMapFit,
  targetMode,
}: {
  activeId: FlowStepId;
  instantCameraFocusKey: number;
  mode: FlowMode;
  onInstantCameraReady: () => void;
  reactFlowInstance: ReactFlowInstance<Node<FlowWorkspaceNodeData>, Edge> | null;
  smoothMapReturn: boolean;
  suppressSettledMapFit: boolean;
  targetMode: Exclude<FlowMode, "entering">;
}) {
  const activeStep = useMemo(() => getFlowStepById(activeId), [activeId]);
  const preset = useMemo(() => getFlowTransitionPreset(mode, activeStep), [activeStep, mode]);
  const mapPreset = useMemo(() => getFlowTransitionPreset("map", activeStep), [activeStep]);
  const cameraAction = useMemo(() => getFlowCameraAction(mode, targetMode), [mode, targetMode]);
  const instantCameraFocus = instantCameraFocusKey !== 0;

  useLayoutEffect(() => {
    if (!reactFlowInstance?.viewportInitialized) return;

    let animationFrame = 0;

    animationFrame = window.requestAnimationFrame(() => {
      if (cameraAction === "hold") return;

      if (cameraAction === "fit" && mapPreset.camera.type === "fit") {
        if (suppressSettledMapFit) return;

        void reactFlowInstance.fitView({
          duration: smoothMapReturn ? MAP_RETURN_CAMERA_MS : mapPreset.camera.duration,
          ease: smoothMapReturn ? easeInOutSine : undefined,
          padding: mapPreset.camera.padding,
          minZoom: mapPreset.camera.minZoom,
          maxZoom: mapPreset.camera.maxZoom,
        });
        return;
      }

      if (preset.camera.type !== "center") return;

      const node = reactFlowInstance.getNode(activeId);
      if (!node) {
        if (instantCameraFocus) onInstantCameraReady();
        return;
      }

      const nodeWidth = node.measured?.width ?? node.width ?? 376;
      const nodeHeight = node.measured?.height ?? node.height ?? 150;

      reactFlowInstance.setCenter(node.position.x + nodeWidth / 2 + preset.camera.offset.x, node.position.y + nodeHeight / 2 + preset.camera.offset.y, {
        duration: instantCameraFocus ? 0 : preset.camera.duration,
        zoom: preset.camera.zoom,
      });
      if (instantCameraFocus) onInstantCameraReady();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    activeId,
    cameraAction,
    instantCameraFocus,
    instantCameraFocusKey,
    mapPreset,
    onInstantCameraReady,
    preset,
    reactFlowInstance,
    smoothMapReturn,
    suppressSettledMapFit,
  ]);

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

function getRoomSwitchMotionProps(
  transition: RoomSwitchState,
  phase: "incoming" | "outgoing",
): Pick<MotionProps, "animate" | "initial" | "transition"> {
  const offset = `${transition.direction * 100}%`;
  const reverseOffset = `${transition.direction * -100}%`;
  const slideTransition = {
    duration: ROOM_SWITCH_MS / 1000,
    ease: [0.16, 1, 0.3, 1] as const,
  };

  if (phase === "outgoing") {
    return {
      animate: { opacity: 0.62, scale: 0.985, x: reverseOffset },
      initial: { opacity: 1, scale: 1, x: "0%" },
      transition: slideTransition,
    };
  }

  return {
    animate: { opacity: 1, scale: 1, x: "0%" },
    initial: { opacity: 0.92, scale: 0.995, x: offset },
    transition: slideTransition,
  };
}

function StepRoomIncomingSlide({
  onKnowledgeReaderBackHandlerChange,
  onKnowledgeReaderModeChange,
  projectId,
  transition,
}: {
  onKnowledgeReaderBackHandlerChange: (handler: (() => void) | null) => void;
  onKnowledgeReaderModeChange: (isReaderMode: boolean) => void;
  projectId: string;
  transition: RoomSwitchState;
}) {
  return (
    <StepRoom
      activeId={transition.to.id}
      className="presento-room-slide presento-room-slide-incoming"
      key={`${transition.key}-${transition.to.id}-in`}
      motionProps={getRoomSwitchMotionProps(transition, "incoming")}
      onKnowledgeReaderBackHandlerChange={onKnowledgeReaderBackHandlerChange}
      onKnowledgeReaderModeChange={onKnowledgeReaderModeChange}
      projectId={projectId}
    />
  );
}

function StepRoom({
  activeId,
  className,
  instant = false,
  motionProps,
  onKnowledgeReaderBackHandlerChange,
  onKnowledgeReaderModeChange,
  projectId,
}: {
  activeId: FlowStepId;
  className?: string;
  instant?: boolean;
  motionProps?: Pick<MotionProps, "animate" | "initial" | "transition">;
  onKnowledgeReaderBackHandlerChange: (handler: (() => void) | null) => void;
  onKnowledgeReaderModeChange: (isReaderMode: boolean) => void;
  projectId: string;
}) {
  const step = getFlowStepById(activeId);
  const roomBody = (
    <main
      className={cn(
        "presento-step-room-body",
        activeId === "knowledge" && "presento-step-room-body-knowledge",
        activeId === "files" && "presento-step-room-body-files",
        activeId === "scripts" && "presento-step-room-body-scripts",
        activeId === "defense" && "presento-step-room-body-defense",
        activeId === "pcg" && "presento-step-room-body-pcg",
      )}
    >
      <StepRoomContent
        onKnowledgeReaderBackHandlerChange={onKnowledgeReaderBackHandlerChange}
        onKnowledgeReaderModeChange={onKnowledgeReaderModeChange}
        projectId={projectId}
        stepId={activeId}
      />
    </main>
  );

  return (
    <motion.section
      animate={motionProps?.animate}
      className={cn("presento-step-room", roomKindClass(step.roomKind), className)}
      initial={motionProps?.initial ?? false}
      style={instant && !motionProps ? { opacity: 1, transform: "translateY(0) scale(1)" } : undefined}
      transition={motionProps?.transition}
    >
      {activeId === "knowledge" || activeId === "scripts" || activeId === "defense" || activeId === "pcg" ? roomBody : <ScrollArea className="presento-step-room-scroll">{roomBody}</ScrollArea>}
    </motion.section>
  );
}

const StepRoomContent = memo(function StepRoomContent({
  onKnowledgeReaderBackHandlerChange,
  onKnowledgeReaderModeChange,
  projectId,
  stepId,
}: {
  onKnowledgeReaderBackHandlerChange: (handler: (() => void) | null) => void;
  onKnowledgeReaderModeChange: (isReaderMode: boolean) => void;
  projectId: string;
  stepId: FlowStepId;
}) {
  if (stepId === "files") return <FilesRoom projectId={projectId} />;
  if (stepId === "knowledge") {
    return (
      <KnowledgeRoom
        onReaderBackHandlerChange={onKnowledgeReaderBackHandlerChange}
        onReaderModeChange={onKnowledgeReaderModeChange}
        projectId={projectId}
      />
    );
  }
  if (stepId === "scripts") return <ScriptsRoom projectId={projectId} />;
  if (stepId === "defense") return <DefenseRoom projectId={projectId} />;
  if (stepId === "review") return <ReviewRoom projectId={projectId} />;
  if (stepId === "deepDive") return <DeepDiveRoom projectId={projectId} />;
  if (stepId === "skills") return <SkillsRoom projectId={projectId} />;
  return <PCGRoom projectId={projectId} />;
});

function FilesRoom({ projectId }: { projectId: string }) {
  const { workspace, error, isLoading, refresh } = useProjectWorkspace(projectId);

  if (isLoading) {
    return <RoomState icon={<UploadCloud aria-hidden="true" />} title="正在读取项目资料" />;
  }

  if (error) {
    return <RoomState description={error} icon={<UploadCloud aria-hidden="true" />} title="项目资料读取失败" tone="error" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ProjectUploadWorkspace
        initialFiles={workspace?.files ?? []}
        onUploadComplete={() => {
          void refresh();
        }}
        projectId={projectId}
        variant="workspace"
      />
    </div>
  );
}

function KnowledgeRoom({
  onReaderBackHandlerChange,
  onReaderModeChange,
  projectId,
}: {
  onReaderBackHandlerChange: (handler: (() => void) | null) => void;
  onReaderModeChange: (isReaderMode: boolean) => void;
  projectId: string;
}) {
  return (
    <KnowledgeMapRoom
      onReaderBackHandlerChange={onReaderBackHandlerChange}
      onReaderModeChange={onReaderModeChange}
      projectId={projectId}
    />
  );
}

type ScriptVersion = "normal" | "short" | "keywords";

const scriptVersions: { id: ScriptVersion; label: string }[] = [
  { id: "normal", label: "完整稿" },
  { id: "short", label: "30 秒稿" },
  { id: "keywords", label: "提词稿" },
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function listHtml(items: string[]) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function ScriptsRoom({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useProjectSlides(projectId);
  const slides = data?.slides ?? emptyProjectSlides;
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [scriptVersion, setScriptVersion] = useState<ScriptVersion>("normal");
  const [isScriptsGalleryCollapsed, setIsScriptsGalleryCollapsed] = useState(false);
  const scriptEditorRef = useRef<RichScriptEditorHandle | null>(null);
  const filmstripRef = useRef<HTMLElement | null>(null);
  const activeSlide = slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null;
  const editorContent = useMemo(
    () => (activeSlide ? buildProjectScriptEditorContent(activeSlide, scriptVersion) : ""),
    [activeSlide, scriptVersion],
  );
  const selectSlide = useCallback((slideId: string) => {
    startTransition(() => setSelectedSlideId(slideId));
  }, []);
  const resetFilmstripScroll = useCallback(() => {
    const viewport = filmstripRef.current?.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) return;

    viewport.scrollTo({ left: 0, behavior: "auto" });
    viewport.scrollLeft = 0;
  }, []);
  const handleFilmstripWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const viewport = event.currentTarget.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) return;

    viewport.scrollLeft += event.deltaY;
  }, []);
  const handleScriptsGalleryResize = useCallback((panelSize: PanelSize) => {
    const shouldCollapse = panelSize.inPixels <= DEFENSE_GALLERY_COLLAPSED_THRESHOLD;
    setIsScriptsGalleryCollapsed((current) => current === shouldCollapse ? current : shouldCollapse);
  }, []);
  const insertAssistantToken = useCallback((label: string, content: string, tone: "pause" | "question" | "card" = "card") => {
    scriptEditorRef.current?.appendContent(`<p><mark data-presento-token="${tone}">${escapeHtml(label)}：${escapeHtml(content)}</mark></p>`);
  }, []);

  useLayoutEffect(() => {
    if (activeSlide && !isScriptsGalleryCollapsed) resetFilmstripScroll();
  }, [activeSlide, isScriptsGalleryCollapsed, resetFilmstripScroll]);

  if (isLoading) return <RoomState icon={<FileQuestion aria-hidden="true" />} title="正在读取逐页讲稿" />;
  if (error) return <RoomState description={error} icon={<FileQuestion aria-hidden="true" />} title="逐页讲稿读取失败" tone="error" />;
  if (!activeSlide) {
    return (
      <RoomState
        description="当前项目还没有真实 Slide 记录。上传并解析 PPT 后，这里会显示逐页讲稿。"
        icon={<FileQuestion aria-hidden="true" />}
        title="暂无逐页讲稿"
      />
    );
  }

  return (
    <div className="presento-scripts-workbench">
      <ResizablePanelGroup
        className="presento-scripts-resizable presento-scripts-resizable-root"
        orientation="vertical"
      >
        <ResizablePanel defaultSize="78%" minSize="56%">
          <ResizablePanelGroup
            className="presento-scripts-upper-resizable"
            orientation="horizontal"
          >
            <ResizablePanel defaultSize="74%" minSize="48%">
              <main className="presento-scripts-main">
                <Tabs
                  className="presento-scripts-version-tabs"
                  onValueChange={(value) => setScriptVersion(value as ScriptVersion)}
                  value={scriptVersion}
                >
                  <TabsList aria-label="讲稿版本" className="presento-scripts-version-tabs-list">
                    {scriptVersions.map((version) => (
                      <TabsTrigger className="presento-scripts-version-tab" key={version.id} value={version.id}>
                        <strong>{version.label}</strong>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <RichScriptEditor
                  className="presento-scripts-editor"
                  initialContent={editorContent}
                  key={`${activeSlide.id}-${scriptVersion}`}
                  minHeight={390}
                  ref={scriptEditorRef}
                  showFooterMeta={false}
                  statusLabel={`${scriptVersions.find((version) => version.id === scriptVersion)?.label ?? "完整稿"} · 当前项目`}
                  variant="script"
                />
              </main>
            </ResizablePanel>
            <ResizableHandle className="presento-defense-resize-handle presento-scripts-side-resize-handle" withHandle />
            <ResizablePanel defaultSize="26%" minSize="260px">
              <ScriptAssistantPanel
                onInsertToken={insertAssistantToken}
                projectId={projectId}
                slide={activeSlide}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle className="presento-defense-resize-handle presento-scripts-resize-handle" withHandle />
        <ResizablePanel
          className="presento-defense-gallery-panel"
          collapsedSize={DEFENSE_GALLERY_COLLAPSED_SIZE}
          collapsible
          defaultSize={DEFENSE_GALLERY_EXPANDED_SIZE}
          maxSize={DEFENSE_GALLERY_EXPANDED_SIZE}
          minSize="82px"
          onResize={handleScriptsGalleryResize}
        >
          <motion.section
            className={cn("presento-defense-gallery-shell", isScriptsGalleryCollapsed && "presento-defense-gallery-shell-collapsed")}
            data-collapsed={isScriptsGalleryCollapsed}
            layout
            ref={filmstripRef}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence initial={false}>
              {!isScriptsGalleryCollapsed ? (
                <motion.div
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  className="presento-defense-gallery-motion"
                  exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  key="scripts-gallery-track"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ScrollArea className="presento-defense-gallery-scroll" onWheel={handleFilmstripWheel}>
                    <div className="presento-defense-thumbnail-track">
                      {slides.map((slide, index) => (
                        <Button
                          aria-pressed={slide.id === activeSlide.id}
                          className={cn("presento-defense-thumbnail", slide.id === activeSlide.id && "presento-defense-thumbnail-active")}
                          key={slide.id}
                          onClick={() => selectSlide(slide.id)}
                          type="button"
                          variant="ghost"
                        >
                          <ProjectSlideThumbnailPreview index={index} projectId={projectId} slide={slide} />
                          <span className="presento-defense-thumbnail-label">
                            {formatSlidePage(slide)} · {slide.title}
                          </span>
                        </Button>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function ScriptAssistantPanel({
  onInsertToken,
  projectId,
  slide,
}: {
  onInsertToken: (label: string, content: string, tone?: "pause" | "question" | "card") => void;
  projectId: string;
  slide: ProjectSlide;
}) {
  const [overview, setOverview] = useState<SlideAssistantOverview | null>(null);
  const [assistantError, setAssistantError] = useState("");
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<SlideAssistantAction | null>(null);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const isAssistantBusy = isOverviewLoading || Boolean(runningAction);
  const keywords = overview?.keywords ?? [];
  const risks = overview?.risks ?? [];
  const basis = overview?.basis ?? { topics: [], materials: [] };
  const pageTask = overview?.task ?? "正在生成本页任务...";
  const fallbackNotice = overview && assistantError === "fallback"
    ? "当前使用本地兜底文案，模型配置恢复后会自动使用真实 AI。"
    : "";

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setOverview(null);
        setAssistantError("");
        setIsOverviewLoading(true);
        return runSlideAssistantAction(projectId, slide.id, { action: "overview" });
      })
      .then((response) => {
        if (cancelled || !response) return;
        setOverview(response.result as SlideAssistantOverview);
        setAssistantError(response.usedFallback ? "fallback" : "");
      })
      .catch((nextError) => {
        if (cancelled) return;
        setAssistantError(nextError instanceof Error ? nextError.message : "逐页讲稿助手生成失败");
      })
      .finally(() => {
        if (!cancelled) setIsOverviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, slide.id]);

  const runInsertAction = useCallback(async (action: SlideAssistantAction) => {
    setRunningAction(action);
    setAssistantError("");
    try {
      const response = await runSlideAssistantAction(projectId, slide.id, { action });
      const result = response.result as SlideAssistantInsertResult;
      if (response.usedFallback) setAssistantError("fallback");
      if (result.content.trim()) {
        onInsertToken(result.label, result.content, result.tone);
      }
    } catch (nextError) {
      setAssistantError(nextError instanceof Error ? nextError.message : "AI 动作执行失败");
    } finally {
      setRunningAction(null);
    }
  }, [onInsertToken, projectId, slide.id]);

  const submitRewrite = useCallback(async () => {
    const instruction = rewriteInstruction.trim();
    if (!instruction) return;
    setRunningAction("rewrite");
    setAssistantError("");
    try {
      const response = await runSlideAssistantAction(projectId, slide.id, {
        action: "rewrite",
        instruction,
      });
      const result = response.result as SlideAssistantInsertResult;
      if (response.usedFallback) setAssistantError("fallback");
      if (result.content.trim()) {
        onInsertToken(result.label, result.content, result.tone);
      }
    } catch (nextError) {
      setAssistantError(nextError instanceof Error ? nextError.message : "AI 改稿失败");
    } finally {
      setRunningAction(null);
    }
  }, [onInsertToken, projectId, rewriteInstruction, slide.id]);

  return (
    <aside className="presento-scripts-ai-shell">
      <ScrollArea className="presento-scripts-ai">
        <div className="presento-scripts-ai-inner">
          {assistantError && assistantError !== "fallback" ? (
            <p className="presento-scripts-ai-error">{assistantError}</p>
          ) : null}
          {fallbackNotice ? (
            <p className="presento-scripts-ai-fallback">{fallbackNotice}</p>
          ) : null}

          <section className="presento-scripts-ai-block presento-scripts-ai-task">
            <span>本页任务</span>
            <p>{pageTask}</p>
          </section>

          <section className="presento-scripts-ai-block presento-scripts-ai-actions">
            <span>改稿动作</span>
            <div className="presento-scripts-ai-action-grid">
              <Button disabled={isAssistantBusy} onClick={() => runInsertAction("short")} type="button" variant="outline">
                <Sparkles data-icon="inline-start" aria-hidden="true" />
                {runningAction === "short" ? "生成中..." : "压缩成 30 秒"}
              </Button>
              <Button disabled={isAssistantBusy} onClick={() => runInsertAction("conversational")} type="button" variant="outline">
                {runningAction === "conversational" ? "生成中..." : "改得更口语"}
              </Button>
              <Button disabled={isAssistantBusy} onClick={() => runInsertAction("contribution")} type="button" variant="outline">
                {runningAction === "contribution" ? "生成中..." : "突出个人贡献"}
              </Button>
              <Button disabled={isAssistantBusy} onClick={() => runInsertAction("transition")} type="button" variant="outline">
                {runningAction === "transition" ? "生成中..." : "补转场句"}
              </Button>
              <Button disabled={isAssistantBusy} onClick={() => runInsertAction("teacher_question")} type="button" variant="outline">
                <MessageSquareText data-icon="inline-start" aria-hidden="true" />
                {runningAction === "teacher_question" ? "生成中..." : "生成本页追问"}
              </Button>
              <Button disabled={isAssistantBusy} onClick={() => runInsertAction("answer_card")} type="button" variant="outline">
                <Target data-icon="inline-start" aria-hidden="true" />
                {runningAction === "answer_card" ? "生成中..." : "插入答辩卡"}
              </Button>
              <Button disabled={isAssistantBusy} onClick={() => runInsertAction("keywords")} type="button" variant="outline">
                {runningAction === "keywords" ? "生成中..." : "提炼关键词"}
              </Button>
            </div>
            <div className="presento-scripts-ai-request">
              <span>AI改稿</span>
              <Textarea
                aria-label="逐页讲稿改写要求"
                disabled={isAssistantBusy}
                onChange={(event) => setRewriteInstruction(event.target.value)}
                placeholder="例如：把这一页改成 30 秒答辩开场，突出我负责的部分。"
                value={rewriteInstruction}
              />
              <Button
                disabled={isAssistantBusy || !rewriteInstruction.trim()}
                onClick={submitRewrite}
                type="button"
                variant="outline"
              >
                {runningAction === "rewrite" ? "改稿中..." : "生成改稿"}
              </Button>
            </div>
          </section>

          <details className="presento-scripts-ai-block presento-scripts-ai-disclosure presento-scripts-ai-risk">
            <summary>
              <span>本页风险</span>
            </summary>
            <div className="presento-scripts-ai-risk-list">
              {risks.length ? risks.map((risk) => (
                <p key={risk}>{risk}</p>
              )) : <p>{isOverviewLoading ? "正在生成本页风险..." : "暂无本页风险。"}</p>}
            </div>
          </details>

          <details className="presento-scripts-ai-block presento-scripts-ai-disclosure presento-scripts-ai-basis">
            <summary>
              <span>本页依据</span>
            </summary>
            <dl>
              <div>
                <dt>关联讲点</dt>
                <dd>{basis.topics.length ? basis.topics.join(" / ") : "暂无关联讲点"}</dd>
              </div>
              <div>
                <dt>关联资料</dt>
                <dd>{basis.materials.length ? basis.materials.join(" / ") : "暂无关联资料"}</dd>
              </div>
              <div>
                <dt>关键词</dt>
                <dd className="presento-scripts-ai-chip-list">
                  {keywords.length ? keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary">{keyword}</Badge>
                  )) : <Badge variant="secondary">暂无关键词</Badge>}
                </dd>
              </div>
            </dl>
          </details>

        </div>
      </ScrollArea>
    </aside>
  );
}

function DefenseRoom({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useProjectSlides(projectId);
  const slides = data?.slides ?? emptyProjectSlides;
  const isNarrowLayout = useIsNarrowDefenseLayout();
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [trainingFocuses, setTrainingFocuses] = useState<TrainingFocusItem[]>([]);
  const [trainingFocusError, setTrainingFocusError] = useState("");
  const galleryShellRef = useRef<HTMLElement | null>(null);
  const activeSlide = slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null;
  const activeSlideIndex = activeSlide ? Math.max(0, slides.findIndex((slide) => slide.id === activeSlide.id)) : 0;
  const activeRisks = activeSlide ? buildSlideRisks(activeSlide).slice(0, 3) : [];
  const coachTurns = activeSlide
    ? [
        {
          speaker: "AI 老师",
          content: `你正在讲${formatSlidePage(activeSlide)}「${activeSlide.title}」。${activeRisks[0] ?? "先讲清这一页和项目主线的关系。"}`,
        },
        {
          speaker: "我",
          content: buildSlideSpeakerNote(activeSlide),
        },
        {
          speaker: "AI 老师",
          content: activeRisks[1] ?? "请补充这一页对应的资料证据和个人负责范围。",
        },
      ]
    : [];

  async function startTraining() {
    setIsCreatingSession(true);
    setSessionError("");
    setSessionMessage("");
    try {
      const result = await createProjectTrainingSession(
        projectId,
        activeSlide?.id,
        trainingFocuses.map((focus) => focus.knowledgeNodeId),
      );
      setSessionMessage(
        result.nextStep?.createRealtimeSessionPath
          ? `训练会话已创建：${result.session?.id ?? "已创建"}`
          : "训练会话已创建",
      );
    } catch (nextError) {
      setSessionError(nextError instanceof Error ? nextError.message : "训练会话创建失败");
    } finally {
      setIsCreatingSession(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve()
      .then(async () => fetchProjectTrainingFocuses(projectId))
      .then((payload) => {
        if (cancelled) return;
        setTrainingFocuses(payload.focuses ?? []);
        setTrainingFocusError("");
      })
      .catch((nextError) => {
        if (cancelled) return;
        setTrainingFocusError(nextError instanceof Error ? nextError.message : "讲练重点读取失败");
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectSlide = useCallback((slideId: string) => {
    startTransition(() => setSelectedSlideId(slideId));
  }, []);
  const resetGalleryScroll = useCallback(() => {
    const viewport = galleryShellRef.current?.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (viewport) viewport.scrollLeft = 0;
  }, []);
  const handleGalleryResize = useCallback((panelSize: PanelSize) => {
    const shouldCollapse = panelSize.inPixels <= DEFENSE_GALLERY_COLLAPSED_THRESHOLD;
    setIsGalleryCollapsed((current) => current === shouldCollapse ? current : shouldCollapse);
  }, []);
  const handleGalleryWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const viewport = event.currentTarget.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) return;

    viewport.scrollLeft += event.deltaY;
  }, []);

  useLayoutEffect(() => {
    if (activeSlide && !isGalleryCollapsed) resetGalleryScroll();
  }, [activeSlide, isGalleryCollapsed, resetGalleryScroll]);

  if (isLoading) return <RoomState icon={<Mic aria-hidden="true" />} title="正在读取训练上下文" />;
  if (error) return <RoomState description={error} icon={<Mic aria-hidden="true" />} title="训练上下文读取失败" tone="error" />;
  if (!activeSlide) {
    return (
      <RoomState
        description="当前项目还没有真实 Slide，上线训练前需要先上传并解析资料。"
        icon={<Mic aria-hidden="true" />}
        title="暂无可训练材料"
      />
    );
  }

  return (
    <div className="presento-defense-room">
      <ResizablePanelGroup
        className="presento-defense-resizable presento-defense-resizable-root"
        orientation="vertical"
      >
        <ResizablePanel defaultSize="74%" minSize="56%">
          <ResizablePanelGroup
            className="presento-defense-upper-resizable"
            orientation={isNarrowLayout ? "vertical" : "horizontal"}
          >
            <ResizablePanel defaultSize={isNarrowLayout ? "58%" : "70%"} minSize={isNarrowLayout ? "44%" : "52%"}>
              <section className="presento-defense-slide-pane">
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("presento-defense-slide", activeSlide.imagePath && "presento-defense-slide-image-shell")}
                  initial={{ opacity: 0.86, y: 10 }}
                  key={activeSlide.id}
                  style={{ "--defense-slide-accent": getSlideAccent(activeSlideIndex) } as CSSProperties}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  {activeSlide.imagePath ? (
                    <Image
                      alt={`${formatSlidePage(activeSlide)} ${activeSlide.title}`}
                      className="presento-defense-slide-image"
                      height={900}
                      src={slideAssetUrl(projectId, activeSlide, "image")}
                      unoptimized
                      width={1600}
                    />
                  ) : (
                    <>
                      <div className="presento-defense-slide-kicker">
                        <span>{formatSlidePage(activeSlide)}</span>
                        <span>真实资料</span>
                      </div>
                      <div className="presento-defense-slide-grid">
                        <div className="presento-defense-slide-copy">
                          <h2>{activeSlide.title}</h2>
                          <p>{trimText(activeSlide.extractedText ?? "", 320) || "该页暂未提取到文本。"}</p>
                          <div className="presento-defense-keywords">
                            {extractKeywords(activeSlide).slice(0, 5).map((keyword) => (
                              <Badge className="presento-room-badge-green" key={keyword}>{keyword}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="presento-defense-slide-metric">
                          <span>建议讲述</span>
                          <strong>{Math.max(30, Math.min(90, Math.round((activeSlide.extractedText?.length ?? 80) / 8)))}s</strong>
                          <small>逐页讲练 · 真实解析</small>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              </section>
            </ResizablePanel>
            <ResizableHandle className="presento-defense-resize-handle" withHandle />
            <ResizablePanel defaultSize={isNarrowLayout ? "42%" : "30%"} minSize={isNarrowLayout ? "30%" : "24%"}>
              <aside className="presento-defense-ai-pane">
                <header className="presento-defense-ai-header">
                  <div className="presento-defense-ai-icon">
                    <Bot aria-hidden="true" />
                  </div>
                  <div>
                    <span>训练会话</span>
                    <h2>围绕当前页连续追问</h2>
                  </div>
                </header>

                <section className="presento-defense-ai-question">
                  <span>当前追问</span>
                  <strong>{activeRisks[0] ?? "先用 30 秒说清这一页。"}</strong>
                  <p>回答时尽量绑定 PPT 页、项目目标、代码路径和你的个人负责范围。</p>
                </section>

                <section className="presento-defense-ai-question">
                  <span>本轮训练重点</span>
                  <strong>{trainingFocuses.length ? `${trainingFocuses.length} 个知识图谱重点` : "未设置重点"}</strong>
                  <p>
                    {trainingFocuses.length
                      ? trainingFocuses
                          .slice(0, 4)
                          .map((focus) => focus.knowledgeNode?.title ?? focus.knowledgeNodeId)
                          .join(" · ")
                      : "可先在知识图谱中把关键讲点加入讲练重点。"}
                  </p>
                </section>

                <ScrollArea className="presento-defense-ai-scroll">
                  <div className="presento-defense-message-list">
                    {coachTurns.map((turn) => (
                      <div className={cn("presento-defense-message", turn.speaker === "我" && "presento-defense-message-user")} key={`${activeSlide.id}-${turn.speaker}-${turn.content}`}>
                        <strong>{turn.speaker}</strong>
                        <span>{turn.content}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {sessionError ? <p className="text-sm font-bold text-[#c56a09]">{sessionError}</p> : null}
                {trainingFocusError ? <p className="text-sm font-bold text-[#c56a09]">{trainingFocusError}</p> : null}
                {sessionMessage ? <p className="text-sm font-bold text-[var(--presento-blue-active)]">{sessionMessage}</p> : null}
                <Button className="presento-defense-submit-button" disabled={isCreatingSession} onClick={startTraining}>
                  <Play data-icon="inline-start" aria-hidden="true" />
                  {isCreatingSession ? "正在创建..." : "创建训练会话"}
                </Button>
              </aside>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle className="presento-defense-resize-handle" withHandle />
        <ResizablePanel
          className="presento-defense-gallery-panel"
          collapsedSize={DEFENSE_GALLERY_COLLAPSED_SIZE}
          collapsible
          defaultSize={DEFENSE_GALLERY_EXPANDED_SIZE}
          maxSize={DEFENSE_GALLERY_EXPANDED_SIZE}
          minSize="82px"
          onResize={handleGalleryResize}
        >
          <motion.section
            className={cn("presento-defense-gallery-shell", isGalleryCollapsed && "presento-defense-gallery-shell-collapsed")}
            data-collapsed={isGalleryCollapsed}
            layout
            ref={galleryShellRef}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence initial={false}>
              {!isGalleryCollapsed ? (
                <motion.div
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  className="presento-defense-gallery-motion"
                  exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  key="defense-gallery-track"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ScrollArea className="presento-defense-gallery-scroll" onWheel={handleGalleryWheel}>
                    <div className="presento-defense-thumbnail-track">
                      {slides.map((slide, index) => (
                        <Button
                          aria-pressed={slide.id === activeSlide.id}
                          className={cn("presento-defense-thumbnail", slide.id === activeSlide.id && "presento-defense-thumbnail-active")}
                          key={slide.id}
                          onClick={() => selectSlide(slide.id)}
                          type="button"
                          variant="ghost"
                        >
                          <ProjectSlideThumbnailPreview index={index} projectId={projectId} slide={slide} />
                          <span className="presento-defense-thumbnail-label">
                            {formatSlidePage(slide)} · {slide.title}
                          </span>
                        </Button>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function useIsNarrowDefenseLayout() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 980px)");
    const sync = () => setIsNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isNarrow;
}

function ProjectSlideThumbnailPreview({
  index,
  projectId,
  slide,
}: {
  index: number;
  projectId: string;
  slide: ProjectSlide;
}) {
  if (slide.thumbnailPath || slide.imagePath) {
    return (
      <Image
        alt=""
        aria-hidden="true"
        className="presento-defense-thumbnail-image"
        height={108}
        src={slideAssetUrl(projectId, slide, "thumbnail")}
        unoptimized
        width={192}
      />
    );
  }

  const accent = getSlideAccent(index);
  const title = trimText(slide.title, 22);
  const textLines = (slide.extractedText ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1, 4);

  return (
    <span
      aria-hidden="true"
      className="presento-defense-thumbnail-image presento-defense-thumbnail-preview"
      style={{ "--defense-slide-accent": accent } as CSSProperties}
    >
      <span className="presento-defense-thumbnail-kicker">{formatSlidePage(slide)}</span>
      <strong>{title}</strong>
      <span className="presento-defense-thumbnail-rule" />
      <span className="presento-defense-thumbnail-lines">
        {(textLines.length ? textLines : ["真实解析资料", "逐页模拟讲练"]).map((line) => (
          <i key={line}>{trimText(line, 28)}</i>
        ))}
      </span>
      <em>{String(slide.page).padStart(2, "0")}</em>
    </span>
  );
}

function slideAssetUrl(projectId: string, slide: ProjectSlide, variant: "image" | "thumbnail") {
  const search = variant === "thumbnail" ? "?variant=thumbnail" : "";
  return `/api/projects/${encodeURIComponent(projectId)}/slides/${encodeURIComponent(slide.id)}/image${search}`;
}

function ReviewRoom({ projectId }: { projectId: string }) {
  const { workspace, error, isLoading } = useProjectWorkspace(projectId);
  const { data: deepDiveData } = useProjectDeepDives(projectId);
  const latestReview = workspace?.latestReview ?? null;
  const weaknesses = deepDiveData?.weaknesses ?? [];

  if (isLoading) return <RoomState icon={<MessageSquareText aria-hidden="true" />} title="正在读取复盘" />;
  if (error) return <RoomState description={error} icon={<MessageSquareText aria-hidden="true" />} title="复盘读取失败" tone="error" />;
  if (!latestReview) {
    return (
      <RoomState
        description="完成一轮真实训练并生成复盘后，这里会展示评分、问题和下一轮任务。"
        icon={<MessageSquareText aria-hidden="true" />}
        title="暂无复盘报告"
      />
    );
  }

  return (
    <RoomGrid>
      <RoomCard action={<Badge className="presento-room-badge-green">{latestReview.averageScore} / 100</Badge>} icon={<MessageSquareText aria-hidden="true" />} title="最近复盘" description={latestReview.scoreLabel}>
        <Progress className="mt-3 bg-[var(--presento-border)] [&>div]:bg-[var(--presento-blue)]" value={latestReview.averageScore} />
        <p className="presento-muted mt-4 text-sm font-semibold">生成时间：{formatDateTime(latestReview.createdAt)}</p>
      </RoomCard>
      <RoomCard className="lg:col-span-2" icon={<Target aria-hidden="true" />} title="回流薄弱点" description="只展示真实训练产生的薄弱点。">
        {weaknesses.length ? (
          <QuestionList items={weaknesses.slice(0, 6).map((item) => `${item.title}：${item.reason}`)} />
        ) : (
          <p className="presento-muted text-sm font-semibold">当前复盘没有生成薄弱点记录。</p>
        )}
      </RoomCard>
    </RoomGrid>
  );
}

function DeepDiveRoom({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useProjectDeepDives(projectId);
  const weaknesses = data?.weaknesses ?? [];
  const deepDives = data?.deepDives ?? [];
  const firstDeepDive = deepDives[0] ?? null;
  const firstWeakness = weaknesses[0] ?? null;

  if (isLoading) return <RoomState icon={<Target aria-hidden="true" />} title="正在读取薄弱点" />;
  if (error) return <RoomState description={error} icon={<Target aria-hidden="true" />} title="薄弱点读取失败" tone="error" />;
  if (!weaknesses.length && !deepDives.length) {
    return (
      <RoomState
        description="完成真实训练或手动创建薄弱点后，这里会显示补强材料。"
        icon={<Target aria-hidden="true" />}
        title="暂无薄弱点"
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <RoomCard icon={<Target aria-hidden="true" />} title="薄弱点队列" description="从训练复盘和手动创建记录读取。">
        <div className="flex flex-col gap-2">
          {weaknesses.map((item, index) => (
            <button className={cn("presento-weakness-item", index === 0 && "presento-weakness-item-active")} key={item.id} type="button">
              <strong>{item.title}</strong>
              <span>{item.reason}</span>
            </button>
          ))}
        </div>
      </RoomCard>
      <RoomCard icon={<Search aria-hidden="true" />} title={firstDeepDive?.title ?? firstWeakness?.title ?? "补强材料"} description="中央区域展示后端生成的 deep-dive 内容。">
        <p className="text-base font-semibold leading-8 text-[var(--presento-muted)]">
          {firstDeepDive?.summary ?? firstWeakness?.reason}
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {stringArrayFromUnknown(firstDeepDive?.checklist).map((item) => (
            <StatusRow icon={<CheckCircle2 aria-hidden="true" />} key={item} label={item} />
          ))}
        </div>
      </RoomCard>
    </div>
  );
}

function SkillsRoom({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useProjectSkills(projectId);
  const packs = data?.packs ?? [];
  const invocations = data?.invocations ?? [];

  if (isLoading) return <RoomState icon={<Bot aria-hidden="true" />} title="正在读取 Skills" />;
  if (error) return <RoomState description={error} icon={<Bot aria-hidden="true" />} title="Skills 读取失败" tone="error" />;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <RoomCard icon={<Bot aria-hidden="true" />} title="Skill Packs" description="项目级启用状态来自真实接口。">
        {packs.length ? (
          <div className="flex flex-col gap-2">
            {packs.map((pack) => (
              <StatusRow badge={pack.enabled ? "启用" : "停用"} icon={<Sparkles aria-hidden="true" />} key={pack.packId ?? pack.id ?? pack.name} label={pack.name} meta={pack.description ?? pack.reason ?? undefined} />
            ))}
          </div>
        ) : (
          <p className="presento-muted text-sm font-semibold">当前项目没有 Skill Pack 配置。</p>
        )}
      </RoomCard>
      <RoomCard icon={<Code aria-hidden="true" />} title="最近调用" description="只展示当前项目的 SkillInvocation。">
        {invocations.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {invocations.map((item) => (
              <StatusRow badge={item.status} icon={<Bot aria-hidden="true" />} key={item.id} label={item.skillName} meta={item.trigger} />
            ))}
          </div>
        ) : (
          <p className="presento-muted text-sm font-semibold">还没有真实调用记录。</p>
        )}
      </RoomCard>
    </div>
  );
}

function useProjectSlides(projectId: string) {
  const [data, setData] = useState<{
    slideDecks?: ProjectSlideDeck[];
    slides?: ProjectSlide[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchProjectSlides(projectId)
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setData(null);
          setError(nextError instanceof Error ? nextError.message : "Slide 读取失败");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { data, error, isLoading };
}

function useProjectDeepDives(projectId: string) {
  const [data, setData] = useState<{
    deepDives?: DeepDiveItem[];
    weaknesses?: WeaknessItem[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchProjectDeepDives(projectId)
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setData(null);
          setError(nextError instanceof Error ? nextError.message : "薄弱点读取失败");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { data, error, isLoading };
}

function useProjectSkills(projectId: string) {
  const [data, setData] = useState<{
    packs: SkillPackItem[];
    invocations: SkillInvocationItem[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchProjectSkillPacks(projectId),
      fetchProjectSkillInvocations(projectId),
    ])
      .then(([packsPayload, invocationPayload]) => {
        if (!cancelled) {
          setData({
            packs: packsPayload.skillPacks ?? [],
            invocations: invocationPayload.invocations ?? [],
          });
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setData(null);
          setError(nextError instanceof Error ? nextError.message : "Skills 读取失败");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { data, error, isLoading };
}

function useProjectContentExports(projectId: string) {
  const [exports, setExports] = useState<ContentExportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchProjectContentExports(projectId);
      setExports(payload.exports ?? []);
    } catch (nextError) {
      setExports([]);
      setError(nextError instanceof Error ? nextError.message : "内容输出读取失败");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  return { error, exports, isLoading, refresh };
}

function buildProjectScriptEditorContent(slide: ProjectSlide, version: ScriptVersion) {
  const body = slide.extractedText?.trim() || slide.title;
  const keywords = extractKeywords(slide);
  const firstParagraph = trimText(body, version === "short" ? 180 : 700);

  if (version === "keywords") {
    return `
      <h2>${escapeHtml(slide.title)}</h2>
      ${keywords.length ? `<ul>${listHtml(keywords)}</ul>` : "<p>暂无关键词。</p>"}
    `;
  }

  return `
    <h2>${escapeHtml(formatSlidePage(slide))} ${escapeHtml(slide.title)}</h2>
    <p>${escapeHtml(firstParagraph)}</p>
    ${keywords.length ? `<h2>关键词</h2><ul>${listHtml(keywords)}</ul>` : ""}
  `;
}

function extractKeywords(slide: ProjectSlide) {
  const metadataKeywords = stringArrayFromUnknown(slide.metadata?.keywords);
  if (metadataKeywords.length) return metadataKeywords.slice(0, 8);

  const words = (slide.extractedText ?? slide.title)
    .split(/[，。；、\s,.;:()（）]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);

  return Array.from(new Set(words)).slice(0, 8);
}

function stringArrayFromUnknown(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function trimText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function formatSlidePage(slide: ProjectSlide) {
  return `Slide ${String(slide.page).padStart(2, "0")}`;
}

function getSlideAccent(index: number) {
  const accents = ["#10b981", "#3d74a4", "#b9832d", "#64748b", "#0f9f7a", "#5b6f86"];
  return accents[index % accents.length] ?? "#10b981";
}

function buildSlideSpeakerNote(slide: ProjectSlide) {
  const body = slide.extractedText?.trim();
  if (!body) return `${formatSlidePage(slide)} 主要讲「${slide.title}」，需要先说明它和项目主线的关系。`;
  return trimText(body.replace(slide.title, "").trim() || body, 150);
}

function buildSlideRisks(slide: ProjectSlide) {
  const keywords = extractKeywords(slide).slice(0, 3);
  const title = slide.title || formatSlidePage(slide);
  return [
    `只念「${title}」页面内容，没有讲清它对项目价值的作用。`,
    keywords[0] ? `「${keywords[0]}」没有解释清楚，容易被问具体场景或技术取舍。` : "没有说明这一页对应的项目材料和实现边界。",
    keywords[1] ? `如果老师追问「${keywords[1]}」，需要补充个人负责范围。` : "没有提前交代个人负责范围，容易显得参与度不清楚。",
  ];
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RoomState({
  title,
  tone = "muted",
}: {
  description?: string | null;
  icon?: ReactNode;
  title: string;
  tone?: "muted" | "error";
}) {
  const isLoadingState = title.startsWith("正在");
  const stateImage = detailStateImages[isLoadingState ? "loading" : "empty"];

  return (
    <div className={cn("presento-detail-state presento-room-state", tone === "error" && "presento-detail-state-error")}>
      <Image
        alt={stateImage.alt}
        className="presento-detail-state-image"
        height={stateImage.height}
        priority={isLoadingState}
        sizes="(max-width: 768px) 70vw, 420px"
        src={stateImage.src}
        width={stateImage.width}
      />
      <div className="presento-detail-state-copy">
        <h2>{title}</h2>
      </div>
    </div>
  );
}

function PCGRoom({ projectId }: { projectId: string }) {
  const { error, exports, isLoading, refresh } = useProjectContentExports(projectId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const weiyunRef = useRef<HTMLDivElement>(null);
  const inputDocsRef = useRef<HTMLDivElement>(null);
  const inputQqRef = useRef<HTMLDivElement>(null);
  const presentoRef = useRef<HTMLDivElement>(null);
  const qqRef = useRef<HTMLDivElement>(null);
  const outputDocsRef = useRef<HTMLDivElement>(null);
  const tencentVideoRef = useRef<HTMLDivElement>(null);

  async function generateExports() {
    setIsGenerating(true);
    setGenerateError("");
    try {
      await createProjectContentExports(projectId);
      await refresh();
    } catch (nextError) {
      setGenerateError(nextError instanceof Error ? nextError.message : "内容输出生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0 overflow-hidden bg-transparent py-8 pr-4 pl-[calc(var(--presento-detail-safe-start)+2rem)] sm:pr-8 sm:pl-[calc(var(--presento-detail-safe-start)+3rem)]"
    >
      <DotPattern
        className="presento-dot-pattern"
        cr={1.35}
        cx={1.5}
        cy={1.5}
        glow={false}
        height={16}
        width={16}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-[16%] top-16 h-64 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.16),rgba(16,185,129,0))] blur-3xl"
      />
      <div className="absolute top-8 right-8 z-40 w-[min(360px,calc(100%-2rem))] rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-[var(--presento-faint)]">Content exports</div>
            <h2 className="text-base font-black text-[var(--presento-ink)]">内容输出</h2>
          </div>
          <Button className="rounded-xl font-black" disabled={isGenerating} onClick={generateExports} size="sm">
            {isGenerating ? "生成中" : "生成"}
          </Button>
        </div>
        {isLoading ? (
          <p className="text-sm font-bold text-[var(--presento-muted)]">正在读取真实输出...</p>
        ) : error || generateError ? (
          <p className="text-sm font-bold text-[#c56a09]">{error ?? generateError}</p>
        ) : exports.length ? (
          <div className="flex flex-col gap-2">
            {exports.slice(0, 3).map((item) => (
              <StatusRow badge={item.status} icon={<Radio aria-hidden="true" />} key={item.id} label={item.title} meta={item.kind} />
            ))}
          </div>
        ) : (
          <p className="text-sm font-bold text-[var(--presento-muted)]">还没有真实内容输出。</p>
        )}
      </div>
      <div className="relative z-20 flex h-full min-h-0 flex-col items-center justify-center gap-12 md:flex-row md:justify-between md:gap-16">
        <div className="relative z-10 flex flex-row items-center justify-center gap-4 md:flex-col md:gap-5">
          <BeamHoverNode
            detail={pcgNodeDetails.weiyun}
            ref={weiyunRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(41,128,255,0.12)]"
            side="right"
          >
            <TencentWeiyunMark />
          </BeamHoverNode>
          <BeamHoverNode
            detail={pcgNodeDetails.inputDocs}
            ref={inputDocsRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(43,101,244,0.12)]"
            side="right"
          >
            <TencentDocsMark />
          </BeamHoverNode>
          <BeamHoverNode
            detail={pcgNodeDetails.inputQq}
            ref={inputQqRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(31,35,41,0.08)]"
            side="right"
          >
            <QqMark />
          </BeamHoverNode>
        </div>
        <BeamHoverNode
          detail={pcgNodeDetails.presento}
          ref={presentoRef}
          className="size-40 bg-[linear-gradient(180deg,#ffffff,#eef8f3)] px-5"
          ringClassName="shadow-[0_24px_60px_rgba(16,185,129,0.18)]"
          side="top"
        >
          <Image
            alt={presentoBrandLogo.alt}
            className="size-24 object-contain"
            height={512}
            priority
            src="/brand/presento-icon-panda.png"
            width={512}
          />
        </BeamHoverNode>
        <div className="relative z-10 flex flex-row items-center justify-center gap-4 md:flex-col md:gap-5">
          <BeamHoverNode
            detail={pcgNodeDetails.outputQq}
            ref={qqRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(31,35,41,0.08)]"
            side="left"
          >
            <QqMark />
          </BeamHoverNode>
          <BeamHoverNode
            detail={pcgNodeDetails.outputDocs}
            ref={outputDocsRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(43,101,244,0.12)]"
            side="left"
          >
            <TencentDocsMark />
          </BeamHoverNode>
          <BeamHoverNode
            detail={pcgNodeDetails.tencentVideo}
            ref={tencentVideoRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(16,171,242,0.12)]"
            side="left"
          >
            <TencentVideoMark />
          </BeamHoverNode>
        </div>
      </div>
      <AnimatedBeam
        containerRef={containerRef}
        curvature={-58}
        duration={7}
        endYOffset={-2}
        fromRef={weiyunRef}
        gradientStartColor="#2980ff"
        gradientStopColor="#10b981"
        pathColor="rgba(31,35,41,0.24)"
        pathWidth={4}
        repeatDelay={0.2}
        startYOffset={2}
        toRef={presentoRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        curvature={0}
        duration={7}
        fromRef={inputDocsRef}
        gradientStartColor="#2b65f4"
        gradientStopColor="#10b981"
        pathColor="rgba(31,35,41,0.24)"
        pathWidth={4}
        repeatDelay={0.2}
        toRef={presentoRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        curvature={58}
        duration={7}
        fromRef={inputQqRef}
        gradientStartColor="#f9ae08"
        gradientStopColor="#10b981"
        pathColor="rgba(31,35,41,0.24)"
        pathWidth={4}
        repeatDelay={0.2}
        toRef={presentoRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        curvature={-72}
        duration={7}
        fromRef={presentoRef}
        gradientStartColor="#10b981"
        gradientStopColor="#f9ae08"
        pathColor="rgba(31,35,41,0.24)"
        pathWidth={4}
        repeatDelay={0.1}
        toRef={qqRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        curvature={0}
        duration={7}
        fromRef={presentoRef}
        gradientStartColor="#10b981"
        gradientStopColor="#2b65f4"
        pathColor="rgba(31,35,41,0.24)"
        pathWidth={4}
        repeatDelay={0.1}
        toRef={outputDocsRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        curvature={72}
        duration={7}
        fromRef={presentoRef}
        gradientStartColor="#10b981"
        gradientStopColor="#10abf2"
        pathColor="rgba(31,35,41,0.24)"
        pathWidth={4}
        repeatDelay={0.1}
        toRef={tencentVideoRef}
      />
    </div>
  );
}

const BeamNode = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    className?: string;
    ringClassName?: string;
  }
>(function BeamNode({ children, className, ringClassName }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative z-10 flex size-32 items-center justify-center rounded-[30px] border border-white/80 backdrop-blur-sm",
        ringClassName,
        className,
      )}
    >
      <div className="absolute inset-3 rounded-[24px] border border-[rgba(31,35,41,0.06)]" />
      <div className="relative z-10 flex items-center justify-center">{children}</div>
    </div>
  );
});

const BeamHoverNode = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    className?: string;
    detail: (typeof pcgNodeDetails)[keyof typeof pcgNodeDetails];
    ringClassName?: string;
    side?: "top" | "right" | "bottom" | "left";
  }
>(function BeamHoverNode({ children, className, detail, ringClassName, side = "top" }, ref) {
  return (
    <HoverCard closeDelay={80} openDelay={120}>
      <HoverCardTrigger asChild>
        <div className="relative z-30 flex cursor-default items-center justify-center rounded-[30px]">
          <BeamNode className={className} ref={ref} ringClassName={ringClassName}>
            {children}
          </BeamNode>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72 rounded-2xl border-[var(--presento-border)] bg-white/95 p-4 shadow-[var(--presento-popover-shadow)] backdrop-blur-xl"
        side={side}
        sideOffset={16}
      >
        <div className="text-sm font-black text-[var(--presento-ink)]">{detail.title}</div>
        <p className="mt-2 text-xs font-semibold leading-5 text-[var(--presento-muted)]">
          {detail.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {detail.items.map((item) => (
            <Badge className="presento-room-badge-green" key={item}>{item}</Badge>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

function QqMark() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      style={{ height: 88, width: 72 }}
      viewBox="0 0 20 25"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.56 23.668c-1.981 0-3.8-.666-4.972-1.662-.594.179-1.355.466-1.835.823-.41.305-.359.615-.285.741.325.55 5.577.351 7.094.18v-.082z"
        fill="#f9ae08"
      />
      <path
        d="M9.56 23.668c1.98 0 3.8-.666 4.971-1.662.595.179 1.356.466 1.836.823.41.305.359.615.285.741-.326.55-5.578.351-7.094.18v-.082z"
        fill="#f9ae08"
      />
      <path
        d="M9.573 11.55c3.272-.023 5.894-.476 6.784-.72a.84.84 0 0 0 .325-.163c0-.03.013-.535.013-.796-.002-4.39-2.063-8.802-7.135-8.802-5.073 0-7.134 4.411-7.134 8.802 0 .261.013.767.013.796 0 0 .093.098.261.145.821.229 3.493.715 6.849.738zM18.465 15.391c-.204-.655-.48-1.42-.76-2.157 0 0-.188-.005-.285.016-2.33.503-5.536.869-7.847.841h-.024c-2.311.028-5.632-.356-7.847-.84-.098-.021-.285-.017-.285-.017-.28.735-.558 1.5-.76 2.157-.893 2.785-.71 4.331-.413 4.444.423.163 1.99-2.347 1.99-2.347 0 2.457 2.207 6.227 7.26 6.263h.135c5.053-.036 7.26-3.806 7.26-6.263 0 0 1.567 2.508 1.99 2.347.295-.113.478-1.659-.411-4.444z"
        fill="#000"
      />
      <path
        d="M9.573 10.111c1.68 0 3.268-.597 4.005-1.117.258-.182.189-.453-.082-.58-.31-.147-.635-.236-1.005-.322a13.4 13.4 0 0 0-2.917-.332H9.55c-.934 0-1.98.114-2.917.332-.37.085-.695.175-1.004.322-.271.127-.34.398-.082.58.737.52 2.325 1.117 4.005 1.117h.024z"
        fill="#f9ae08"
      />
      <path
        d="M9.571 14.078h-.024c-1.569.02-3.471-.053-5.314-.417a15 15 0 0 0-.172 3.449c.207 3.477 2.262 5.663 5.435 5.695h.128c3.172-.032 5.228-2.218 5.435-5.695a15 15 0 0 0-.172-3.449c-1.843.366-3.745.437-5.316.417"
        fill="#fff"
      />
      <path
        d="M5.07 17.237c0 .087.063.163.15.175.856.13 1.864.178 2.835.104a.177.177 0 0 0 .162-.178v-3.395c-.997-.056-2.072-.14-3.146-.322z"
        fill="#f10824"
      />
      <path
        d="M9.549 14.23c-2.53 0-5.424-.294-8.132-.994l1.024-2.568s3.014.756 7.108.756h.024c4.093 0 7.108-.755 7.108-.755l1.024 2.567c-2.709.702-5.602.994-8.132.994z"
        fill="#f10824"
      />
      <path
        d="M7.755 7.44c-.687.031-1.275-.756-1.312-1.756-.037-1.002.49-1.84 1.178-1.872.687-.03 1.274.757 1.312 1.759.037 1.002-.489 1.84-1.178 1.87M12.677 5.684c-.037 1.001-.625 1.789-1.312 1.757-.688-.03-1.215-.868-1.178-1.87s.625-1.79 1.312-1.76 1.215.87 1.178 1.873"
        fill="#fff"
      />
      <path
        d="M8.58 5.737c.034.431-.201.815-.525.856-.325.042-.615-.273-.65-.705-.034-.432.201-.815.523-.857.326-.042.617.274.651.706M10.552 5.83c.305-.527 1.02-.693 1.543-.407.374.2.106.657-.232.473-.32-.172-.764-.16-.998.139-.185.235-.456.041-.313-.207z"
        fill="#000"
      />
    </svg>
  );
}

function TencentDocsMark() {
  return (
    <svg
      aria-hidden="true"
      style={{ height: 84, width: 84 }}
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M720.288 144H258.624a92.512 92.512 0 0 0-90.848 84.928L128.224 795.072A78.112 78.112 0 0 0 207.168 880h566.016A92.448 92.448 0 0 0 864 795.072l31.648-452.448z"
        fill="#2B65F4"
      />
      <path
        d="M791.712 342.624h104.32L720.672 144l-7.936 113.728a78.144 78.144 0 0 0 78.976 84.896z"
        fill="#00DBFE"
      />
      <path
        d="M655.072 305.44H221.152a28.32 28.32 0 0 0-21.216 47.04l111.744 126.592a28.352 28.352 0 0 0 21.216 9.6h421.152a28.32 28.32 0 0 0 21.216-47.04z"
        fill="#FFFFFF"
      />
      <path
        d="M491.104 190.272L394.272 880h226.4l74.304-529.344-154.624-175.168a28.288 28.288 0 0 0-49.248 14.784z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function TencentVideoMark() {
  return (
    <svg
      aria-hidden="true"
      style={{ height: 88, width: 88 }}
      viewBox="0 0 1024 1024"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M327.68 92.16c28.16-2.56 56.32 2.56 81.92 12.8 58.88 20.48 115.2 46.08 168.96 74.24 92.16 48.64 179.2 104.96 263.68 166.4 35.84 28.16 74.24 56.32 102.4 92.16 17.92 20.48 30.72 48.64 28.16 76.8-5.12 33.28-25.6 61.44-48.64 84.48-92.16 92.16-192 176.64-302.08 245.76-56.32 35.84-115.2 66.56-176.64 89.6-38.4 15.36-81.92 28.16-122.88 23.04-25.6-2.56-48.64-12.8-66.56-33.28-15.36-17.92-23.04-38.4-28.16-61.44v-2.56c17.92-5.12 35.84-10.24 56.32-15.36 76.8-20.48 153.6-53.76 225.28-89.6 76.8-40.96 151.04-87.04 220.16-140.8 23.04-17.92 48.64-35.84 58.88-64 10.24-20.48 7.68-46.08-5.12-64-12.8-23.04-33.28-40.96-51.2-56.32-23.04-17.92-48.64-35.84-74.24-48.64-48.64-30.72-99.84-56.32-151.04-84.48-58.88-30.72-120.32-56.32-181.76-76.8-28.16-7.68-56.32-17.92-84.48-25.6 2.56-12.8 7.68-25.6 12.8-38.4 15.36-35.84 43.52-58.88 74.24-64z"
        fill="#10ABF2"
      />
      <path
        d="M156.16 197.12c25.6-12.8 56.32-10.24 84.48-5.12-10.24 38.4-15.36 79.36-20.48 117.76 0 17.92-2.56 33.28-5.12 51.2-2.56 20.48-2.56 43.52-5.12 64 0 25.6-2.56 48.64-2.56 74.24-2.56 23.04 0 48.64-2.56 71.68 0 35.84 0 71.68 2.56 107.52 2.56 53.76 5.12 110.08 12.8 163.84v7.68c-25.6 5.12-56.32 10.24-79.36-7.68-23.04-17.92-30.72-48.64-38.4-76.8-12.8-84.48-20.48-176.64-20.48-268.8 0-48.64 5.12-94.72 12.8-140.8 5.12-38.4 12.8-76.8 25.6-112.64 5.12-20.48 17.92-38.4 35.84-46.08z"
        fill="#FF8F21"
      />
      <path
        d="M240.64 189.44h5.12c28.16 7.68 56.32 17.92 84.48 25.6 61.44 20.48 122.88 48.64 181.76 76.8 51.2 28.16 102.4 53.76 151.04 84.48 25.6 15.36 51.2 30.72 74.24 48.64 20.48 15.36 38.4 33.28 51.2 56.32 10.24 17.92 12.8 43.52 5.12 64-12.8 28.16-38.4 46.08-58.88 64-71.68 56.32-145.92 102.4-222.72 143.36-71.68 38.4-145.92 69.12-225.28 89.6-17.92 5.12-35.84 10.24-56.32 15.36-2.56 0-7.68 2.56-10.24 2.56 0-5.12 0-10.24-2.56-15.36-7.68-53.76-10.24-110.08-12.8-163.84-2.56-35.84-2.56-71.68-2.56-107.52 0-23.04 0-48.64 2.56-71.68 0-25.6 2.56-48.64 2.56-74.24 2.56-20.48 2.56-43.52 5.12-64 2.56-17.92 2.56-33.28 5.12-51.2 7.68-40.96 12.8-81.92 23.04-122.88m104.96 143.36c-10.24 2.56-15.36 15.36-15.36 25.6v317.44c0 10.24 2.56 23.04 10.24 25.6 10.24 2.56 20.48 0 28.16-7.68l215.04-153.6c10.24-7.68 17.92-17.92 17.92-30.72s-10.24-20.48-20.48-28.16c-71.68-48.64-145.92-97.28-217.6-145.92-2.56 0-10.24-5.12-17.92-2.56z"
        fill="#7DE621"
      />
      <path
        d="M345.6 332.8c7.68-2.56 15.36 2.56 20.48 5.12 71.68 48.64 145.92 97.28 217.6 145.92 10.24 5.12 20.48 15.36 20.48 28.16 0 12.8-7.68 23.04-17.92 30.72l-215.04 153.6c-7.68 5.12-17.92 10.24-28.16 7.68-10.24-5.12-12.8-17.92-10.24-25.6v-125.44c-2.56-48.64 0-94.72 0-143.36-2.56-15.36-2.56-30.72 0-48.64-2.56-12.8 2.56-25.6 12.8-28.16z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function TencentWeiyunMark() {
  return (
    <svg
      aria-hidden="true"
      style={{ height: 76, width: 98 }}
      viewBox="0 0 1379 1024"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M987.909224 900.576653c10.971429-8.986122 21.545796-18.348408 31.681307-28.212245 96.193306-93.748245 149.169633-222.187102 149.169632-361.680979 0-14.524082-0.543347-28.88098-1.609143-43.070694a243.168653 243.168653 0 0 1 91.324082 189.962449c0 143.318204-103.006041 234.809469-270.607673 242.980571l0.041795 0.020898z m-532.500897 0.647837c-110.592 0-199.68-26.791184-257.609143-77.406041-50.823837-44.408163-77.656816-107.52-77.656817-182.522776 0-79.307755 28.065959-148.145633 79.119674-193.870367a211.800816 211.800816 0 0 1 142.774857-54.104816c8.463673 0 16.990041 0.459755 25.558204 1.421061 63.38351 7.000816 112.64 37.114776 135.188898 82.546939 16.509388 33.353143 15.610776 69.820082-2.507755 99.996734-14.085224 23.44751-33.248653 37.908898-56.967837 42.987103-27.397224 5.851429-60.666776-1.191184-84.78302-18.014041l-60.144327 104.155428c50.364082 31.764898 113.099755 43.509551 170.067592 31.305143 56.717061-12.099918 103.340408-46.205388 134.791837-98.617469 39.079184-64.992653 41.712327-145.387102 7.188898-215.123592-36.884898-74.396735-108.105143-125.680327-198.133551-143.777959a257.609143 257.609143 0 0 1 61.565387-84.365061c53.707755-48.817633 129.107592-75.692408 212.365062-75.692409 99.22351 0 190.840163 39.998694 257.94351 112.681796 67.37502 72.933878 104.489796 171.593143 104.489796 277.859266 0 106.788571-40.124082 204.716408-112.911674 275.602285-77.176163 75.190857-183.484082 114.938776-307.388081 114.938776h-172.95151z m677.302857-587.734204C1061.219265 127.749224 890.420245 0 686.226286 0c-113.204245 0-217.338776 37.971592-293.198368 106.976653a381.471347 381.471347 0 0 0-107.770775 170.819918A329.310041 329.310041 0 0 0 119.118367 357.982041C42.360163 426.736327 0 527.36 0 641.295673 0 751.992163 41.085388 846.367347 118.742204 914.285714c80.164571 70.029061 196.545306 107.081143 336.666123 107.081143h507.611428c248.602122 0 415.618612-146.181224 415.618612-363.791673 0-159.346939-103.026939-295.01649-245.885387-344.084898h-0.041796z"
        fill="#2980FF"
      />
    </svg>
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
