"use client";

import {
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
import { usePathname } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DotPattern } from "@/components/magicui/dot-pattern";
import { SigmaKnowledgeGraph } from "@/components/sigma-knowledge-graph";
import {
  ScrollVelocityContainer,
  ScrollVelocityRow,
} from "@/components/ui/scroll-based-velocity";
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
  const [modeState, setMode] = useState<FlowMode>(() => {
    if (targetMode === "map") return "map";
    if (settledDockEntry) return "inside";
    return "entering";
  });
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
          contextLabel: roomKindLabel(topNavStep.roomKind),
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
          contextLabel: roomKindLabel(roomSwitch.from.roomKind),
          title: roomSwitch.from.label,
        },
        key: roomSwitch.key,
        to: {
          contextLabel: roomKindLabel(roomSwitch.to.roomKind),
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

  return (
    <section
      className={cn("presento-step-room", roomKindClass(step.roomKind))}
      style={instant ? { opacity: 1, transform: "translateY(0) scale(1)" } : undefined}
    >
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
  const [activeNodeId, setActiveNodeId] = useState(projectNode.id);
  const sigmaNodes = useMemo(
    () => demoKnowledgeNodes.map((node) => ({
      id: node.id,
      title: node.title,
      kind: node.id === "project" ? "project" : node.type.includes("资料") ? "file" : "module",
      tone: node.tone,
      summary: node.description,
      metadata: {
        risk: node.risk,
        evidence: node.evidence,
      },
    })),
    [],
  );
  const sigmaEdges = useMemo(
    () => demoKnowledgeNodes.slice(1).map((node) => ({
      id: `edge-project-${node.id}`,
      fromNodeId: projectNode.id,
      toNodeId: node.id,
      label: "知识关联",
    })),
    [projectNode.id],
  );
  const activeNode = demoKnowledgeNodes.find((node) => node.id === activeNodeId) ?? projectNode;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <RoomCard
        action={<Badge className="presento-room-badge-blue">核心节点</Badge>}
        className="min-h-[520px]"
        icon={<Map aria-hidden="true" />}
        title="项目知识地图"
        description="Force-Directed Graph 展示资料、模块、风险和训练入口，后续文件叶子节点可进入讲解态。"
      >
        <div className="h-[430px] overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_35%_30%,rgba(37,99,235,0.16),transparent_32%),linear-gradient(135deg,#f8fbff,#eef4ff)]">
          <SigmaKnowledgeGraph
            activeId={activeNodeId}
            edges={sigmaEdges}
            nodes={sigmaNodes}
            onSelect={setActiveNodeId}
          />
        </div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/85 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={toneBadgeClass(activeNode.tone)}>{activeNode.type}</Badge>
            <span className="text-sm font-black">{activeNode.title}</span>
            <span className="text-xs font-bold text-[var(--presento-muted)]">{activeNode.risk}</span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--presento-muted)]">
            {activeNode.description}
          </p>
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
