import type { KnowledgeNodeView, PresentoTone } from "@/components/presento-ui";

export type KnowledgeMapFlowNodeData = {
  title: string;
  type: string;
  tone: PresentoTone;
  risk: string;
  description: string;
  evidence: string[];
  actions: string[];
  active: boolean;
};

export type KnowledgeMapFlowNode = {
  id: string;
  type: "knowledgeCard";
  position: { x: number; y: number };
  draggable: false;
  selectable: true;
  data: KnowledgeMapFlowNodeData;
};

export type KnowledgeMapFlowEdge = {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  type: "smoothstep";
  data?: { tone: PresentoTone };
};

export type KnowledgeMapFlow = {
  nodes: KnowledgeMapFlowNode[];
  edges: KnowledgeMapFlowEdge[];
};

const CENTER_X = 50;
const CENTER_Y = 47;
const HORIZONTAL_SCALE = 14;
const VERTICAL_SCALE = 12;

const SIMULATED_LINKS: Array<[string, string, PresentoTone]> = [
  ["project", "ppt", "cyan"],
  ["project", "code", "purple"],
  ["project", "db", "green"],
  ["project", "risk", "orange"],
  ["project", "weakness", "red"],
  ["ppt", "risk", "orange"],
  ["code", "risk", "orange"],
  ["db", "weakness", "red"],
];

export function createKnowledgeMapFlow(
  knowledgeNodes: KnowledgeNodeView[],
  activeId = "project",
): KnowledgeMapFlow {
  const nodes = knowledgeNodes.map((node) => ({
    id: node.id,
    type: "knowledgeCard" as const,
    position: {
      x: Math.round((node.x - CENTER_X) * HORIZONTAL_SCALE),
      y: Math.round((node.y - CENTER_Y) * VERTICAL_SCALE),
    },
    draggable: false as const,
    selectable: true as const,
    data: {
      title: node.title,
      type: node.type,
      tone: node.tone,
      risk: node.risk,
      description: node.description,
      evidence: node.evidence,
      actions: node.actions,
      active: node.id === activeId,
    },
  }));

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = SIMULATED_LINKS.filter(([source, target]) => {
    return nodeIds.has(source) && nodeIds.has(target);
  }).map(([source, target, tone]) => ({
    id: `${source}-${target}`,
    source,
    target,
    animated: source === activeId || target === activeId,
    type: "smoothstep" as const,
    data: { tone },
  }));

  return { nodes, edges };
}
