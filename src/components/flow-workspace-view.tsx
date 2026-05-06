"use client";

import {
  Bot,
  ChevronDown,
  FileQuestion,
  MessageSquareText,
  Mic,
  Play,
  Radio,
  Search,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
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
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
import { ProjectUploadWorkspace } from "@/components/project-upload-workspace";
import { DefenseSessionRoom } from "@/components/defense-session-room";
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
  flowOverviewRoute,
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
  fetchProjectOverview,
  fetchProjectSkillInvocations,
  fetchProjectSkillPacks,
  fetchProjectSlides,
  fetchSkillCatalog,
  fetchSkillPackCatalog,
  fetchSlideScriptDraft,
  runSlideAssistantAction,
  saveSlideScriptDraft,
  type ProjectSlide,
  type ProjectSlideDeck,
  type RealtimeSeedQuestion,
  type SlideAssistantInsertResult,
  type SlideAssistantOverview,
  type SlideScriptVersion,
  type SkillCatalogItem,
  type SkillInvocationItem,
  type SkillPackCatalogItem,
  type SkillPackItem,
} from "@/lib/project-data-api";
import type { ProjectOverviewDto } from "@/lib/project-overview";
import {
  mergeSlideDrillQuestionList,
  normalizeSlideDrillQuestionText,
} from "@/lib/slide-drill-chat-ui";
import {
  getSlideDrillMessageSuggestedQuestions,
  getSlideDrillMessageText,
  useSlideDrillChat,
} from "@/lib/use-slide-drill-chat";
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
  const projectOverview = useProjectOverview(projectId);
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
      startTransition(() => pushFlowHistory(flowOverviewRoute(projectId)));
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
              overview={projectOverview.data}
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
              overview={projectOverview.data}
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
  overview,
}: {
  behavior: FlowBackgroundCopyBehavior;
  exiting: boolean;
  overview?: ProjectOverviewDto | null;
}) {
  const animationMode = getFlowBackgroundCopyAnimationMode({ behavior, exiting });
  const fadeDurationSeconds = BACKGROUND_COPY_FADE_MS / 1000;
  const timedDurationSeconds = (BACKGROUND_COPY_VISIBLE_MS + BACKGROUND_COPY_FADE_MS) / 1000;
  const copy = getOverviewBackgroundCopy(overview);

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
            <span className="presento-flow-background-copy-base">{copy.primaryBase}</span>
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-red presento-flow-background-copy-accent-primary">
              {copy.primaryAccent}
            </span>
          </span>
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-base">{copy.primaryBase}</span>
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-red presento-flow-background-copy-accent-primary">
              {copy.primaryAccent}
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
              {copy.secondaryAccent}
            </span>
            <span className="presento-flow-background-copy-base presento-flow-background-copy-base-complete">
              {copy.secondaryBase}
            </span>
          </span>
          <span className="presento-flow-background-copy-label">
            <span className="presento-flow-background-copy-accent presento-flow-background-copy-accent-lime presento-flow-background-copy-accent-secondary presento-flow-background-copy-accent-leading">
              {copy.secondaryAccent}
            </span>
            <span className="presento-flow-background-copy-base presento-flow-background-copy-base-complete">
              {copy.secondaryBase}
            </span>
          </span>
        </ScrollVelocityRow>
      </ScrollVelocityContainer>
    </motion.div>
  );
}

function getOverviewBackgroundCopy(overview?: ProjectOverviewDto | null) {
  if (!overview) {
    return {
      primaryBase: "剩余",
      primaryAccent: "--",
      secondaryAccent: "0%",
      secondaryBase: "已完成",
    };
  }

  const deadlineCopy = splitDeadlineCopy(overview.deadline.label);

  return {
    primaryBase: deadlineCopy.base,
    primaryAccent: deadlineCopy.accent,
    secondaryAccent: `${overview.overallPercent}%`,
    secondaryBase: "已完成",
  };
}

function splitDeadlineCopy(label: string) {
  const normalized = label.replace(/\s+/g, " ").trim();
  const match = /^(剩余|已逾期)\s+(.+)$/.exec(normalized);
  if (match) {
    return {
      base: match[1] ?? "",
      accent: match[2] ?? "",
    };
  }

  return {
    base: "",
    accent: normalized || "--",
  };
}

function FlowWorkspaceCanvas({
  activeId,
  initialViewport,
  instantCameraFocusKey,
  mode,
  onEnterStep,
  onFlowInit,
  overview,
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
  overview?: ProjectOverviewDto | null;
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
        ...decorateFlowStepNodeData(node.data, overview),
        mode,
      },
    }));
  }, [flow.nodes, mode, overview]);
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

