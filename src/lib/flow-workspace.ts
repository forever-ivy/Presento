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
  status: FlowStepStatus;
  tone: PresentoTone;
  position: { x: number; y: number };
};

export type FlowWorkspaceNodeData = FlowStep & {
  active: boolean;
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
  data: { tone: PresentoTone; active: boolean };
  style: { stroke: string; strokeWidth: number };
};

export type FlowWorkspaceFlow = {
  nodes: FlowWorkspaceNode[];
  edges: FlowWorkspaceEdge[];
};

export const flowSteps: FlowStep[] = [
  {
    id: "files",
    route: "/projects/demo/files",
    label: "资料导入",
    shortLabel: "上传",
    summary: "已上传资料、继续上传、解析进度和证据链入口。",
    status: "completed",
    tone: "green",
    position: { x: -980, y: -160 },
  },
  {
    id: "knowledge",
    route: "/projects/demo/knowledge-map",
    label: "知识地图",
    shortLabel: "地图",
    summary: "项目结构、证据链、高危追问和薄弱点回流。",
    status: "active",
    tone: "blue",
    position: { x: -440, y: -160 },
  },
  {
    id: "scripts",
    route: "/projects/demo/scripts",
    label: "逐页讲稿",
    shortLabel: "讲稿",
    summary: "PPT 页、讲稿版本、关键词和当前页追问。",
    status: "pending",
    tone: "cyan",
    position: { x: 100, y: -160 },
  },
  {
    id: "defense",
    route: "/projects/demo/defense",
    label: "模拟讲练",
    shortLabel: "讲练",
    summary: "对着 PPT 当前页实时追问，支持文本和语音入口。",
    status: "risk",
    tone: "orange",
    position: { x: 640, y: -160 },
  },
  {
    id: "review",
    route: "/projects/demo/review",
    label: "复盘报告",
    shortLabel: "复盘",
    summary: "训练得分、问题暴露、下一轮任务和内容再创作。",
    status: "pending",
    tone: "purple",
    position: { x: 1180, y: -160 },
  },
  {
    id: "deepDive",
    route: "/projects/demo/deep-dive",
    label: "薄弱点钻研",
    shortLabel: "钻研",
    summary: "拆解答不上来的问题，再回流到知识地图和讲练。",
    status: "weakness",
    tone: "red",
    position: { x: 640, y: 340 },
  },
  {
    id: "skills",
    route: "/projects/demo/skills",
    label: "Agent Skills",
    shortLabel: "Skills",
    summary: "管理能力包、调用日志和模型 fallback 状态。",
    status: "capability",
    tone: "purple",
    position: { x: -440, y: 340 },
  },
  {
    id: "pcg",
    route: "/projects/demo/pcg",
    label: "PCG 连接",
    shortLabel: "输出",
    summary: "输出 QQ 小组群、微视和腾讯视频内容。",
    status: "output",
    tone: "cyan",
    position: { x: 1180, y: 340 },
  },
];

const routeAliases = new Map<string, FlowStepId>([
  ["/", "knowledge"],
  ["/projects/demo/knowledge-map", "knowledge"],
  ...flowSteps.map((step) => [step.route, step.id] as const),
]);

const flowLinks: Array<[FlowStepId, FlowStepId, PresentoTone]> = [
  ["files", "knowledge", "green"],
  ["knowledge", "scripts", "blue"],
  ["scripts", "defense", "cyan"],
  ["defense", "review", "orange"],
  ["review", "deepDive", "red"],
  ["deepDive", "knowledge", "red"],
  ["skills", "files", "purple"],
  ["skills", "knowledge", "purple"],
  ["skills", "defense", "purple"],
  ["review", "pcg", "cyan"],
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

  const edges = flowLinks.map(([source, target, tone]) => {
    const active = source === activeId || target === activeId;

    return {
      id: `${source}-${target}`,
      source,
      target,
      animated: active,
      type: "smoothstep" as const,
      data: { tone, active },
      style: {
        stroke: flowToneStroke(tone, active),
        strokeWidth: active ? 2.8 : 1.6,
      },
    };
  });

  return { nodes, edges };
}

function flowToneStroke(tone: PresentoTone, active: boolean) {
  const alpha = active ? 0.86 : 0.34;

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
