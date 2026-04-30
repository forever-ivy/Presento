"use client";

import {
  Bot,
  ChevronRight,
  CheckCircle2,
  Code,
  FileQuestion,
  FileText,
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
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PanelImperativeHandle, PanelSize } from "react-resizable-panels";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";
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
import {
  demoDeepDives,
  demoDefenseSlides,
  demoProject,
  demoReviewMetrics,
  demoSkillInvocations,
  demoSkillPacks,
} from "@/lib/demo-data";
import { presentoBrandLogo } from "@/lib/brand";
import { useWorkspace } from "@/lib/use-workspace";

gsap.registerPlugin(useGSAP);

const DOCK_FOCUS_MS = 680;
const ENTER_MS = 1240;
const DOCK_ROOM_OPEN_MS = ENTER_MS - DOCK_FOCUS_MS;
const DOCK_ROUTE_SETTLE_MS = 80;
const ROOM_SWITCH_MS = 560;
const FLOW_DEFAULT_VIEWPORT = { x: 500, y: 260, zoom: 0.62 };
const EXIT_MS = 760;
const MAP_RETURN_CAMERA_MS = 1240;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const BACKGROUND_COPY_VISIBLE_MS = 10_000;
const BACKGROUND_COPY_FADE_MS = 900;
const BACKGROUND_COPY_PINNED_STORAGE_KEY = "presento.background-copy-pinned";
const DEFENSE_GALLERY_EXPANDED_SIZE = "168px";
const DEFENSE_GALLERY_COLLAPSED_SIZE = "20px";
const DEFENSE_GALLERY_COLLAPSED_THRESHOLD = 30;
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