function decorateFlowStepNodeData(
  data: FlowWorkspaceNodeData,
  overview?: ProjectOverviewDto | null,
): FlowWorkspaceNodeData {
  if (!overview) return data;

  const counts = overview.counts;
  const slideTotal = counts.slideCount;
  const hasSlides = slideTotal > 0;
  const allScriptsDone = hasSlides && counts.scriptCompletedSlideCount >= slideTotal;
  const allPracticeDone = hasSlides && counts.practiceCompletedSlideCount >= slideTotal;
  const review = overview.latestReview;

  const byStep: Partial<Record<FlowStepId, Partial<FlowWorkspaceNodeData>>> = {
    files: {
      metrics: [`${counts.fileCount} 份资料`, `${slideTotal} 页 PPT`, overview.deadline.label],
      stateLine: counts.fileCount > 0 ? "真实项目资料已入库" : "等待上传项目资料",
      status: counts.fileCount > 0 ? "completed" : "pending",
    },
    knowledge: {
      metrics: [
        `${counts.knowledgeNodeCount} 个节点`,
        `${counts.fileCount} 份资料`,
        counts.knowledgeNodeCount > 0 ? "可追问" : "生成中",
      ],
      stateLine: counts.knowledgeNodeCount > 0 ? "知识地图已从真实资料生成" : "等待资料解析生成知识节点",
      status: counts.knowledgeNodeCount > 0 ? "active" : "pending",
    },
    scripts: {
      metrics: hasSlides
        ? [`${counts.scriptCompletedSlideCount}/${slideTotal} 页完成`, "讲稿草稿", "按页推进"]
        : ["等待 PPT 解析", "讲稿草稿", "按页推进"],
      progress: hasSlides
        ? { label: "逐页讲解", total: slideTotal, value: counts.scriptCompletedSlideCount }
        : null,
      stateLine: hasSlides ? `逐页讲解完成 ${counts.scriptCompletedSlideCount}/${slideTotal}` : "解析出 PPT 页后开始写讲稿",
      status: allScriptsDone ? "completed" : counts.scriptCompletedSlideCount > 0 ? "active" : "pending",
    },
    defense: {
      metrics: hasSlides
        ? [`${counts.practiceCompletedSlideCount}/${slideTotal} 页讲练`, `${counts.trainingSessionCount} 次训练`, "实时追问"]
        : ["等待 PPT 解析", `${counts.trainingSessionCount} 次训练`, "实时追问"],
      progress: hasSlides
        ? { label: "模拟讲练", total: slideTotal, value: counts.practiceCompletedSlideCount }
        : null,
      stateLine: hasSlides ? `模拟讲练完成 ${counts.practiceCompletedSlideCount}/${slideTotal}` : "解析出 PPT 页后开始讲练",
      status: allPracticeDone ? "completed" : counts.practiceCompletedSlideCount > 0 ? "risk" : "pending",
    },
    review: {
      metrics: review ? [`${review.averageScore} 分`, review.scoreLabel, "下一轮任务"] : ["暂无复盘", `${counts.trainingSessionCount} 次训练`, "下一轮任务"],
      stateLine: review ? "已读取最近一次真实复盘报告" : "完成一次讲练后生成复盘",
      status: review ? "completed" : "pending",
    },
    deepDive: {
      metrics: [`${counts.weaknessCount} 个薄弱点`, `${counts.deepDiveCount} 份补强`, "引用证据"],
      stateLine: counts.weaknessCount > 0 ? "从真实薄弱点进入补强" : "复盘后沉淀薄弱点",
      status: counts.weaknessCount > 0 ? "weakness" : "pending",
    },
    pcg: {
      metrics: [`${counts.contentExportCount} 个输出`, "QQ 摘要", "展示脚本"],
      stateLine: counts.contentExportCount > 0 ? "已生成真实内容输出" : "等待复盘或讲稿后输出",
      status: counts.contentExportCount > 0 ? "output" : "pending",
    },
    skills: {
      metrics: ["技能包", "调用记录", "反馈闭环"],
      stateLine: "读取项目技能配置",
    },
  };

  const patch = byStep[data.id] ?? {};
  return {
    ...data,
    ...patch,
    status: data.active ? data.status : patch.status ?? data.status,
  };
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
        {data.progress ? (
          <div className="presento-flow-node-progress" aria-label={data.progress.label}>
            <div className="flex items-center justify-between gap-3 text-[12px] font-black text-[var(--presento-faint)]">
              <span>{data.progress.label}</span>
              <span>
                {data.progress.value}/{data.progress.total}
              </span>
            </div>
            <Progress
              className="mt-2 h-2 bg-[var(--presento-border)] [&>div]:bg-[var(--presento-blue)]"
              value={data.progress.total > 0 ? (data.progress.value / data.progress.total) * 100 : 0}
            />
          </div>
        ) : null}
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
  if (stepId === "defense") return <DefenseSessionRoom projectId={projectId} />;
  if (stepId === "review") return <ReviewRoom />;
  if (stepId === "deepDive") return <DeepDiveRoom />;
  if (stepId === "skills") return <SkillsRoom projectId={projectId} />;
  return <PCGRoom />;
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

type ScriptVersion = SlideScriptVersion;

const scriptVersions: { id: ScriptVersion; label: string }[] = [
  { id: "normal", label: "完整稿" },
  { id: "short", label: "30 秒稿" },
  { id: "keywords", label: "提词稿" },
];

type ScriptRewriteActionId = "conversational" | "specific" | "contribution" | "transition";

const SCRIPTS_ROOM_PREFS_STORAGE_PREFIX = "presento:scripts-room";
const DRILL_SEED_STORAGE_PREFIX = "presento:queued-drill-questions:";

function createClientDrillMeta(prefix: "m" | "q") {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    createdAt: new Date().toISOString(),
    id: `${prefix}-${id}`,
  };
}

function drillSeedStorageKey(projectId: string) {
  return `${DRILL_SEED_STORAGE_PREFIX}${projectId}`;
}

function readQueuedDrillSeeds(projectId: string): RealtimeSeedQuestion[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(drillSeedStorageKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RealtimeSeedQuestion[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) =>
      item
      && typeof item.slideId === "string"
      && typeof item.text === "string"
      && (item.source === "ai" || item.source === "user")
    );
  } catch {
    return [];
  }
}

