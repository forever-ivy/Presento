"use client";

import {
  Bot,
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
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PanelSize } from "react-resizable-panels";
import {
  startTransition,
  forwardRef,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DotPattern } from "@/components/magicui/dot-pattern";
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/components/ui/scroll-based-velocity";
import { KnowledgeMapRoom } from "@/components/knowledge-map/knowledge-map-room";
import { ProjectUploadWorkspace } from "@/components/project-upload-workspace";
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
  demoSlideScripts,
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
const QQ_LOGO_DATA_URI =
  "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20width='56'%20height='35'%20fill='none'%20viewBox='0%200%2056%2035'%3e%3cpath%20fill='%23f9ae08'%20d='M9.56%2028.668c-1.981%200-3.8-.666-4.972-1.662-.594.179-1.355.466-1.835.823-.41.305-.359.615-.285.741.325.55%205.577.351%207.094.18v-.082z'/%3e%3cpath%20fill='%23f9ae08'%20d='M9.56%2028.668c1.98%200%203.8-.666%204.971-1.662.595.179%201.356.466%201.836.823.41.305.359.615.285.741-.326.55-5.578.351-7.094.18v-.082z'/%3e%3cpath%20fill='%23000'%20d='M9.573%2016.55c3.272-.023%205.894-.476%206.784-.72a.84.84%200%200%200%20.325-.163c0-.03.013-.535.013-.796-.002-4.39-2.063-8.802-7.135-8.802-5.073%200-7.134%204.411-7.134%208.802%200%20.261.013.767.013.796%200%200%20.093.098.261.145.821.229%203.493.715%206.849.738zM18.465%2020.391c-.204-.655-.48-1.42-.76-2.157%200%200-.188-.005-.285.016-2.33.503-5.536.869-7.847.841h-.024c-2.311.028-5.632-.356-7.847-.84-.098-.021-.285-.017-.285-.017-.28.735-.558%201.5-.76%202.157-.893%202.785-.71%204.331-.413%204.444.423.163%201.99-2.347%201.99-2.347%200%202.457%202.207%206.227%207.26%206.263h.135c5.053-.036%207.26-3.806%207.26-6.263%200%200%201.567%202.508%201.99%202.347.295-.113.478-1.659-.411-4.444z'/%3e%3cpath%20fill='%23f9ae08'%20d='M9.573%2015.111c1.68%200%203.268-.597%204.005-1.117.258-.182.189-.453-.082-.58-.31-.147-.635-.236-1.005-.322a13.4%2013.4%200%200%200-2.917-.332H9.55c-.934%200-1.98.114-2.917.332-.37.085-.695.175-1.004.322-.271.127-.34.398-.082.58.737.52%202.325%201.117%204.005%201.117h.024z'/%3e%3cpath%20fill='%23fff'%20d='M9.571%2019.078h-.024c-1.569.02-3.471-.053-5.314-.417a15%2015%200%200%200-.172%203.449c.207%203.477%202.262%205.663%205.435%205.695h.128c3.172-.032%205.228-2.218%205.435-5.695a15%2015%200%200%200-.172-3.449c-1.843.366-3.745.437-5.316.417'/%3e%3cpath%20fill='%23f10824'%20d='M5.07%2022.237c0%20.087.063.163.15.175.856.13%201.864.178%202.835.104a.177%200%200%200%20.162-.178v-3.395c-.997-.056-2.072-.14-3.146-.322z'/%3e%3cpath%20fill='%23f10824'%20d='M9.549%2019.23c-2.53%200-5.424-.294-8.132-.994l1.024-2.568s3.014.756%207.108.756h.024c4.093%200%207.108-.755%207.108-.755l1.024%202.567c-2.709.702-5.602.994-8.132.994z'/%3e%3cpath%20fill='%23fff'%20d='M7.755%2012.44c-.687.031-1.275-.756-1.312-1.756-.037-1.002.49-1.84%201.178-1.872.687-.03%201.274.757%201.312%201.759.037%201.002-.489%201.84-1.178%201.87M12.677%2010.684c-.037%201.001-.625%201.789-1.312%201.757-.688-.03-1.215-.868-1.178-1.87s.625-1.79%201.312-1.76%201.215.87%201.178%201.873'/%3e%3cpath%20fill='%23000'%20d='M8.58%2010.737c.034.431-.201.815-.525.856-.325.042-.615-.273-.65-.705-.034-.432.201-.815.523-.857.326-.042.617.274.651.706M10.552%2010.83c.305-.527%201.02-.693%201.543-.407.374.2.106.657-.232.473-.32-.172-.764-.16-.998.139-.185.235-.456.041-.313-.207zM53.977%2023.041a8.06%208.06%200%200%200%202.013-5.77c-.207-4.095-3.517-7.423-7.592-7.63-4.76-.244-8.67%203.686-8.429%208.47.207%204.096%203.518%207.422%207.594%207.63a7.97%207.97%200%200%200%204.881-1.355l.674.902c.05.07.133.11.218.11h2.208c.079%200%20.125-.09.077-.155l-1.643-2.202zm-5.998.809c-3.307%200-5.99-2.758-5.99-6.16%200-3.401%202.683-6.159%205.99-6.159s5.991%202.758%205.991%206.16a6.24%206.24%200%200%201-1.213%203.714l-1.27-1.703a.27.27%200%200%200-.219-.11H49.06a.097.097%200%200%200-.077.155l2.3%203.081a5.85%205.85%200%200%201-3.304%201.022M38.344%2017.273c-.207-4.096-3.518-7.423-7.592-7.631-4.76-.243-8.669%203.687-8.428%208.47.206%204.096%203.517%207.423%207.593%207.63a7.97%207.97%200%200%200%204.882-1.354l.673.902c.051.069.133.11.218.11h2.209c.078%200%20.124-.091.076-.155l-1.642-2.202a8.06%208.06%200%200%200%202.013-5.77zm-4.504%202.43a.27.27%200%200%200-.218-.109h-2.208a.097.097%200%200%200-.077.155l2.3%203.081a5.85%205.85%200%200%201-3.303%201.021c-3.308%200-5.991-2.757-5.991-6.159s2.683-6.16%205.99-6.16c3.309%200%205.992%202.758%205.992%206.16a6.24%206.24%200%200%201-1.214%203.714z'/%3e%3c/svg%3e";
