import type { PresentoTone } from "@/components/presento-ui";

export type FlowStepId =
  | "files"
  | "knowledge"
  | "scripts"
  | "defense"
  | "review"
  | "deepDive"
  | "skills"
  | "pcg";

export type FlowMode = "map" | "entering" | "inside";

export type FlowRoomKind = "standard" | "explore" | "immersive";

export type FlowEdgeKind = "main" | "return" | "support" | "output";

export type FlowTransitionPhase = "overview" | "focus" | "room";

export type FlowTransitionPreset = {
  name: "map" | FlowRoomKind;
  phase: FlowTransitionPhase;
  ease: string;
  camera:
    | {
        type: "fit";
        duration: number;
        padding:
          | number
          | {
              top?: number | `${number}px` | `${number}%`;
              right?: number | `${number}px` | `${number}%`;
              bottom?: number | `${number}px` | `${number}%`;
              left?: number | `${number}px` | `${number}%`;
              x?: number | `${number}px` | `${number}%`;
              y?: number | `${number}px` | `${number}%`;
            };
        minZoom: number;
        maxZoom: number;
        zoom?: number;
        offset: { x: number; y: number };
      }
    | {
        type: "center";
        duration: number;
        zoom: number;
        offset: { x: number; y: number };
      };
  canvas: {
    duration: number;
    scale: number;
    blur: number;
    opacity: number;
    saturation: number;
  };
  commandBar: {
    duration: number;
    opacity: number;
    y: number;
  };
  room: {
    visible: boolean;
    duration: number;
    delay: number;
    scaleFrom: number;
    yFrom: number;
  };
  portalShell: {
    visible: boolean;
    duration: number;
    delay: number;
    scaleFrom: number;
    yFrom: number;
    opacityTo: number;
    clipFrom: string;
    clipTo: string;
  };
};

export type FlowStepStatus =
  | "completed"
  | "active"
  | "risk"
  | "pending"
  | "weakness"
  | "capability"
  | "output";

export type FlowStep = {
  id: FlowStepId;
  route: string;
  label: string;
  shortLabel: string;
  summary: string;
  stateLine: string;
  metrics: string[];
  status: FlowStepStatus;
  roomKind: FlowRoomKind;
  tone: PresentoTone;
  position: { x: number; y: number };
};

export type FlowWorkspaceNodeData = FlowStep & {
  active: boolean;
  mode?: FlowMode;
};

export type FlowWorkspaceNode = {
  id: FlowStepId;
  type: "flowStep";
  position: { x: number; y: number };
  draggable: false;
  selectable: true;
  data: FlowWorkspaceNodeData;
};

export type FlowWorkspaceEdge = {
  id: string;
  source: FlowStepId;
  target: FlowStepId;
  animated: boolean;
  type: "smoothstep";
  data: { tone: PresentoTone; active: boolean; kind: FlowEdgeKind };
  style: { stroke: string; strokeWidth: number };
};

export type FlowWorkspaceFlow = {
  nodes: FlowWorkspaceNode[];
  edges: FlowWorkspaceEdge[];
};

export type FlowNodeMotionState = {
  opacity: number;
  scale: number;
  y: number;
};

export type FlowCameraAction = "fit" | "center" | "hold";
export type FlowBackgroundCopyBehavior = "hidden" | "timed" | "persistent";
export type FlowBackgroundCopyAnimationMode =
  | "hidden"
  | "timed"
  | "persistent"
  | "exiting";

export type FlowPortalOriginStyle = {
  clipPath: string;
  transformOrigin: string;
};

export const FLOW_MAP_OVERVIEW_MIN_ZOOM = 0.34;
export const FLOW_MAP_OVERVIEW_MAX_ZOOM = 0.44;
export const FLOW_NODE_FOCUS_MAX_ZOOM = 2.8;
export const FLOW_MAP_OVERVIEW_PADDING = {
  top: "6%",
  right: "4%",
  bottom: "8%",
  left: "10%",
} as const;

export const flowDockStepOrder: FlowStepId[] = [
  "knowledge",
  "files",
  "scripts",
  "defense",
  "deepDive",
  "review",
  "skills",
  "pcg",
];