function writeQueuedDrillSeeds(projectId: string, questions: RealtimeSeedQuestion[]) {
  if (typeof window === "undefined") return;
  const seen = new Set<string>();
  const next = questions.filter((question) => {
    const key = `${question.slideId}:${normalizeSlideDrillQuestionText(question.text)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (next.length) {
    window.localStorage.setItem(drillSeedStorageKey(projectId), JSON.stringify(next));
  } else {
    window.localStorage.removeItem(drillSeedStorageKey(projectId));
  }
}

function mergeQueuedDrillSeeds(projectId: string, questions: RealtimeSeedQuestion[]) {
  writeQueuedDrillSeeds(projectId, [...readQueuedDrillSeeds(projectId), ...questions]);
}

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

function scriptsRoomPrefsStorageKey(projectId: string) {
  return `${SCRIPTS_ROOM_PREFS_STORAGE_PREFIX}:${projectId}`;
}

function readScriptsRoomPrefs(projectId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(scriptsRoomPrefsStorageKey(projectId));
    if (!raw) return null;
    const prefs = JSON.parse(raw) as {
      scriptVersion?: string;
      selectedSlideId?: string;
    };
    return {
      scriptVersion: scriptVersions.some((version) => version.id === prefs.scriptVersion)
        ? prefs.scriptVersion as ScriptVersion
        : null,
      selectedSlideId: typeof prefs.selectedSlideId === "string" ? prefs.selectedSlideId : null,
    };
  } catch {
    return null;
  }
}

function writeScriptsRoomPrefs(projectId: string, prefs: {
  scriptVersion: ScriptVersion;
  selectedSlideId: string | null;
}) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scriptsRoomPrefsStorageKey(projectId), JSON.stringify(prefs));
}

function ScriptsRoom({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useProjectSlides(projectId);
  const slides = data?.slides ?? emptyProjectSlides;
  const initialPrefs = useMemo(() => readScriptsRoomPrefs(projectId), [projectId]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(() => initialPrefs?.selectedSlideId ?? null);
  const [scriptVersion, setScriptVersion] = useState<ScriptVersion>(() => initialPrefs?.scriptVersion ?? "normal");
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [draftStatus, setDraftStatus] = useState<"empty" | "generating" | "ready">("empty");
  const [draftRevision, setDraftRevision] = useState(0);
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isScriptsGalleryCollapsed, setIsScriptsGalleryCollapsed] = useState(false);
  const [rewriteSelection, setRewriteSelection] = useState<{
    instruction: string;
    isSubmitting: boolean;
    selectedText: string;
    x: number;
    y: number;
  } | null>(null);
  const scriptEditorRef = useRef<RichScriptEditorHandle | null>(null);
  const filmstripRef = useRef<HTMLElement | null>(null);
  const activeSlide = slides.find((slide) => slide.id === selectedSlideId) ?? slides[0] ?? null;
  const editorContent = draftContent ?? "";
  const draftKey = activeSlide ? `${projectId}:${activeSlide.id}:${scriptVersion}` : "";
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftSaveRef = useRef<{
    contentHtml: string;
    projectId: string;
    slideId: string;
    version: ScriptVersion;
  } | null>(null);
  const latestDraftRef = useRef({
    contentHtml: "",
    isLoading: false,
    key: "",
  });
  const selectSlide = useCallback((slideId: string) => {
    startTransition(() => setSelectedSlideId(slideId));
  }, []);
  const selectScriptVersion = useCallback((version: ScriptVersion) => {
    startTransition(() => setScriptVersion(version));
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
  const flushPendingDraftSave = useCallback(() => {
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    const pending = pendingDraftSaveRef.current;
    if (!pending) return;
    pendingDraftSaveRef.current = null;
    void saveSlideScriptDraft(pending.projectId, pending.slideId, {
      contentHtml: pending.contentHtml,
      version: pending.version,
    })
      .then(() => setDraftError(""))
      .catch((nextError) => {
        setDraftError(nextError instanceof Error ? nextError.message : "讲稿草稿保存失败");
      });
  }, []);
  const handleEditorContentChange = useCallback((contentHtml: string) => {
    latestDraftRef.current.contentHtml = contentHtml;
    if (!activeSlide || latestDraftRef.current.isLoading) return;
    if (draftStatus !== "ready") return;
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    const slideId = activeSlide.id;
    const version = scriptVersion;
    pendingDraftSaveRef.current = { contentHtml, projectId, slideId, version };
    draftSaveTimerRef.current = setTimeout(() => {
      flushPendingDraftSave();
    }, 700);
  }, [activeSlide, draftStatus, flushPendingDraftSave, projectId, scriptVersion]);
  const handleRewriteSelectionRequest = useCallback((selection: {
    selectedText: string;
    x: number;
    y: number;
  }) => {
    const maxX = typeof window === "undefined" ? selection.x : Math.max(16, window.innerWidth - 392);
    const maxY = typeof window === "undefined" ? selection.y : Math.max(16, window.innerHeight - 220);
    setRewriteSelection({
      ...selection,
      x: Math.min(Math.max(16, selection.x), maxX),
      y: Math.min(Math.max(16, selection.y), maxY),
      instruction: "",
      isSubmitting: false,
    });
  }, []);
  const closeRewritePopover = useCallback(() => {
    scriptEditorRef.current?.clearRewriteSelection();
    setRewriteSelection(null);
  }, []);
  const generateCurrentDraft = useCallback(async (slide: ProjectSlide, version: ScriptVersion) => {
    setDraftError("");
    setDraftStatus("generating");
    latestDraftRef.current.isLoading = true;
    try {
      const response = await runSlideAssistantAction(projectId, slide.id, { action: "overview" });
      if (response.usedFallback) {
        setDraftContent(null);
        setDraftError("AI 讲稿暂时没有生成成功，请稍后重试。");
        setDraftStatus("empty");
        return;
      }
      const contentHtml = buildAiScriptDraftHtml(response.result as SlideAssistantOverview, version);
      await saveSlideScriptDraft(projectId, slide.id, { contentHtml, version });
      setDraftContent(contentHtml);
      setDraftStatus("ready");
    } catch (nextError) {
      setDraftContent(null);
      setDraftError(nextError instanceof Error ? nextError.message : "AI 讲稿生成失败");
      setDraftStatus("empty");
    } finally {
      latestDraftRef.current.isLoading = false;
      setIsDraftLoading(false);
      setDraftRevision((current) => current + 1);
    }
  }, [projectId]);
  const submitSelectionRewrite = useCallback(async () => {
    if (!activeSlide || !rewriteSelection || rewriteSelection.isSubmitting) return;
    const instruction = rewriteSelection.instruction.trim();
    if (!instruction) return;
    setRewriteSelection((current) => current ? { ...current, isSubmitting: true } : current);
    try {
      const response = await runSlideAssistantAction(projectId, activeSlide.id, {
        action: "rewrite",
        instruction,
        selectedText: rewriteSelection.selectedText,
        currentDraft: scriptEditorRef.current?.getHTML(),
      });
      const result = response.result as SlideAssistantInsertResult;
      if (result.content.trim()) {
        scriptEditorRef.current?.replaceSelection(result.content);
      }
      setRewriteSelection(null);
    } catch {
      setRewriteSelection((current) => current ? { ...current, isSubmitting: false } : current);
    }
  }, [activeSlide, projectId, rewriteSelection]);

  useLayoutEffect(() => {
    if (activeSlide && !isScriptsGalleryCollapsed) resetFilmstripScroll();
  }, [activeSlide, isScriptsGalleryCollapsed, resetFilmstripScroll]);

  useEffect(() => {
    latestDraftRef.current = {
      contentHtml: editorContent,
      isLoading: isDraftLoading,
      key: draftKey,
    };
  }, [draftKey, editorContent, isDraftLoading]);

  useEffect(() => {
    writeScriptsRoomPrefs(projectId, {
      scriptVersion,
      selectedSlideId: activeSlide?.id ?? null,
    });
  }, [activeSlide, projectId, scriptVersion]);

  useEffect(() => {
    if (!activeSlide) return undefined;
    let cancelled = false;
    flushPendingDraftSave();
    latestDraftRef.current.isLoading = true;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setDraftError("");
        setDraftContent(null);
        setDraftStatus("generating");
        setIsDraftLoading(true);
        return fetchSlideScriptDraft(projectId, activeSlide.id, scriptVersion);
      })
      .then((response) => {
        if (cancelled || !response) return;
        if (response.draft?.contentHtml) {
          setDraftContent(response.draft.contentHtml);
          setDraftStatus("ready");
          return;
        }
        void generateCurrentDraft(activeSlide, scriptVersion);
      })
      .catch((nextError) => {
        if (cancelled) return;
        setDraftContent(null);
        setDraftError(nextError instanceof Error ? nextError.message : "讲稿草稿读取失败");
        setDraftStatus("empty");
      })
      .finally(() => {
        if (cancelled) return;
        latestDraftRef.current.isLoading = false;
        setIsDraftLoading(false);
        setDraftRevision((current) => current + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSlide, flushPendingDraftSave, generateCurrentDraft, projectId, scriptVersion]);

  useEffect(() => () => {
    flushPendingDraftSave();
  }, [flushPendingDraftSave]);

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
                  onValueChange={(value) => selectScriptVersion(value as ScriptVersion)}
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
                {draftStatus === "ready" ? (
                  <RichScriptEditor
                    className="presento-scripts-editor"
                    initialContent={editorContent}
                    key={`${activeSlide.id}-${scriptVersion}-${draftRevision}`}
                    minHeight={390}
                    onContentChange={handleEditorContentChange}
                    onRewriteSelectionRequest={handleRewriteSelectionRequest}
                    ref={scriptEditorRef}
                    showFooterMeta={false}
                    statusLabel={`${scriptVersions.find((version) => version.id === scriptVersion)?.label ?? "完整稿"} · 当前项目`}
                    variant="script"
                  />
                ) : draftStatus === "generating" ? (
                  <ScriptDraftSkeleton />
                ) : (
                  <div className="presento-scripts-empty-draft">
                    <FileQuestion aria-hidden="true" />
                    <h2>暂无 AI 讲稿</h2>
                    <p>这页还没有可用的 AI 讲稿。模型生成成功后才会显示编辑器。</p>
                    <Button onClick={() => void generateCurrentDraft(activeSlide, scriptVersion)} type="button">
                      重新生成
                    </Button>
                  </div>
                )}
              </main>
            </ResizablePanel>
            <ResizableHandle className="presento-defense-resize-handle presento-scripts-side-resize-handle" withHandle />
            <ResizablePanel defaultSize="26%" minSize="260px">
              {draftError ? (
                <p className="presento-scripts-ai-error presento-scripts-draft-error">{draftError}</p>
              ) : null}
              <ScriptAssistantPanel
                editorRef={scriptEditorRef}
                projectId={projectId}
                slide={activeSlide}
              />
              <Popover open={Boolean(rewriteSelection)} onOpenChange={(open) => !open && closeRewritePopover()}>
                {rewriteSelection ? (
                  <PopoverAnchor asChild>
                    <span
                      aria-hidden="true"
                      className="presento-scripts-rewrite-anchor"
                      style={{ left: rewriteSelection.x, top: rewriteSelection.y }}
                    />
                  </PopoverAnchor>
                ) : null}
                <PopoverContent
                  align="start"
                  className="presento-scripts-rewrite-popover"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                  side="bottom"
                  sideOffset={0}
                >
                  {rewriteSelection ? (
                    <>
                      <Input
                        autoFocus
                        className="presento-scripts-rewrite-input"
                        disabled={rewriteSelection.isSubmitting}
                        onChange={(event) => setRewriteSelection((current) => current ? { ...current, instruction: event.target.value } : current)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") closeRewritePopover();
                          if (event.key === "Enter") void submitSelectionRewrite();
                        }}
                        placeholder="例如：更口语、突出个人贡献、压缩一点"
                        value={rewriteSelection.instruction}
                      />
                      <div className="presento-scripts-rewrite-popover-actions">
                        <Button
                          disabled={rewriteSelection.isSubmitting}
                          onClick={closeRewritePopover}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          取消
                        </Button>
                        <Button
                          disabled={rewriteSelection.isSubmitting || !rewriteSelection.instruction.trim()}
                          onClick={() => void submitSelectionRewrite()}
                          size="sm"
                          type="button"
                        >
                          {rewriteSelection.isSubmitting ? "改稿中..." : "一键改稿"}
                        </Button>
                      </div>
                    </>
                  ) : null}
                </PopoverContent>
              </Popover>
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
  editorRef,
  projectId,
  slide,
}: {
  editorRef: RefObject<RichScriptEditorHandle | null>;
  projectId: string;
  slide: ProjectSlide;
}) {
  const [overview, setOverview] = useState<SlideAssistantOverview | null>(null);
  const [assistantError, setAssistantError] = useState("");
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<ScriptRewriteActionId | null>(null);
  const [isRewritingDraft, setIsRewritingDraft] = useState(false);
  const [assistantTab, setAssistantTab] = useState<"rewrite" | "drill">("rewrite");
  const getCurrentDraft = useCallback(() => editorRef.current?.getHTML(), [editorRef]);
  const isAssistantBusy = isOverviewLoading || Boolean(runningAction);
  const keywords = overview?.keywords ?? [];
  const basis = overview?.basis ?? { topics: [], materials: [] };
  const risks = useMemo(() => overview?.risks ?? [], [overview?.risks]);
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

  const initialDrillQuestions = useMemo(
    () => mergeSlideDrillQuestionList(
      [],
      risks,
      "ai",
      () => createClientDrillMeta("q"),
    ),
    [risks],
  );
  const drillChat = useSlideDrillChat({
    getCurrentDraft,
    initialQuestions: initialDrillQuestions,
    projectId,
    slideId: slide.id,
  });
  const visibleDrillQuestions = drillChat.questions.length
    ? drillChat.questions
    : initialDrillQuestions;
  const visibleDrillQuestionSet = useMemo(
    () => new Set(visibleDrillQuestions.map((question) => normalizeSlideDrillQuestionText(question.text))),
    [visibleDrillQuestions],
  );

  useEffect(() => {
    if (drillChat.status === "loading-cache") return;

    const queuedSeeds = visibleDrillQuestions
      .filter((question) => question.queuedForTraining)
      .map((question) => ({
        slideId: slide.id,
        source: question.source,
        text: question.text,
      } satisfies RealtimeSeedQuestion));
    if (!queuedSeeds.length && !drillChat.hasStoredState) return;

    const otherSeeds = readQueuedDrillSeeds(projectId).filter((item) => item.slideId !== slide.id);
    writeQueuedDrillSeeds(projectId, [...otherSeeds, ...queuedSeeds]);
  }, [drillChat.hasStoredState, drillChat.status, projectId, slide.id, visibleDrillQuestions]);

  const isDrillLoading = drillChat.status === "loading-cache";
  const isDrillAnswering = drillChat.status === "submitted" || drillChat.status === "streaming";
  const isDrillBusy = isDrillLoading || isDrillAnswering;
  const latestDrillMessage = drillChat.messages.at(-1);
  const isStreamingAnswerVisible = latestDrillMessage?.role === "assistant"
    && Boolean(getSlideDrillMessageText(latestDrillMessage));

  const runSelectionRewriteAction = useCallback(async (
    action: ScriptRewriteActionId,
    instruction: string,
  ) => {
    const selection = editorRef.current?.captureRewriteSelection();
    if (!selection) {
      setAssistantError("请先选中要改的句子。");
      return;
    }
    setRunningAction(action);
    setAssistantError("");
    try {
      const response = await runSlideAssistantAction(projectId, slide.id, {
        action: "rewrite",
        currentDraft: editorRef.current?.getHTML(),
        instruction,
        selectedText: selection.selectedText,
      });
      const result = response.result as SlideAssistantInsertResult;
      if (response.usedFallback) setAssistantError("fallback");
      if (result.content.trim()) {
        editorRef.current?.replaceSelection(result.content);
      }
    } catch (nextError) {
      setAssistantError(nextError instanceof Error ? nextError.message : "AI 动作执行失败");
    } finally {
      setRunningAction(null);
    }
  }, [editorRef, projectId, slide.id]);

  const rewriteFullDraftFromDrill = useCallback(async (sourceText: string) => {
    const currentDraft = editorRef.current?.getHTML();
    if (!currentDraft?.trim()) {
      setAssistantError("当前页还没有可改写的讲稿。");
      return;
    }
    setAssistantError("");
    setIsRewritingDraft(true);
    try {
      const response = await runSlideAssistantAction(projectId, slide.id, {
        action: "rewrite_draft",
        currentDraft,
        instruction: [
          "根据下面这段模拟讲练内容，直接改写整页完整讲稿。",
          "要求：保留原稿主线，补强答辩回答、材料依据、边界说明和个人贡献，输出可直接放入编辑器的正文。",
          sourceText,
        ].join("\n"),
      });
      const result = response.result as SlideAssistantInsertResult;
      if (response.usedFallback) setAssistantError("fallback");
      if (result.content.trim()) {
        editorRef.current?.replaceContent(wrapScriptDraftHtml(result.content));
      }
    } catch (nextError) {
      setAssistantError(nextError instanceof Error ? nextError.message : "整页讲稿改写失败");
    } finally {
      setIsRewritingDraft(false);
    }
  }, [editorRef, projectId, slide.id]);

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

          <Tabs
            className="presento-scripts-ai-tabs"
            onValueChange={(value) => setAssistantTab(value as "rewrite" | "drill")}
            value={assistantTab}
          >
            <TabsList aria-label="讲稿助手视图" className="presento-scripts-ai-tabs-list">
              <TabsTrigger className="presento-scripts-ai-tab" value="rewrite">
                文稿修改
              </TabsTrigger>
              <TabsTrigger className="presento-scripts-ai-tab" value="drill">
                情景深挖
              </TabsTrigger>
            </TabsList>

            <TabsContent className="presento-scripts-ai-tab-content" value="rewrite">
              <section className="presento-scripts-ai-block presento-scripts-ai-task">
                <span>本页任务</span>
                <p>{pageTask}</p>
              </section>

              <section className="presento-scripts-ai-block presento-scripts-ai-actions">
                <span>改稿动作</span>
                <div className="presento-scripts-ai-action-grid">
                  <Button
                    disabled={isAssistantBusy}
                    onClick={() => runSelectionRewriteAction("conversational", "把选中的句子改得更口语、更适合答辩现场表达。")}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                    variant="outline"
                  >
                    {runningAction === "conversational" ? "生成中..." : "改得更口语"}
                  </Button>
                  <Button
                    disabled={isAssistantBusy}
                    onClick={() => runSelectionRewriteAction("specific", "把选中的句子改得更具体，补充清楚对象、动作、依据和结果，避免空泛表述。")}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                    variant="outline"
                  >
                    {runningAction === "specific" ? "生成中..." : "改得具体"}
                  </Button>
                  <Button
                    disabled={isAssistantBusy}
                    onClick={() => runSelectionRewriteAction("contribution", "在选中句子的原意基础上突出我的个人贡献。")}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                    variant="outline"
                  >
                    {runningAction === "contribution" ? "生成中..." : "突出个人贡献"}
                  </Button>
                  <Button
                    disabled={isAssistantBusy}
                    onClick={() => runSelectionRewriteAction("transition", "把选中的句子改成自然的前后转场句。")}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                    variant="outline"
                  >
                    {runningAction === "transition" ? "生成中..." : "补转场句"}
                  </Button>
                </div>
              </section>

              <details className="presento-scripts-ai-block presento-scripts-ai-disclosure presento-scripts-ai-basis" open>
                <summary>
                  <span>本页依据</span>
                  <ChevronDown className="presento-scripts-ai-disclosure-icon" aria-hidden="true" />
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
            </TabsContent>

            <TabsContent className="presento-scripts-ai-tab-content" value="drill">
              <section className="presento-scripts-ai-block presento-scripts-ai-risk presento-scripts-drill-panel">
                <div className="presento-scripts-drill-heading">
                  <span>高危提问</span>
                  {isDrillLoading ? <small>读取中</small> : <small>{visibleDrillQuestions.length} 个问题</small>}
                </div>
                <ScrollArea className="presento-scripts-ai-risk-scroll">
                  <div className="presento-scripts-ai-risk-list">
                    {isDrillLoading ? (
                      <>
                        <Skeleton className="presento-scripts-drill-question-skeleton" />
                        <Skeleton className="presento-scripts-drill-question-skeleton" />
                      </>
                    ) : visibleDrillQuestions.length ? visibleDrillQuestions.map((question) => (
                      <div className="presento-scripts-drill-question-row" key={question.id}>
                        <button
                          className="presento-scripts-drill-question"
                          disabled={isDrillBusy}
                          onClick={() => void drillChat.submit(question.text)}
                          type="button"
                        >
                          {question.text}
                        </button>
                        <Button
                          disabled={isDrillBusy}
                          onClick={() => {
                            drillChat.toggleQuestionTraining(question.id);
                            const queued = !question.queuedForTraining;
                            if (queued) {
                              mergeQueuedDrillSeeds(projectId, [{
                                slideId: slide.id,
                                source: question.source,
                                text: question.text,
                              }]);
                            } else {
                              writeQueuedDrillSeeds(
                                projectId,
                                readQueuedDrillSeeds(projectId).filter((item) =>
                                  item.slideId !== slide.id
                                  || normalizeSlideDrillQuestionText(item.text) !== normalizeSlideDrillQuestionText(question.text)
                                ),
                              );
                            }
                          }}
                          size="sm"
                          type="button"
                          variant={question.queuedForTraining ? "default" : "outline"}
                        >
                          {question.queuedForTraining ? "已加入训练" : "加入训练"}
                        </Button>
                      </div>
                    )) : (
                      <p>{isOverviewLoading ? "正在生成高危提问..." : "暂无高危提问。"}</p>
                    )}
                  </div>
                </ScrollArea>
              </section>

              <section className="presento-scripts-drill-chat-panel">
                {drillChat.error ? (
                  <p className="presento-scripts-ai-error">{drillChat.error}</p>
                ) : null}
                <Conversation className="presento-scripts-drill-conversation">
                  {drillChat.messages.length === 0 && !isDrillAnswering ? (
                    <ConversationEmptyState
                      className="presento-scripts-drill-empty"
                      description="点击上方高危提问，或直接输入你想继续追问的问题。"
                      icon={<MessageSquareText aria-hidden="true" />}
                      title="围绕本页开始深挖"
                    />
                  ) : (
                    <ConversationContent className="presento-scripts-drill-conversation-content">
                      {drillChat.messages.map((message) => {
                        const text = getSlideDrillMessageText(message);
                        const suggestedQuestions = getSlideDrillMessageSuggestedQuestions(message);
                        const visibleSuggestedQuestions = suggestedQuestions.filter(
                          (question) => !visibleDrillQuestionSet.has(normalizeSlideDrillQuestionText(question)),
                        );
                        if (!text && suggestedQuestions.length === 0) return null;
                        return (
                          <Message from={message.role} key={message.id}>
                            <MessageContent className="presento-scripts-drill-message">
                              {text ? <MessageResponse>{text}</MessageResponse> : null}
                              <AnimatePresence initial={false}>
                                {message.role === "assistant" && visibleSuggestedQuestions.length ? (
                                  <motion.div
                                    animate={{ opacity: 1, y: 0 }}
                                    className="presento-scripts-drill-suggestions"
                                    exit={{ opacity: 0, y: -4, height: 0, marginTop: 0, paddingTop: 0 }}
                                    initial={{ opacity: 0, y: 4 }}
                                    layout
                                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                  >
                                    <span>推荐继续追问</span>
                                    <AnimatePresence initial={false}>
                                      {visibleSuggestedQuestions.map((question) => (
                                        <motion.div
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          className="presento-scripts-drill-suggestion"
                                          exit={{ opacity: 0, scale: 0.98, y: -6, height: 0, paddingTop: 0, paddingBottom: 0 }}
                                          initial={{ opacity: 0, scale: 0.98, y: 6 }}
                                          key={question}
                                          layout
                                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                          <p>{question}</p>
                                          <Button
                                            onClick={() => drillChat.addQuestion(question, "ai")}
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                          >
                                            加入高危提问
                                          </Button>
                                        </motion.div>
                                      ))}
                                    </AnimatePresence>
                                    {text ? (
                                      <Button
                                        disabled={isRewritingDraft}
                                        onClick={() => void rewriteFullDraftFromDrill(text)}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                      >
                                        {isRewritingDraft ? "改写中..." : "用这段改写整页讲稿"}
                                      </Button>
                                    ) : null}
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                              {message.role === "assistant" && !visibleSuggestedQuestions.length && text ? (
                                <Button
                                  disabled={isRewritingDraft}
                                  onClick={() => void rewriteFullDraftFromDrill(text)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {isRewritingDraft ? "改写中..." : "用这段改写整页讲稿"}
                                </Button>
                              ) : null}
                            </MessageContent>
                          </Message>
                        );
                      })}
                      {isDrillAnswering && !isStreamingAnswerVisible ? (
                        <Message from="assistant">
                          <MessageContent className="presento-scripts-drill-message">
                            <div className="presento-scripts-drill-loading">
                              <Loader className="presento-scripts-drill-loading-icon" />
                              正在生成答辩回答...
                            </div>
                          </MessageContent>
                        </Message>
                      ) : null}
                    </ConversationContent>
                  )}
                </Conversation>
                <PromptInput
                  className="presento-scripts-drill-input"
                  onSubmit={(message) => drillChat.submit(message.text)}
                >
                  <PromptInputBody>
                    <PromptInputTextarea
                      disabled={isDrillBusy}
                      onChange={(event) => drillChat.setInput(event.currentTarget.value)}
                      placeholder="继续追问本页风险"
                      value={drillChat.input}
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools aria-hidden="true" />
                    <PromptInputSubmit
                      disabled={!drillChat.input.trim() || isDrillBusy}
                      status={drillChat.status === "streaming" ? "streaming" : drillChat.status === "submitted" ? "submitted" : drillChat.error ? "error" : "ready"}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </section>
            </TabsContent>
          </Tabs>

        </div>
      </ScrollArea>
    </aside>
  );
}

function ScriptDraftSkeleton() {
  const lineWidths = ["78%", "92%", "86%", "64%", "88%", "72%"];
  return (
    <div className="presento-scripts-draft-skeleton" aria-label="正在生成 AI 讲稿">
      <Skeleton className="presento-scripts-draft-skeleton-title" />
      <div className="presento-scripts-draft-skeleton-lines">
        {lineWidths.map((width, index) => (
          <Skeleton
            className="presento-scripts-draft-skeleton-line"
            key={`${width}-${index}`}
            style={{ width }}
          />
        ))}
      </div>
      <div className="presento-scripts-draft-skeleton-block">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    </div>
  );
}

function ReviewRoom() {
  return <FeatureUnavailableState />;
}

function DeepDiveRoom() {
  return <FeatureUnavailableState />;
}

function SkillsRoom({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useProjectSkillsDashboard(projectId);
  const [query, setQuery] = useState("");

  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!data) return [];
    if (!normalizedQuery) return data.skills;
    return data.skills.filter((skill) => {
      const haystack = [
        skill.id,
        skill.name,
        skill.description,
        skill.trigger.mode,
        skill.trigger.event,
        skill.output.type,
        skill.inputSchemaName,
        skill.outputSchemaName,
        ...skill.allowedTools,
        ...skill.packIds,
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [data, query]);

  if (isLoading) {
    return <RoomState icon={<Bot aria-hidden="true" />} title="正在读取 Agent Skills" />;
  }

  if (error) {
    return <RoomState description={error} icon={<Bot aria-hidden="true" />} title="Agent Skills 读取失败" tone="error" />;
  }

  if (!data) {
    return <RoomState icon={<Bot aria-hidden="true" />} title="暂无 Agent Skills 数据" />;
  }

  const enabledPackCount = data.projectPacks.filter((pack) => pack.enabled).length;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <SkillMetric label="内置技能" value={data.skills.length} />
        <SkillMetric label="已启用技能包" value={`${enabledPackCount}/${data.projectPacks.length}`} />
        <SkillMetric label="最近调用" value={data.invocations.length} />
      </div>

      <Tabs defaultValue="packs" className="min-h-0 flex-1">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto rounded-none border-b border-[var(--presento-border)] p-0">
          <TabsTrigger className="h-10 flex-none px-3" value="packs">技能包</TabsTrigger>
          <TabsTrigger className="h-10 flex-none px-3" value="catalog">内置技能</TabsTrigger>
          <TabsTrigger className="h-10 flex-none px-3" value="runs">调用记录</TabsTrigger>
          <TabsTrigger className="h-10 flex-none px-3" value="later">暂未开放</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-3 min-h-0" value="packs">
          <div className="grid gap-3 md:grid-cols-2">
            {data.projectPacks.map((pack) => (
              <SkillPackCard
                key={pack.id ?? pack.packId ?? pack.name}
                pack={pack}
                skills={data.skills.filter((skill) => skill.packIds.includes(pack.id ?? pack.packId ?? ""))}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent className="mt-3 min-h-0" value="catalog">
          <Card className="rounded-lg border-[var(--presento-border)] bg-white/90 shadow-sm">
            <CardHeader className="gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base font-black text-[var(--presento-ink)]">内置技能</CardTitle>
                  <CardDescription>按技能名称、场景和工具查看系统能力</CardDescription>
                </div>
                <Input
                  className="h-9 max-w-sm rounded-md bg-white text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索技能、场景、工具..."
                  value={query}
                />
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[min(560px,calc(100vh-23rem))] pr-3">
                <div className="space-y-2">
                  {filteredSkills.map((skill) => (
                    <SkillCatalogRow key={skill.id} skill={skill} packs={data.projectPacks} />
                  ))}
                  {filteredSkills.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--presento-border)] p-6 text-sm font-semibold text-[var(--presento-muted)]">
                      没有匹配的 skill。
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-3 min-h-0" value="runs">
          <Card className="rounded-lg border-[var(--presento-border)] bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-black text-[var(--presento-ink)]">调用记录</CardTitle>
              <CardDescription>最近 12 次技能调用，只读查看运行状态</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[min(560px,calc(100vh-23rem))] pr-3">
                <div className="space-y-2">
                  {data.invocations.map((invocation) => (
                    <SkillInvocationRow
                      invocation={invocation}
                      key={invocation.id}
                      skills={data.skills}
                    />
                  ))}
                  {data.invocations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--presento-border)] p-6 text-sm font-semibold text-[var(--presento-muted)]">
                      暂无调用记录。完成讲稿、答辩或复盘后会出现在这里。
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-3" value="later">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["自定义技能", "用户自定义技能和权限模型尚未实现。"],
              ["导入清单", "技能清单导入链路尚未实现。"],
              ["可视化编排", "工作流编排尚未接入当前运行层。"],
              ["自主规划", "当前采用业务场景显式调用和规则推荐，暂不开放自主规划。"],
            ].map(([title, description]) => (
              <Card className="rounded-lg border-dashed border-[var(--presento-border)] bg-white/70 shadow-none" key={title}>
                <CardHeader>
                  <CardAction>
                    <Badge variant="outline" className="rounded-md text-xs">暂未开放</Badge>
                  </CardAction>
                  <CardTitle className="text-base font-black text-[var(--presento-ink)]">{title}</CardTitle>
                  <CardDescription className="font-semibold leading-6">{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useProjectSkillsDashboard(projectId: string) {
  const [data, setData] = useState<{
    invocations: SkillInvocationItem[];
    packs: SkillPackCatalogItem[];
    projectPacks: SkillPackItem[];
    skills: SkillCatalogItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchSkillCatalog(),
      fetchSkillPackCatalog(),
      fetchProjectSkillPacks(projectId),
      fetchProjectSkillInvocations(projectId),
    ])
      .then(([skillCatalog, packCatalog, projectPacks, invocations]) => {
        if (cancelled) return;
        const packDefinitions = packCatalog.skillPacks ?? [];
        const mergedProjectPacks = mergeProjectSkillPacks(
          projectPacks.skillPacks ?? [],
          packDefinitions,
        );
        setData({
          invocations: invocations.invocations ?? [],
          packs: packDefinitions,
          projectPacks: mergedProjectPacks,
          skills: skillCatalog.skills ?? [],
        });
        setError(null);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setData(null);
          setError(nextError instanceof Error ? nextError.message : "Agent Skills 读取失败");
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

function mergeProjectSkillPacks(
  projectPacks: SkillPackItem[],
  packDefinitions: SkillPackCatalogItem[],
) {
  return packDefinitions.map((definition) => {
    const projectPack = projectPacks.find((pack) =>
      pack.packId === definition.id || pack.id === definition.id,
    );
    return {
      ...definition,
      ...projectPack,
      id: definition.id,
      packId: definition.id,
      enabled: projectPack?.enabled ?? definition.defaultEnabled,
      description: projectPack?.description ?? definition.description,
      name: projectPack?.name ?? definition.name,
      recommendedFor: definition.recommendedFor,
      skills: definition.skills,
    };
  });
}

function SkillMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "ok" | "warn";
  value: number | string;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-2 rounded-lg border border-[var(--presento-border)] bg-[var(--presento-soft)] px-4 py-3",
      tone === "ok" && "bg-emerald-50",
      tone === "warn" && "bg-amber-50",
    )}>
      <span className="font-mono text-[11px] font-bold uppercase tracking-normal text-[var(--presento-faint)]">
        {label}
      </span>
      <strong className="text-2xl font-black leading-none text-[var(--presento-ink)]">{value}</strong>
    </div>
  );
}

function SkillPackCard({
  pack,
  skills,
}: {
  pack: SkillPackItem;
  skills: SkillCatalogItem[];
}) {
  return (
    <Card className="rounded-lg border-[var(--presento-border)] bg-white/90 shadow-sm">
      <CardHeader>
        <CardAction>
          <Badge
            variant={pack.enabled ? "secondary" : "outline"}
            className="rounded-md text-xs"
          >
            {pack.enabled ? "已启用" : "已关闭"}
          </Badge>
        </CardAction>
        <CardTitle className="text-base font-black text-[var(--presento-ink)]">{pack.name}</CardTitle>
        <CardDescription className="font-semibold leading-6">{pack.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(pack.recommendedFor ?? []).map((item) => (
            <Badge className="rounded-md font-mono text-[11px]" key={item} variant="outline">
              {formatSkillMode(item)}
            </Badge>
          ))}
        </div>
        <Separator />
        <div className="space-y-2">
          {skills.map((skill) => (
            <div className="flex items-center justify-between gap-3 text-sm" key={skill.id}>
              <span className="min-w-0 truncate font-bold text-[var(--presento-ink)]">{skill.name}</span>
              <Badge variant="ghost" className="rounded-md text-xs">
                {formatSkillMode(skill.trigger.mode)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SkillCatalogRow({
  packs,
  skill,
}: {
  packs: SkillPackItem[];
  skill: SkillCatalogItem;
}) {
  return (
    <Card className="gap-3 rounded-lg border-[var(--presento-border)] bg-white px-4 py-4 shadow-none">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm font-black text-[var(--presento-ink)]">{skill.name}</strong>
            <Badge variant="outline" className="rounded-md text-xs">
              {formatSkillMode(skill.trigger.mode)}
            </Badge>
            <Badge variant={skill.fallbackPolicy === "none" ? "outline" : "secondary"} className="rounded-md text-xs">
              {formatFallbackPolicy(skill.fallbackPolicy)}
            </Badge>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--presento-muted)]">
            {skill.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Badge variant="secondary" className="rounded-md text-xs">
            {formatSkillTrigger(skill.trigger)}
          </Badge>
          <Badge variant="outline" className="rounded-md text-xs">
            {formatOutputType(skill.output.type)}
          </Badge>
        </div>
      </div>
      <Separator />
      <div className="grid gap-3 text-xs font-semibold text-[var(--presento-muted)] md:grid-cols-3">
        <SkillMetaList label="技能包" values={skill.packIds.map((packId) => packLabel(packId, packs))} />
        <SkillMetaList label="输入输出" values={[skill.inputSchemaName, skill.outputSchemaName]} />
        <SkillMetaList label="可用工具" values={skill.allowedTools.length ? skill.allowedTools.map(formatToolName) : ["无"]} />
      </div>
    </Card>
  );
}

function SkillMetaList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-bold text-[var(--presento-faint)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge className="max-w-full truncate rounded-md text-xs" key={value} variant="outline">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function SkillInvocationRow({
  invocation,
  skills,
}: {
  invocation: SkillInvocationItem;
  skills: SkillCatalogItem[];
}) {
  return (
    <Card className="gap-3 rounded-lg border-[var(--presento-border)] bg-white px-4 py-4 shadow-none">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm font-black text-[var(--presento-ink)]">
              {formatSkillName(invocation.skillName, skills)}
            </strong>
            <Badge variant="outline" className="rounded-md text-xs">
              {formatSkillStatus(invocation.status, invocation.usedFallback)}
            </Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-[var(--presento-muted)]">
            {formatOutputSummary(invocation.outputSummary) || "暂无输出摘要"}
          </p>
        </div>
        <SkillStatusBadge status={invocation.status} usedFallback={invocation.usedFallback} />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="rounded-md text-xs">
          {formatTriggerLabel(invocation.trigger)}
        </Badge>
        <Badge variant="outline" className="rounded-md text-xs">
          {formatDuration(invocation.durationMs)}
        </Badge>
        <Badge variant="outline" className="rounded-md text-xs">
          {formatDateTime(invocation.startedAt)}
        </Badge>
        {invocation.resolvedBy ? (
          <Badge variant="outline" className="rounded-md text-xs">
            {formatResolvedBy(invocation.resolvedBy)}
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}

function SkillStatusBadge({
  status,
  usedFallback,
}: {
  status: string;
  usedFallback?: boolean;
}) {
  const tone = status === "success" && !usedFallback ? "secondary" : "outline";
  return (
    <Badge variant={tone} className="rounded-md text-xs">
      {formatSkillStatus(status, usedFallback)}
    </Badge>
  );
}

function packLabel(packId: string, packs: SkillPackItem[]) {
  return packs.find((pack) => pack.id === packId || pack.packId === packId)?.name ?? packId;
}

function formatSkillName(skillName: string, skills: SkillCatalogItem[]) {
  return skills.find((skill) => skill.id === skillName)?.name ?? skillName;
}

function formatSkillMode(mode: string) {
  const labels: Record<string, string> = {
    deep_dive: "薄弱点钻研",
    defense: "模拟答辩",
    export: "内容导出",
    file_explanation: "资料讲解",
    knowledge_node: "知识节点",
    review: "复盘",
    workspace: "工作台",
  };
  return labels[mode] ?? mode;
}

function formatSkillTrigger(trigger: SkillCatalogItem["trigger"]) {
  const eventLabels: Record<string, string> = {
    architecture_explain: "架构讲解",
    code_explain: "代码解释",
    code_walkthrough: "代码走查",
    content_export: "内容导出",
    dataset_explain: "数据说明",
    dataset_overview: "数据集讲解",
    evidence_gap_check: "证据检查",
    fallback: "兜底回答",
    file_outline: "文件大纲",
    member_scope_check: "负责范围",
    page_load: "页面加载",
    request_followup: "继续追问",
    review_generate: "生成复盘",
    rubric_score: "评分量表",
    teacher_style_followup: "老师追问",
    user_finished_slide: "讲完当前页",
  };
  return `${formatSkillMode(trigger.mode)} · ${eventLabels[trigger.event] ?? trigger.event}`;
}

function formatTriggerLabel(trigger: string) {
  const labels: Record<string, string> = {
    "brief-api": "项目速记",
    "content-export": "内容导出",
    "defense-realtime": "实时答辩",
    "finish-training": "训练复盘",
    "slide-assistant": "逐页讲稿",
    "slide-assistant:overview": "逐页讲稿",
    "slide-drill-answer": "追问回答",
    "slide-drill-answer-stream": "追问回答",
  };
  return labels[trigger] ?? trigger.replaceAll("-", " ");
}

function formatOutputType(type: string) {
  const labels: Record<string, string> = {
    code_explainer: "代码解释",
    code_walkthrough: "代码走查",
    content_export: "内容导出",
    data_survey_explainer: "数据说明",
    dataset_explainer: "数据集讲解",
    deep_dive: "薄弱点钻研",
    evidence_gap_check: "证据缺口",
    fallback_answer: "兜底回答",
    file_outline_explainer: "文件大纲",
    member_scope_defense: "负责范围",
    project_brief: "项目速记",
    review_report: "复盘报告",
    risk_questions: "高危追问",
    rubric_scoring: "评分量表",
    slide_script: "逐页讲稿",
    teacher_followup: "老师追问",
  };
  return labels[type] ?? type;
}

function formatFallbackPolicy(policy: SkillCatalogItem["fallbackPolicy"]) {
  if (policy === "required") return "有兜底";
  if (policy === "optional") return "可兜底";
  return "不兜底";
}

function formatToolName(tool: string) {
  const labels: Record<string, string> = {
    createDeepDive: "创建补强",
    createWeakness: "记录薄弱点",
    retrieveCodeContext: "检索代码",
    retrieveFileContext: "检索资料",
    retrieveKnowledgeNodeContext: "检索知识节点",
    retrieveProjectContext: "检索项目",
    retrieveRiskQuestions: "检索高危问题",
    retrieveSlideContext: "检索当前页",
    writeContentExport: "写入内容导出",
    writeReview: "写入复盘",
  };
  return labels[tool] ?? tool;
}

function formatSkillStatus(status: string, usedFallback?: boolean) {
  if (usedFallback || status === "fallback") return "已兜底";
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  if (status === "running") return "运行中";
  return status;
}

function formatResolvedBy(resolvedBy: string) {
  if (resolvedBy === "explicit") return "显式调用";
  if (resolvedBy === "router") return "规则推荐";
  if (resolvedBy === "system") return "系统调用";
  return resolvedBy;
}

function formatDuration(durationMs?: number) {
  if (typeof durationMs !== "number") return "暂无耗时";
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatDateTime(value?: string) {
  if (!value) return "暂无时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatOutputSummary(summary: unknown) {
  if (!summary) return "";
  if (typeof summary === "string") return summary;
  if (typeof summary === "number" || typeof summary === "boolean") return String(summary);
  if (isPlainRecord(summary)) {
    const preferred = ["summary", "message", "answer", "title"];
    for (const key of preferred) {
      const value = summary[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  try {
    return JSON.stringify(summary);
  } catch {
    return "";
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function useProjectOverview(projectId: string) {
  const [data, setData] = useState<ProjectOverviewDto | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchProjectOverview(projectId)
      .then((nextData) => {
        if (!cancelled) setData(nextData.overview);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { data };
}

function buildAiScriptDraftHtml(overview: SlideAssistantOverview, version: ScriptVersion) {
  if (version === "short") {
    return `<h2>${escapeHtml(overview.slideTitle)}</h2><p>${escapeHtml(overview.short)}</p>`;
  }
  if (version === "keywords") {
    const keywords = overview.keywords.filter(Boolean);
    return `
      <h2>${escapeHtml(overview.slideTitle)}</h2>
      ${keywords.length ? `<ul>${listHtml(keywords)}</ul>` : "<p>暂无 AI 提词。</p>"}
    `;
  }
  return `<h2>${escapeHtml(overview.slideTitle)}</h2><p>${escapeHtml(overview.normal)}</p>`;
}

function wrapScriptDraftHtml(content: string) {
  const trimmed = content.trim();
  if (/<(p|h[1-6]|ul|ol|blockquote|div)\b/iu.test(trimmed)) return trimmed;
  const paragraphs = trimmed
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.length
    ? paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/gu, "<br />")}</p>`).join("")
    : "<p></p>";
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

function ProjectSlideThumbnailPreview({
  index,
  projectId,
  slide,
}: {
  index: number;
  projectId: string;
  slide: ProjectSlide;
}) {
  const accent = getSlideAccent(index);
  if (slide.thumbnailPath || slide.imagePath) {
    return (
      <Image
        alt=""
        aria-hidden="true"
        className="presento-defense-thumbnail-real-image"
        height={90}
        sizes="140px"
        src={slideAssetUrl(projectId, slide, slide.thumbnailPath ? "thumbnail" : "image")}
        width={140}
      />
    );
  }

  const textLines = (slide.extractedText ?? "")
    .split(/\r?\n|。|；/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <span
      aria-hidden="true"
      className="presento-defense-thumbnail-image presento-defense-thumbnail-preview"
      style={{ "--defense-slide-accent": accent } as CSSProperties}
    >
      <span className="presento-defense-thumbnail-kicker">{formatSlidePage(slide)}</span>
      <strong>{trimText(slide.title, 24)}</strong>
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

function FeatureUnavailableState() {
  return (
    <div className="presento-feature-unavailable">
      <Image
        alt=""
        aria-hidden="true"
        className="presento-feature-unavailable-image"
        height={1254}
        priority
        sizes="(max-width: 768px) 68vw, 360px"
        src="/states/feature-unavailable-transparent.png"
        width={1254}
      />
      <h2>功能暂未开放</h2>
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