const PCG_OUTPUT_LOGOS = [
  { alt: "QQ", height: 70, src: QQ_LOGO_DATA_URI, width: 112 },
  { alt: "Weishi", height: 128, src: "/brand/tencent-weishi-icon.png", width: 128 },
  { alt: "Tencent Video", height: 128, src: "/brand/tencent-video-logo.png", width: 128 },
] as const;
const pcgNodeDetails = {
  file: {
    title: "项目资料",
    description: "PPT、报告、代码和数据表进入 Presento，作为训练和二次创作的证据源。",
    items: ["知识源", "可引用", "可追问"],
  },
  inputQq: {
    title: "QQ 小组群",
    description: "收集小组讨论、分工提醒和答辩倒计时，补齐协作上下文。",
    items: ["分工", "提醒", "讨论"],
  },
  github: {
    title: "GitHub 仓库",
    description: "读取代码结构、提交记录和个人负责范围，用于支撑技术解释。",
    items: ["代码", "提交", "职责"],
  },
  presento: {
    title: "Presento",
    description: "把资料、协作和代码统一整理成答辩训练与内容分发的中枢。",
    items: ["解析", "训练", "生成"],
  },
  outputQq: {
    title: "QQ 分享",
    description: "生成训练摘要、分工提醒和高危追问，回流到小组沟通。",
    items: ["摘要", "追问", "提醒"],
  },
  weishi: {
    title: "微视口播",
    description: "把讲稿和高质量回答压缩成 30 秒校园项目介绍。",
    items: ["亮点", "镜头", "口播"],
  },
  tencentVideo: {
    title: "腾讯视频展示",
    description: "生成 5 分钟项目展示脚本、简介和项目 FAQ。",
    items: ["脚本", "简介", "FAQ"],
  },
} as const;
let pendingReturnStepId: FlowStepId | null = null;
let pendingDockEntryStepId: FlowStepId | null = null;
let pendingDockEntryToken = 0;
let pendingDockEntryViewport: Viewport | null = null;
let pendingSettledDockEntryStepId: FlowStepId | null = null;
let pendingRoomSwitch: RoomSwitchState | null = null;
let pendingRoomSwitchViewport: Viewport | null = null;
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
      pendingRoomSwitchViewport = null;
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
      pendingRoomSwitchViewport = flowInstanceRef.current?.getViewport() ?? null;
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
    pendingRoomSwitchViewport = null;
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
          onBack: pendingDockEntryHref ? cancelDockEntry : exitStep,
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
            activeStep={transitionStep}
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
              activeId={transitionStep.id}
              initialViewport={
                resumedDockEntry || settledDockEntry
                  ? pendingDockEntryViewport
                  : roomSwitch
                    ? pendingRoomSwitchViewport
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
            roomSwitch ? (
              <StepRoomSlideTransition transition={roomSwitch} />
            ) : (
              (mode === "inside" || returningToMap) && roomContentReady ? (
                <StepRoom
                  activeId={visibleRoomStep.id}
                  instant={suppressRoomIntro}
                  key={visibleRoomStep.id}
                />
              ) : null
            )
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
      const roomElement = scopeRef.current.querySelector(room);

      if (reduceMotion) {
        gsap.set(canvas, {
          opacity: preset.canvas.opacity,
          scale: mode === "inside" ? preset.canvas.scale : 1,
        });
        gsap.set(shell, {
          opacity: mode === "map" ? 0 : preset.portalShell.opacityTo,
          scale: 1,
          y: 0,
        });
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
        gsap.set(shell, {
          opacity: preset.portalShell.opacityTo,
          scale: 1,
          y: 0,
        });
        gsap.set(room, {
          opacity: 1,
          scale: 1,
          y: 0,
        });
        return;
      }

      if (mode === "map") {
        timeline
          .to(canvas, {
            duration: mapPreset.canvas.duration / 1000,
            scale: mapPreset.canvas.scale,
            opacity: mapPreset.canvas.opacity,
            ease: "power2.inOut",
          }, 0.1);
        return;
      }

      if (mode === "entering" && targetMode === "map") {
        const portalOrigin = getPortalOrigin();
        timeline
          .to(shell, {
            duration: EXIT_MS / 1000,
            opacity: 0,
            scale: portalOrigin.exitScale,
            transformOrigin: portalOrigin.transformOrigin,
            y: portalOrigin.exitY,
            ease: "expo.inOut",
          }, 0)
          .fromTo(room, {
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
          .to(room, {
            duration: 0.18,
            opacity: 0,
            ease: "power2.out",
          }, (EXIT_MS - 190) / 1000)
          .to(canvas, {
            duration: 0.58,
            scale: mapPreset.canvas.scale,
            opacity: mapPreset.canvas.opacity,
            ease: "power3.out",
          }, 0.12);
        return;
      }

      timeline
        .to(canvas, {
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
        timeline
          .set(shell, {
            opacity: 0,
            scale: preset.portalShell.scaleFrom,
            y: preset.portalShell.yFrom,
            transformOrigin: () => getPortalOrigin().transformOrigin,
          }, portalShellDelay)
          .to(shell, {
            duration: preset.portalShell.duration / 1000,
            opacity: preset.portalShell.opacityTo,
            scale: 1,
            y: 0,
            ease: "expo.out",
          }, portalShellDelay);
      }

      if (mode === "inside" && !roomSwitchActive) {
        const roomFromScale = dockEntryActive ? preset.portalShell.scaleFrom : preset.room.scaleFrom;
        const roomFromOpacity = dockEntryActive ? 0.86 : 0;
        const roomFromY = dockEntryActive ? 0 : preset.room.yFrom;
        const roomOrigin = dockEntryActive ? getPortalOrigin().transformOrigin : "50% 48%";

        timeline
          .to(shell, {
            duration: preset.portalShell.duration / 1000,
            opacity: preset.portalShell.opacityTo,
            scale: 1,
            y: 0,
            ease: "power3.out",
          }, 0);

        if (roomContentReady) {
          timeline.fromTo(room, {
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

function StepRoomSlideTransition({
  transition,
}: {
  transition: RoomSwitchState;
}) {
  const offset = `${transition.direction * 100}%`;
  const reverseOffset = `${transition.direction * -100}%`;
  const slideTransition = {
    duration: ROOM_SWITCH_MS / 1000,
    ease: [0.16, 1, 0.3, 1] as const,
  };

  return (
    <div className="presento-room-slide-stage">
      <motion.div
        animate={{ opacity: 0.62, scale: 0.985, x: reverseOffset }}
        className="presento-room-slide presento-room-slide-outgoing"
        initial={{ opacity: 1, scale: 1, x: "0%" }}
        key={`${transition.key}-${transition.from.id}-out`}
        transition={slideTransition}
      >
        <StepRoom activeId={transition.from.id} instant />
      </motion.div>
      <motion.div
        animate={{ opacity: 1, scale: 1, x: "0%" }}
        className="presento-room-slide presento-room-slide-incoming"
        initial={{ opacity: 0.92, scale: 0.995, x: offset }}
        key={`${transition.key}-${transition.to.id}-in`}
        transition={slideTransition}
      >
        <StepRoom activeId={transition.to.id} instant />
      </motion.div>
    </div>
  );
}

function StepRoom({
  activeId,
  instant = false,
}: {
  activeId: FlowStepId;
  instant?: boolean;
}) {
  const step = getFlowStepById(activeId);
  const roomBody = (
    <main
      className={cn(
        "presento-step-room-body",
        activeId === "knowledge" && "presento-step-room-body-knowledge",
        activeId === "files" && "presento-step-room-body-files",
        activeId === "defense" && "presento-step-room-body-defense",
        activeId === "pcg" && "presento-step-room-body-pcg",
      )}
    >
      <StepRoomContent stepId={activeId} />
    </main>
  );

  return (
    <section
      className={cn("presento-step-room", roomKindClass(step.roomKind))}
      style={instant ? { opacity: 1, transform: "translateY(0) scale(1)" } : undefined}
    >
      {activeId === "knowledge" || activeId === "defense" || activeId === "pcg" ? roomBody : <ScrollArea className="presento-step-room-scroll">{roomBody}</ScrollArea>}
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

function KnowledgeRoom() {
  return <KnowledgeMapRoom projectId={demoProject.id} />;
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
  const isNarrowLayout = useIsNarrowDefenseLayout();
  const [activeSlideIndex, setActiveSlideIndex] = useState(1);
  const [isGalleryCollapsed, setIsGalleryCollapsed] = useState(false);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLDivElement>(null);
  const inputQqRef = useRef<HTMLDivElement>(null);
  const githubRef = useRef<HTMLDivElement>(null);
  const presentoRef = useRef<HTMLDivElement>(null);
  const qqRef = useRef<HTMLDivElement>(null);
  const weishiRef = useRef<HTMLDivElement>(null);
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
            detail={pcgNodeDetails.file}
            ref={fileRef}
            className="size-32 bg-white/94"
            ringClassName="shadow-[0_18px_40px_rgba(17,24,39,0.08)]"
            side="right"
          >
            <FileText
              aria-hidden="true"
              className="text-[var(--presento-muted)]"
              style={{ height: 86, width: 86 }}
            />
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
          <BeamHoverNode
            detail={pcgNodeDetails.github}
            ref={githubRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(31,35,41,0.08)]"
            side="right"
          >
            <GithubMark />
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
            detail={pcgNodeDetails.weishi}
            ref={weishiRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(31,35,41,0.08)]"
            side="left"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="h-auto max-h-20 w-auto max-w-24 object-contain"
              height={PCG_OUTPUT_LOGOS[1].height}
              src={PCG_OUTPUT_LOGOS[1].src}
              width={PCG_OUTPUT_LOGOS[1].width}
            />
          </BeamHoverNode>
          <BeamHoverNode
            detail={pcgNodeDetails.tencentVideo}
            ref={tencentVideoRef}
            className="size-32 bg-white/94 p-4"
            ringClassName="shadow-[0_18px_42px_rgba(31,35,41,0.08)]"
            side="left"
          >
            <Image
              alt=""
              aria-hidden="true"
              className="h-auto max-h-20 w-auto max-w-24 object-contain"
              height={PCG_OUTPUT_LOGOS[2].height}
              src={PCG_OUTPUT_LOGOS[2].src}
              width={PCG_OUTPUT_LOGOS[2].width}
            />
          </BeamHoverNode>
        </div>
      </div>
      <AnimatedBeam
        containerRef={containerRef}
        curvature={-58}
        duration={7}
        endYOffset={-2}
        fromRef={fileRef}
        gradientStartColor="#9aa1a8"
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
        curvature={58}
        duration={7}
        fromRef={githubRef}
        gradientStartColor="#111827"
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
        gradientStopColor="#ec4899"
        pathColor="rgba(31,35,41,0.24)"
        pathWidth={4}
        repeatDelay={0.1}
        toRef={weishiRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        curvature={72}
        duration={7}
        fromRef={presentoRef}
        gradientStartColor="#10b981"
        gradientStopColor="#6a9fd8"
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

function GithubMark() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      style={{ height: 82, width: 82 }}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.37 0 0 5.5 0 12.28c0 5.43 3.44 10.03 8.2 11.66.6.11.82-.27.82-.59 0-.29-.01-1.25-.02-2.27-3.34.74-4.04-1.46-4.04-1.46-.55-1.42-1.33-1.8-1.33-1.8-1.09-.76.08-.74.08-.74 1.2.09 1.84 1.27 1.84 1.27 1.07 1.88 2.81 1.34 3.5 1.02.11-.79.42-1.34.76-1.64-2.67-.31-5.47-1.37-5.47-6.08 0-1.34.47-2.44 1.24-3.3-.13-.31-.54-1.56.12-3.25 0 0 1.01-.33 3.3 1.26A11.2 11.2 0 0 1 12 5.95c1.02.01 2.04.14 3 .41 2.29-1.59 3.3-1.26 3.3-1.26.66 1.69.25 2.94.12 3.25.77.86 1.24 1.96 1.24 3.3 0 4.73-2.81 5.76-5.49 6.07.43.38.81 1.12.81 2.26 0 1.63-.01 2.94-.01 3.34 0 .33.21.71.82.59A12.26 12.26 0 0 0 24 12.28C24 5.5 18.63 0 12 0z" />
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