export const flowSteps: FlowStep[] = [
  {
    id: "files",
    route: "/projects/demo/files",
    label: "资料导入",
    shortLabel: "上传",
    summary: "上传 PPT、报告、代码与数据",
    stateLine: "5 份资料 · 3 已解析",
    metrics: ["5 份资料", "3 已解析", "2 待处理"],
    status: "completed",
    roomKind: "standard",
    tone: "green",
    position: { x: -820, y: 0 },
  },
  {
    id: "knowledge",
    route: "/projects/demo/knowledge-map",
    label: "知识地图",
    shortLabel: "地图",
    summary: "把资料转成可训练的项目大脑",
    stateLine: "18 节点 · 8 高危 · 3 薄弱",
    metrics: ["18 知识节点", "8 高危追问", "3 薄弱点"],
    status: "active",
    roomKind: "explore",
    tone: "blue",
    position: { x: -350, y: 0 },
  },
  {
    id: "scripts",
    route: "/projects/demo/scripts",
    label: "逐页讲稿",
    shortLabel: "讲稿",
    summary: "为每一页 PPT 生成讲解路径",
    stateLine: "12 / 18 页完成",
    metrics: ["18 页 PPT", "12 已生成", "3 页高危"],
    status: "pending",
    roomKind: "standard",
    tone: "cyan",
    position: { x: 120, y: 0 },
  },
  {
    id: "defense",
    route: "/projects/demo/defense",
    label: "模拟讲练",
    shortLabel: "讲练",
    summary: "对着当前 PPT 页实时追问",
    stateLine: "建议下一步 · 第 2 页",
    metrics: ["严格老师模式", "当前第 2 页", "准备开始"],
    status: "risk",
    roomKind: "immersive",
    tone: "orange",
    position: { x: 590, y: 0 },
  },
  {
    id: "review",
    route: "/projects/demo/review",
    label: "复盘报告",
    shortLabel: "复盘",
    summary: "暴露问题，生成下一轮训练任务",
    stateLine: "上次得分 76 · 2 个主要风险",
    metrics: ["上次得分 76", "2 主要风险", "待生成新复盘"],
    status: "pending",
    roomKind: "standard",
    tone: "purple",
    position: { x: 1060, y: 0 },
  },
  {
    id: "pcg",
    route: "/projects/demo/pcg",
    label: "PCG 连接",
    shortLabel: "输出",
    summary: "面向 QQ 校园协作与成果传播",
    stateLine: "QQ 小组 · 微视口播 · 腾讯视频",
    metrics: ["小组协作", "训练摘要", "项目展示"],
    status: "output",
    roomKind: "standard",
    tone: "cyan",
    position: { x: 1530, y: 0 },
  },
  {
    id: "deepDive",
    route: "/projects/demo/deep-dive",
    label: "薄弱点钻研",
    shortLabel: "钻研",
    summary: "把答不上来的问题补回来",
    stateLine: "数据库设计 · 个人贡献 · 异常处理",
    metrics: ["数据库设计", "个人贡献", "异常处理"],
    status: "weakness",
    roomKind: "explore",
    tone: "red",
    position: { x: 590, y: 320 },
  },
  {
    id: "skills",
    route: "/projects/demo/skills",
    label: "Agent Skills",
    shortLabel: "Skills",
    summary: "解析、追问、复盘的能力包",
    stateLine: "5 个 Skill 启用 · fallback 可用",
    metrics: ["5 Skill 启用", "模型 fallback", "调用可观察"],
    status: "capability",
    roomKind: "standard",
    tone: "purple",
    position: { x: -350, y: -300 },
  },
];

const routeAliases = new Map<string, FlowStepId>([
  ["/", "knowledge"],
  ["/projects/demo/knowledge-map", "knowledge"],
  ...flowSteps.map((step) => [step.route, step.id] as const),
]);

const flowLinks: Array<[FlowStepId, FlowStepId, PresentoTone, FlowEdgeKind]> = [
  ["files", "knowledge", "green", "main"],
  ["knowledge", "scripts", "blue", "main"],
  ["scripts", "defense", "cyan", "main"],
  ["defense", "review", "orange", "main"],
  ["review", "pcg", "cyan", "output"],
  ["review", "deepDive", "red", "return"],
  ["deepDive", "knowledge", "red", "return"],
  ["skills", "files", "purple", "support"],
  ["skills", "knowledge", "purple", "support"],
  ["skills", "defense", "purple", "support"],
];

export function getFlowStepByRoute(pathname: string) {
  const stepId = routeAliases.get(pathname) ?? "knowledge";
  return getFlowStepById(stepId);
}

export function getFlowStepById(stepId: FlowStepId) {
  return flowSteps.find((step) => step.id === stepId) ?? flowSteps[1];
}

export function flowStepToRoute(stepId: FlowStepId) {
  return getFlowStepById(stepId).route;
}

export function flowRouteToMode(pathname: string): Exclude<FlowMode, "entering"> {
  return pathname === "/" ? "map" : "inside";
}

export function getFlowWorkspaceInitialRoomStep({
  activeStep,
  pendingReturnStep,
  targetMode,
}: {
  activeStep: FlowStep;
  pendingReturnStep: FlowStep | null;
  targetMode: Exclude<FlowMode, "entering">;
}) {
  if (targetMode === "map" && pendingReturnStep) return pendingReturnStep;
  return activeStep;
}