export function FlowWorkspaceView() {
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
    navigateWithBackgroundExit(flowStepToRoute(stepId));
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
                />
              ) : null}
              {roomSwitch ? (
                <StepRoomIncomingSlide
                  onKnowledgeReaderBackHandlerChange={(handler) => {
                    knowledgeReaderBackHandlerRef.current = handler;
                  }}
                  onKnowledgeReaderModeChange={setKnowledgeReaderMode}
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

function splitCountdownLabel(label: string) {
  const match = label.match(/^(\d+)(.*)$/);
  if (!match) return { value: label, unit: "" };

  return { value: match[1], unit: match[2] };
}

function MapBackgroundCopy({
  behavior,
  exiting,
}: {
  behavior: FlowBackgroundCopyBehavior;
  exiting: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [deadlineMs] = useState(getDemoDefenseDeadlineMs);
  const animationMode = getFlowBackgroundCopyAnimationMode({ behavior, exiting });

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
  const { value: countdownValue, unit: countdownUnit } = splitCountdownLabel(countdownLabel);
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
            <span className="presento-flow-background-copy-base">剩余</span>
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-red presento-flow-background-copy-accent-primary">
              <span>{countdownValue}</span>
              <span className="presento-flow-background-copy-unit-success">{countdownUnit}</span>
            </span>
          </span>
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-base">剩余</span>
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-red presento-flow-background-copy-accent-primary">
              <span>{countdownValue}</span>
              <span className="presento-flow-background-copy-unit-success">{countdownUnit}</span>
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
            <span className="presento-flow-background-copy-base presento-flow-background-copy-base-complete">
              已经完成
            </span>
          </span>
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-lime presento-flow-background-copy-accent-secondary presento-flow-background-copy-accent-leading">
              {demoProject.readiness}%
            </span>
            <span className="presento-flow-background-copy-base presento-flow-background-copy-base-complete">
              已经完成
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
  transition,
}: {
  onKnowledgeReaderBackHandlerChange: (handler: (() => void) | null) => void;
  onKnowledgeReaderModeChange: (isReaderMode: boolean) => void;
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
}: {
  activeId: FlowStepId;
  className?: string;
  instant?: boolean;
  motionProps?: Pick<MotionProps, "animate" | "initial" | "transition">;
  onKnowledgeReaderBackHandlerChange: (handler: (() => void) | null) => void;
  onKnowledgeReaderModeChange: (isReaderMode: boolean) => void;
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
  stepId,
}: {
  onKnowledgeReaderBackHandlerChange: (handler: (() => void) | null) => void;
  onKnowledgeReaderModeChange: (isReaderMode: boolean) => void;
  stepId: FlowStepId;
}) {
  if (stepId === "files") return <FilesRoom />;
  if (stepId === "knowledge") {
    return (
      <KnowledgeRoom
        onReaderBackHandlerChange={onKnowledgeReaderBackHandlerChange}
        onReaderModeChange={onKnowledgeReaderModeChange}
      />
    );
  }
  if (stepId === "scripts") return <ScriptsRoom />;
  if (stepId === "defense") return <DefenseRoom />;
  if (stepId === "review") return <ReviewRoom />;
  if (stepId === "deepDive") return <DeepDiveRoom />;
  if (stepId === "skills") return <SkillsRoom />;
  return <PCGRoom />;
});

function FilesRoom() {
  const { workspace, addFiles } = useWorkspace();

  return (
    <div className="flex flex-col gap-4">
      <ProjectUploadWorkspace
        initialFiles={workspace?.files ?? []}
        onUploadComplete={addFiles}
        variant="workspace"
      />
    </div>
  );
}

function KnowledgeRoom({
  onReaderBackHandlerChange,
  onReaderModeChange,
}: {
  onReaderBackHandlerChange: (handler: (() => void) | null) => void;
  onReaderModeChange: (isReaderMode: boolean) => void;
}) {
  return (
    <KnowledgeMapRoom
      onReaderBackHandlerChange={onReaderBackHandlerChange}
      onReaderModeChange={onReaderModeChange}
      projectId={demoProject.id}
    />
  );
}

type ScriptVersion = "normal" | "short" | "keywords";
type DemoScriptSlide = (typeof demoDefenseSlides)[number];

const scriptVersions: { id: ScriptVersion; label: string }[] = [
  { id: "normal", label: "完整版" },
  { id: "short", label: "简练版" },
  { id: "keywords", label: "关键词版" },
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

function buildScriptEditorContent(slide: DemoScriptSlide, version: ScriptVersion) {
  if (version === "keywords") {
    return `
      <h2>${escapeHtml(slide.title)}关键词提词</h2>
      <p>这一页先用一句话讲清：${escapeHtml(slide.speakerNote)}</p>
      <ul>${listHtml(slide.keywords)}</ul>
      <p><mark data-presento-token="pause">停顿提示：讲完关键词后停顿 2 秒，切回 PPT 图示。</mark></p>
      <h3>高危追问</h3>
      <ul>${listHtml(slide.risks)}</ul>
    `;
  }

  const body = version === "short" ? slide.speakerNote : slide.summary;
  const transition =
    version === "short"
      ? "接下来我用一条订单流转把这页讲清楚。"
      : "这页的核心不是堆技术名词，而是讲清楚数据从哪里来、经过哪里、最后支撑什么能力。";

  return `
    <p>${escapeHtml(body)}</p>
    <p>${escapeHtml(transition)}</p>
    <ul>${listHtml(slide.keywords.map((keyword) => `关键词：${keyword}`))}</ul>
    <h3>证据来源</h3>
    <p>${slide.evidence.map((item) => `<mark>${escapeHtml(item)}</mark>`).join(" ")}</p>
    <h3>老师可能追问</h3>
    <ul>${listHtml(slide.risks)}</ul>
  `;
}

function buildDeepDiveAnswerContent() {
  return `
    <p>如果后厨已经接单，订单会从待处理进入制作中。这个状态下用户端不再直接取消，而是进入人工确认或异常处理流程，避免后厨已经备餐但前端仍撤单造成数据和履约不一致。</p>
    <p><mark data-presento-token="card">答辩卡片：用“状态机 + 权限边界 + 异常处理”三句话回答。</mark></p>
  `;
}

function buildReviewReportContent() {
  return `
    <h2>本轮薄弱点</h2>
    <ul>
      <li>系统架构页表达偏散，状态流转和接口权限需要更紧。</li>
      <li>数据库金额快照的解释还不够具体，需要绑定 orders.sql。</li>
      <li>个人负责范围要明确落到后端订单接口和订单状态变更。</li>
    </ul>
    <h2>建议背熟回答</h2>
    <p>订单模块的核心是：前端只提交业务请求，后端校验权限和状态后写入订单，再由后厨看板读取待处理订单。这样可以避免前端篡改状态，也能保证订单数据一致。</p>
    <h2>下一轮训练重点</h2>
    <ol>
      <li>专项练第 2 页系统架构，控制在 55 秒内。</li>
      <li>准备 30 秒版数据库冗余字段解释。</li>
      <li>把高质量回答加入逐页讲稿。</li>
    </ol>
  `;
}

function ScriptsRoom() {
  const isNarrowLayout = useIsNarrowDefenseLayout();
  const [activeSlideIndex, setActiveSlideIndex] = useState(1);
  const [scriptVersion, setScriptVersion] = useState<ScriptVersion>("normal");
  const [aiSuggestion, setAiSuggestion] = useState("这段讲稿可以更口语化，并补充后厨接单、订单写入、看板读取三段链路，让表达更完整。");
  const [rewriteRequest, setRewriteRequest] = useState("");
  const [isScriptsAiCollapsed, setIsScriptsAiCollapsed] = useState(false);
  const [isScriptsGalleryCollapsed, setIsScriptsGalleryCollapsed] = useState(false);
  const editorRef = useRef<RichScriptEditorHandle | null>(null);
  const filmstripRef = useRef<HTMLElement | null>(null);
  const scriptsAiPanelRef = useRef<PanelImperativeHandle | null>(null);
  const activeSlide = demoDefenseSlides[activeSlideIndex] ?? demoDefenseSlides[1] ?? demoDefenseSlides[0];
  const editorContent = useMemo(
    () => buildScriptEditorContent(activeSlide, scriptVersion),
    [activeSlide, scriptVersion],
  );
  const scriptsAiCollapsedSize = "20px";
  const scriptsAiCollapsedThreshold = 42;
  const scriptsAiPanelMotion: Pick<MotionProps, "animate" | "exit" | "initial" | "transition"> = {
    animate: { filter: "blur(0px)", opacity: 1, x: 0 },
    exit: { filter: "blur(6px)", opacity: 0, x: 18 },
    initial: { filter: "blur(6px)", opacity: 0, x: 18 },
    transition: { duration: 0.26, ease: "easeOut" },
  };
  const quickActions = [
    {
      label: "口语化表达",
      prompt: "已经把表达调成更像现场答辩的说法，保留证据链但减少书面语。",
      snippet: `<p>口语化版本：这一页我主要想让老师看到，用户下单以后，订单不是直接显示在前端，而是先经过后端校验、写入数据库，再同步给后厨看板。</p>`,
    },
    {
      label: "压缩到 30 秒",
      prompt: "建议先讲数据流，再补一句为什么这样设计，控制在 30 秒左右。",
      replace: true,
      snippet: `<p>${escapeHtml(activeSlide.speakerNote)}</p><p>我会重点说明这一页和订单链路的关系，避免展开太多实现细节。</p>`,
    },
    {
      label: "增强逻辑性",
      prompt: "建议按“输入、处理、输出、价值”四段组织，老师更容易跟上。",
      snippet: `<ol><li>输入：用户点餐并提交订单。</li><li>处理：后端校验权限、写入订单和明细。</li><li>输出：后厨看板读取待处理订单并更新状态。</li></ol>`,
    },
    {
      label: "补充技术细节",
      prompt: "可补充接口权限、状态枚举和数据库写入三个技术点，不要泛泛而谈。",
      snippet: `<p><mark data-presento-token="question">老师可能追问：状态枚举有哪些？哪些接口允许用户端调用，哪些只能由后厨端调用？</mark></p>`,
    },
    {
      label: "加入过渡句",
      prompt: "过渡句已经补到当前讲稿后面，用来连接下一页。",
      snippet: `<p>讲完整体架构以后，下一页我会具体说明数据库为什么这样拆表，以及订单金额为什么要保存快照。</p>`,
    },
    {
      label: "生成老师追问",
      prompt: "已根据当前页证据生成追问，可以加入答辩卡片继续练。",
      snippet: `<ul>${listHtml(activeSlide.risks.map((risk) => `老师追问：${risk}`))}</ul>`,
    },
  ];
  const applyQuickAction = useCallback((action: (typeof quickActions)[number]) => {
    setAiSuggestion(action.prompt);
    if (action.replace) {
      editorRef.current?.replaceContent(action.snippet);
      return;
    }
    editorRef.current?.appendContent(action.snippet);
  }, []);
  const handleOneClickRewrite = useCallback(() => {
    const request = rewriteRequest.trim();
    const requestCopy = request ? `按照“${request}”的要求，` : "";
    setAiSuggestion(`${requestCopy}已生成一段更适合答辩现场的版本，并补上证据来源。`);
    editorRef.current?.appendContent(`
      <p>${requestCopy}我会把这一页讲成“问题、流程、证据、价值”四步：先说明它解决什么问题，再讲清订单如何流转，最后用 ${escapeHtml(activeSlide.evidence[0] ?? "PPT 证据")} 作为依据收住。</p>
    `);
  }, [activeSlide.evidence, rewriteRequest]);
  const selectSlide = useCallback((index: number) => {
    startTransition(() => setActiveSlideIndex(index));
  }, []);
  const resetFilmstripScroll = useCallback(() => {
    const viewport = filmstripRef.current?.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (viewport) {
      viewport.scrollTo({ left: 0, behavior: "auto" });
      viewport.scrollLeft = 0;
    }
  }, []);
  const scheduleFilmstripReset = useCallback(() => {
    resetFilmstripScroll();
    requestAnimationFrame(resetFilmstripScroll);
    window.setTimeout(resetFilmstripScroll, 120);
    window.setTimeout(resetFilmstripScroll, 360);
  }, [resetFilmstripScroll]);
  const handleFilmstripWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const viewport = event.currentTarget.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) return;

    viewport.scrollLeft += event.deltaY;
  }, []);
  const handleScriptsAiResize = useCallback((panelSize: PanelSize) => {
    const shouldCollapse = Boolean(scriptsAiPanelRef.current?.isCollapsed()) || panelSize.inPixels <= scriptsAiCollapsedThreshold;
    setIsScriptsAiCollapsed((current) => current === shouldCollapse ? current : shouldCollapse);
  }, [scriptsAiCollapsedThreshold]);
  const collapseScriptsAiPanel = useCallback(() => {
    scriptsAiPanelRef.current?.collapse();
    setIsScriptsAiCollapsed(true);
  }, []);
  const handleScriptsGalleryResize = useCallback((panelSize: PanelSize) => {
    const shouldCollapse = panelSize.inPixels <= DEFENSE_GALLERY_COLLAPSED_THRESHOLD;
    setIsScriptsGalleryCollapsed((current) => current === shouldCollapse ? current : shouldCollapse);
  }, []);

  useLayoutEffect(() => {
    scheduleFilmstripReset();
  }, [activeSlideIndex, scheduleFilmstripReset]);

  useEffect(() => {
    scheduleFilmstripReset();
  }, [scheduleFilmstripReset]);

  return (
    <div className="presento-scripts-workbench">
      <ResizablePanelGroup
        className="presento-scripts-resizable presento-scripts-resizable-root"
        orientation="vertical"
      >
        <ResizablePanel defaultSize="78%" minSize="56%">
          <ResizablePanelGroup
            className="presento-scripts-upper-resizable"
            orientation={isNarrowLayout ? "vertical" : "horizontal"}
          >
            <ResizablePanel defaultSize={isNarrowLayout ? "62%" : "72%"} minSize={isNarrowLayout ? "42%" : "52%"}>
              <main className="presento-scripts-main">
                <Tabs
                  className="presento-scripts-version-tabs"
                  onValueChange={(value) => setScriptVersion(value as ScriptVersion)}
                  value={scriptVersion}
                >
                  <TabsList aria-label="讲稿版本" className="presento-scripts-version-tabs-list">
                    {scriptVersions.map((version) => (
                      <TabsTrigger
                        className="presento-scripts-version-tab"
                        key={version.id}
                        onFocus={() => setScriptVersion(version.id)}
                        onMouseDownCapture={() => setScriptVersion(version.id)}
                        onPointerDownCapture={() => setScriptVersion(version.id)}
                        onClick={() => setScriptVersion(version.id)}
                        value={version.id}
                      >
                        <strong>{version.label}</strong>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <RichScriptEditor
                  className="presento-scripts-editor"
                  initialContent={editorContent}
                  key={`${activeSlide.page}-${scriptVersion}`}
                  minHeight={390}
                  ref={editorRef}
                  showFooterMeta={false}
                  statusLabel={`${scriptVersions.find((version) => version.id === scriptVersion)?.label ?? "完整版"} · 本地草稿`}
                  variant="script"
                />
              </main>
            </ResizablePanel>
            <ResizableHandle className="presento-defense-resize-handle presento-scripts-resize-handle" withHandle />
            <ResizablePanel
              collapsedSize={scriptsAiCollapsedSize}
              collapsible
              defaultSize={isNarrowLayout ? "38%" : "28%"}
              minSize={isNarrowLayout ? "28%" : "22%"}
              onResize={handleScriptsAiResize}
              panelRef={scriptsAiPanelRef}
            >
              <div className="presento-scripts-ai-shell">
                <AnimatePresence initial={false} mode="wait">
                  {isScriptsAiCollapsed ? null : (
                    <motion.aside className="presento-defense-ai-pane presento-scripts-ai" key="scripts-ai-panel" {...scriptsAiPanelMotion}>
                      <header className="presento-defense-ai-header presento-scripts-ai-header">
                        <span className="presento-defense-ai-icon presento-scripts-ai-icon">
                          <Sparkles aria-hidden="true" />
                        </span>
                        <div className="presento-scripts-ai-heading">
                          <h2>AI 改稿助手</h2>
                          <p>基于演讲场景优化你的讲稿表达</p>
                        </div>
                        <button
                          aria-label="收起 AI 改稿助手"
                          className="presento-scripts-ai-collapse"
                          onClick={collapseScriptsAiPanel}
                          type="button"
                        >
                          <ChevronRight aria-hidden="true" />
                        </button>
                      </header>

                      <section className="presento-defense-ai-question presento-scripts-ai-suggestion">
                        <span>当前建议</span>
                        <p>{aiSuggestion}</p>
                      </section>

                      <label className="presento-defense-console presento-defense-console-ai presento-scripts-ai-request">
                        <span>告诉 AI 你的改稿需求</span>
                        <Textarea
                          maxLength={200}
                          onChange={(event) => setRewriteRequest(event.target.value)}
                          placeholder="输入你的改稿需求，例如：更像答辩口语 / 压缩到 30 秒 / 更有逻辑性..."
                          value={rewriteRequest}
                        />
                        <small>{rewriteRequest.length}/200</small>
                      </label>

                      <Button className="presento-defense-submit-button presento-scripts-ai-primary" onClick={handleOneClickRewrite} type="button">
                        <Sparkles data-icon="inline-start" aria-hidden="true" />
                        一键改稿
                      </Button>

                      <section className="presento-defense-ai-actions presento-scripts-ai-actions">
                        <span>快速优化</span>
                        <div>
                          {quickActions.map((action) => (
                            <Button key={action.label} onClick={() => applyQuickAction(action)} type="button" variant="outline">
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </section>

                      <section className="presento-defense-evidence presento-scripts-ai-evidence">
                        <span>高危追问</span>
                        <QuestionList items={activeSlide.risks} />
                        <Button asChild className="rounded-xl bg-[var(--presento-navy)] font-black text-white">
                          <Link href="/projects/demo/defense">
                            <Mic data-icon="inline-start" aria-hidden="true" />
                            用这一页开练
                          </Link>
                        </Button>
                      </section>
                    </motion.aside>
                  )}
                </AnimatePresence>
              </div>
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
                      {demoDefenseSlides.map((slide, index) => (
                        <Button
                          aria-pressed={index === activeSlideIndex}
                          className={cn("presento-defense-thumbnail", index === activeSlideIndex && "presento-defense-thumbnail-active")}
                          key={`${slide.page}-${slide.title}`}
                          onClick={() => selectSlide(index)}
                          type="button"
                          variant="ghost"
                        >
                          <Image
                            alt=""
                            aria-hidden="true"
                            className="presento-defense-thumbnail-image"
                            height={108}
                            src={slide.image}
                            unoptimized
                            width={192}
                          />
                          <span className="presento-defense-thumbnail-label">
                            {slide.page} · {slide.title}
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

function DefenseRoom() {
  const isNarrowLayout = useIsNarrowDefenseLayout();
  const [activeSlideIndex, setActiveSlideIndex] = useState(1);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
  const galleryShellRef = useRef<HTMLElement | null>(null);
  const activeSlide = demoDefenseSlides[activeSlideIndex] ?? demoDefenseSlides[1] ?? demoDefenseSlides[0];
  const activeRisks = activeSlide.risks.slice(0, 3);
  const coachTurns = [
    {
      speaker: "AI 老师",
      content: `你正在讲第 ${activeSlide.page} 页「${activeSlide.title}」。${activeRisks[0] ?? "先讲清这一页和项目主线的关系。"}`,
    },
    {
      speaker: "我",
      content: activeSlide.speakerNote,
    },
    {
      speaker: "AI 老师",
      content: activeRisks[1] ?? "请补充这一页对应的资料证据和个人负责范围。",
    },
  ];
  const selectSlide = useCallback((index: number) => {
    startTransition(() => setActiveSlideIndex(index));
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
    if (!isGalleryCollapsed) resetGalleryScroll();
  }, [activeSlideIndex, isGalleryCollapsed, resetGalleryScroll]);

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
                  className="presento-defense-slide"
                  initial={{ opacity: 0.86, y: 10 }}
                  key={activeSlide.page}
                  style={{ "--defense-slide-accent": activeSlide.accent } as CSSProperties}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="presento-defense-slide-kicker">
                    <span>Slide {activeSlide.page}</span>
                    <span>{activeSlide.status}</span>
                  </div>
                  <div className="presento-defense-slide-grid">
                    <div className="presento-defense-slide-copy">
                      <h2>{activeSlide.title}</h2>
                      <p>{activeSlide.summary}</p>
                      <div className="presento-defense-keywords">
                        {activeSlide.keywords.map((keyword) => (
                          <Badge className="presento-room-badge-green" key={keyword}>{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="presento-defense-slide-metric">
                      <span>建议讲述</span>
                      <strong>{activeSlide.stat}</strong>
                      <small>{activeSlide.duration} · {activeSlide.status}</small>
                    </div>
                  </div>
                  <div className="presento-defense-module-strip">
                    {activeSlide.modules.map((module) => (
                      <span className="presento-defense-module-item" key={module}>
                        <Sparkles aria-hidden="true" />
                        <span>{module}</span>
                      </span>
                    ))}
                  </div>
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
                    <span>AI 老师</span>
                    <h2>围绕当前页连续追问</h2>
                  </div>
                </header>

                <section className="presento-defense-ai-question">
                  <span>当前追问</span>
                  <strong>{activeRisks[0] ?? "先用 30 秒说清这一页。"}</strong>
                  <p>回答时尽量绑定 PPT 页、代码路径、数据表和你的个人负责范围。</p>
                </section>

                <ScrollArea className="presento-defense-ai-scroll">
                  <div className="presento-defense-message-list">
                    {coachTurns.map((turn) => (
                      <div className={cn("presento-defense-message", turn.speaker === "我" && "presento-defense-message-user")} key={`${activeSlide.page}-${turn.speaker}-${turn.content}`}>
                        <strong>{turn.speaker}</strong>
                        <span>{turn.content}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <section className="presento-defense-console presento-defense-console-ai">
                  <Button className="presento-defense-mic-button" size="icon">
                    <Mic aria-label="开始录音" />
                  </Button>
                  <Textarea className="presento-defense-answer-input" placeholder="输入回答文本，或作为语音训练兜底..." />
                  <Button className="presento-defense-submit-button">
                    <Play data-icon="inline-start" aria-hidden="true" />
                    我讲完了
                  </Button>
                </section>

                <Separator className="bg-[var(--presento-border)]" />

                <div className="presento-defense-ai-actions">
                  <Button className="rounded-xl font-black" variant="outline">给我关键词</Button>
                  <Button className="rounded-xl font-black" variant="outline">生成回答框架</Button>
                  <Button asChild className="rounded-xl font-black" variant="outline">
                    <Link href="/projects/demo/deep-dive">卡住了，进入钻研</Link>
                  </Button>
                </div>

                <section className="presento-defense-evidence">
                  <span>证据来源</span>
                  <div>
                    {activeSlide.evidence.map((item) => (
                      <Badge className="presento-room-badge-muted" key={item}>{item}</Badge>
                    ))}
                  </div>
                </section>
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
                      {demoDefenseSlides.map((slide, index) => (
                        <Button
                          aria-pressed={index === activeSlideIndex}
                          className={cn("presento-defense-thumbnail", index === activeSlideIndex && "presento-defense-thumbnail-active")}
                          key={`${slide.page}-${slide.title}`}
                          onClick={() => selectSlide(index)}
                          type="button"
                          variant="ghost"
                        >
                          <Image
                            alt=""
                            aria-hidden="true"
                            className="presento-defense-thumbnail-image"
                            height={108}
                            src={slide.image}
                            unoptimized
                            width={192}
                          />
                          <span className="presento-defense-thumbnail-label">
                            {slide.page} · {slide.title}
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
      <RoomCard className="lg:col-span-2" icon={<FileText aria-hidden="true" />} title="复盘报告编辑器" description="可继续编辑、收藏或导出为下一轮训练材料。">
        <RichScriptEditor
          initialContent={buildReviewReportContent()}
          minHeight={300}
          placeholder="整理这一轮模拟答辩后的薄弱点和下一步训练重点..."
          showScriptTools={false}
          statusLabel="复盘报告 · 本地草稿"
          variant="review"
        />
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
        <RichScriptEditor
          initialContent={buildDeepDiveAnswerContent()}
          minHeight={230}
          placeholder="把 AI 推荐回答改成你自己的答辩表达..."
          statusLabel="推荐回答 · 本地草稿"
          variant="answer"
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
  const containerRef = useRef<HTMLDivElement>(null);
  const weiyunRef = useRef<HTMLDivElement>(null);
  const inputDocsRef = useRef<HTMLDivElement>(null);
  const inputQqRef = useRef<HTMLDivElement>(null);
  const presentoRef = useRef<HTMLDivElement>(null);
  const qqRef = useRef<HTMLDivElement>(null);
  const outputDocsRef = useRef<HTMLDivElement>(null);
  const tencentVideoRef = useRef<HTMLDivElement>(null);

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