export function getFlowWorkspaceTransitionStep({
  activeStep,
  lastRoomStep,
  targetMode,
}: {
  activeStep: FlowStep;
  lastRoomStep: FlowStep;
  targetMode: Exclude<FlowMode, "entering">;
}) {
  if (targetMode === "map") return lastRoomStep;
  return activeStep;
}

export function getFlowTransitionPreset(
  mode: FlowMode,
  activeStep: FlowStep,
): FlowTransitionPreset {
  if (mode === "map") {
    return {
      name: "map",
      phase: "overview",
      ease: "power2.inOut",
      camera: {
        type: "fit",
        duration: 780,
        padding: FLOW_MAP_OVERVIEW_PADDING,
        minZoom: FLOW_MAP_OVERVIEW_MIN_ZOOM,
        maxZoom: FLOW_MAP_OVERVIEW_MAX_ZOOM,
        offset: { x: 0, y: 0 },
      },
      canvas: {
        duration: 520,
        scale: 1,
        blur: 0,
        opacity: 1,
        saturation: 1,
      },
      commandBar: {
        duration: 220,
        opacity: 1,
        y: 0,
      },
      room: {
        visible: false,
        duration: 360,
        delay: 0,
        scaleFrom: 0.86,
        yFrom: 0,
      },
      portalShell: {
        visible: false,
        duration: 260,
        delay: 0,
        scaleFrom: 0.2,
        yFrom: 0,
        opacityTo: 0,
        clipFrom: "inset(43% 42% 43% 42% round 22px)",
        clipTo: "inset(43% 42% 43% 42% round 22px)",
      },
    };
  }

  const roomKind = activeStep.roomKind;
  const immersive = roomKind === "immersive";
  const explore = roomKind === "explore";

  return {
    name: roomKind,
    phase: mode === "entering" ? "focus" : "room",
    ease: mode === "entering" ? "power3.out" : "power3.out",
    camera: {
      type: "center",
      duration: mode === "entering" ? (immersive ? 620 : explore ? 600 : 560) : immersive ? 780 : explore ? 680 : 620,
      zoom:
        mode === "entering"
          ? immersive
            ? 2.6
            : explore
              ? 2.42
              : 2.26
          : immersive
            ? 1.48
            : explore
              ? 1.42
              : 1.36,
      offset: {
        x: 0,
        y: 0,
      },
    },
    canvas: {
      duration: mode === "entering" ? 620 : 420,
      scale: mode === "entering" ? 1 : immersive ? 1.04 : explore ? 1.03 : 1.02,
      blur: mode === "entering" ? 0 : 4,
      opacity: mode === "entering" ? 1 : 0,
      saturation: mode === "entering" ? 1 : 0.84,
    },
    commandBar: {
      duration: mode === "entering" ? 180 : 200,
      opacity: 0,
      y: -4,
    },
    room: {
      visible: mode === "inside",
      duration: immersive ? 380 : 420,
      delay: mode === "inside" ? 0.02 : 0.3,
      scaleFrom: 0.82,
      yFrom: 18,
    },
    portalShell: {
      visible: true,
      duration: mode === "entering" ? (immersive ? 560 : explore ? 540 : 520) : immersive ? 460 : explore ? 520 : 500,
      delay: mode === "entering" ? (immersive ? 0.62 : explore ? 0.6 : 0.56) : immersive ? 0.06 : 0.08,
      scaleFrom: mode === "entering" ? 1 : immersive ? 0.14 : explore ? 0.16 : 0.18,
      yFrom: immersive ? -6 : 0,
      opacityTo: mode === "entering" ? (immersive ? 0.9 : 0.88) : 0.94,
      clipFrom: "inset(43% 42% 43% 42% round 22px)",
      clipTo: "inset(0% 0% 0% 0% round 0px)",
    },
  };
}

export function getFlowCameraAction(
  mode: FlowMode,
  targetMode: Exclude<FlowMode, "entering">,
): FlowCameraAction {
  if (targetMode === "map") return mode === "map" ? "fit" : "hold";

  if (mode === "map") {
    return "hold";
  }

  return "center";
}

export function getFlowStepSlideDirection(from: FlowStepId, to: FlowStepId): -1 | 1 {
  const fromIndex = flowDockStepOrder.indexOf(from);
  const toIndex = flowDockStepOrder.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) return 1;
  return toIndex >= fromIndex ? 1 : -1;
}

export function shouldRenderFlowRoomChrome({
  dockFocusPending,
  mode,
}: {
  dockFocusPending: boolean;
  mode: FlowMode;
}) {
  if (mode === "map") return false;
  return !dockFocusPending;
}

export function getFlowPortalOriginStyle({
  containerHeight,
  containerWidth,
  padding = 10,
  sourceHeight,
  sourceLeft,
  sourceTop,
  sourceWidth,
}: {
  containerHeight: number;
  containerWidth: number;
  padding?: number;
  sourceHeight: number;
  sourceLeft: number;
  sourceTop: number;
  sourceWidth: number;
}): FlowPortalOriginStyle {
  if (
    containerHeight <= 0 ||
    containerWidth <= 0 ||
    sourceHeight <= 0 ||
    sourceWidth <= 0
  ) {
    return {
      clipPath: "inset(43% 42% 43% 42% round 22px)",
      transformOrigin: "50% 48%",
    };
  }

  const top = toPercent((sourceTop - padding) / containerHeight);
  const left = toPercent((sourceLeft - padding) / containerWidth);
  const right = toPercent(
    (containerWidth - sourceLeft - sourceWidth - padding) / containerWidth,
  );
  const bottom = toPercent(
    (containerHeight - sourceTop - sourceHeight - padding) / containerHeight,
  );
  const originX = toPercent((sourceLeft + sourceWidth / 2) / containerWidth);
  const originY = toPercent((sourceTop + sourceHeight / 2) / containerHeight);

  return {
    clipPath: `inset(${top} ${right} ${bottom} ${left} round 24px)`,
    transformOrigin: `${originX} ${originY}`,
  };
}

export function getFlowBackgroundCopyBehavior({
  mode,
  pinned,
}: {
  mode: Exclude<FlowMode, "entering"> | FlowMode;
  pinned: boolean;
}): FlowBackgroundCopyBehavior {
  if (mode !== "map") return "hidden";
  return pinned ? "persistent" : "timed";
}

function toPercent(value: number) {
  return `${Number((clamp(value, 0, 0.96) * 100).toFixed(2))}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getFlowBackgroundCopyAnimationMode({
  behavior,
  exiting,
}: {
  behavior: FlowBackgroundCopyBehavior;
  exiting: boolean;
}): FlowBackgroundCopyAnimationMode {
  if (behavior === "hidden") return "hidden";
  if (exiting) return "exiting";
  return behavior;
}

export function shouldAnimateFlowModeTransition({
  isInitialRender,
  previousTargetMode,
  targetMode,
}: {
  isInitialRender: boolean;
  previousTargetMode: Exclude<FlowMode, "entering"> | null;
  targetMode: Exclude<FlowMode, "entering">;
}) {
  if (targetMode === "map") return !isInitialRender;
  if (isInitialRender) return true;
  return previousTargetMode === "map";
}

export function getFlowNodeMotionState(mode: FlowMode, active: boolean): FlowNodeMotionState {
  if (active) {
    return {
      opacity: 1,
      scale: mode === "inside" ? 1.1 : 1.04,
      y: mode === "inside" ? -8 : mode === "entering" ? -2 : -2,
    };
  }

  return {
    opacity: 1,
    scale: mode === "map" ? 1.04 : 0.97,
    y: 0,
  };
}

export function createFlowWorkspaceFlow(activeId: FlowStepId): FlowWorkspaceFlow {
  const nodes = flowSteps.map((step) => ({
    id: step.id,
    type: "flowStep" as const,
    position: step.position,
    draggable: false as const,
    selectable: true as const,
    data: {
      ...step,
      status: step.id === activeId ? "active" as const : step.status,
      tone: step.id === activeId ? "blue" as const : step.tone,
      active: step.id === activeId,
    },
  }));

  const edges = flowLinks.map(([source, target, tone, kind]) => {
    const active = source === activeId || target === activeId;

    return {
      id: `${source}-${target}`,
      source,
      target,
      animated: active,
      type: "smoothstep" as const,
      data: { tone, active, kind },
      style: {
        stroke: flowToneStroke(tone, active, kind),
        strokeWidth: active ? 4.4 : kind === "support" ? 2.4 : 3.1,
      },
    };
  });

  return { nodes, edges };
}

function flowToneStroke(tone: PresentoTone, active: boolean, kind: FlowEdgeKind) {
  const alpha = active ? 0.94 : kind === "support" ? 0.42 : 0.58;

  return {
    blue: `rgba(16, 185, 129, ${alpha})`,
    gray: `rgba(100, 116, 139, ${alpha})`,
    orange: `rgba(223, 164, 74, ${alpha})`,
    green: `rgba(66, 184, 131, ${alpha})`,
    red: `rgba(224, 108, 117, ${alpha})`,
    purple: `rgba(139, 92, 246, ${alpha})`,
    cyan: `rgba(106, 159, 216, ${alpha})`,
  }[tone];
}
