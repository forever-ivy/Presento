import type {
  KnowledgeMapEdgeUi,
  KnowledgeMapNodeUi,
  KnowledgeMapUi,
} from "./knowledge-map-client.ts";

export type KnowledgeMapSceneNode = KnowledgeMapNodeUi & {
  order: number;
  graphDepth: number;
  depth: 0 | 1 | 2 | 3;
  layoutRing: number | null;
  parentIds: string[];
  childIds: string[];
  sceneParentIds: string[];
  sceneChildIds: string[];
  branchIds: string[];
  branchId: string;
  expandable: boolean;
  childCount: number;
};

export type KnowledgeMapSceneEdge = KnowledgeMapEdgeUi & {
  order: number;
};

export type KnowledgeMapScene = {
  projectId: string;
  rootId: string;
  nodes: KnowledgeMapSceneNode[];
  nodesById: Record<string, KnowledgeMapSceneNode>;
  edges: KnowledgeMapSceneEdge[];
  edgesById: Record<string, KnowledgeMapSceneEdge>;
};

export type KnowledgeMapSceneRenderNode = {
  id: string;
  title: string;
  kind: KnowledgeMapSceneNode["kind"];
  tone: KnowledgeMapSceneNode["tone"];
  summary: string;
  dimmed: boolean;
  active: boolean;
  depth: KnowledgeMapSceneNode["depth"];
  branchId: string;
  expandable: boolean;
  expanded: boolean;
  childCount: number;
  position: { x: number; y: number };
  path: string[];
  node: KnowledgeMapSceneNode;
};

export type KnowledgeMapSceneRenderEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  kind?: string;
  active: boolean;
  emphasis: "default" | "branch" | "active";
  edge: KnowledgeMapSceneEdge;
};

export type ProjectKnowledgeMapScene = {
  nodes: KnowledgeMapSceneRenderNode[];
  edges: KnowledgeMapSceneRenderEdge[];
  autoExpandedBranchIds: Set<string>;
};

export function buildKnowledgeMapScene(map: KnowledgeMapUi): KnowledgeMapScene {
  const rootId = map.nodes.find((node) => node.kind === "project")?.id ?? map.nodes[0]?.id ?? "project";
  const outgoing = createAdjacency(map.edges, "fromNodeId");
  const incoming = createAdjacency(map.edges, "toNodeId");
  const graphDepth = deriveGraphDepth(rootId, outgoing);

  const nodes = map.nodes.map((node, order) => {
    const depth = deriveSceneDepth(node, node.id === rootId, graphDepth[node.id], readLayoutRing(node));
    return {
      ...node,
      order,
      graphDepth: graphDepth[node.id] ?? Number.POSITIVE_INFINITY,
      depth,
      layoutRing: readLayoutRing(node),
      parentIds: (incoming[node.id] ?? []).map((edge) => edge.fromNodeId),
      childIds: (outgoing[node.id] ?? []).map((edge) => edge.toNodeId),
      sceneParentIds: [] as string[],
      sceneChildIds: [] as string[],
      branchIds: [] as string[],
      branchId: node.id,
      expandable: false as boolean,
      childCount: 0,
    } satisfies KnowledgeMapSceneNode;
  });

  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node] as const));

  for (const node of nodes) {
    node.sceneParentIds = deriveSceneParents(node, nodesById, incoming, rootId);
    node.branchIds = deriveBranchIds(node, nodesById, incoming);
    node.branchId = node.depth === 1 ? node.id : node.branchIds[0] ?? rootId;
  }

  for (const node of nodes) {
    if (node.depth === 0) continue;
    for (const sceneParentId of node.sceneParentIds) {
      const sceneParent = nodesById[sceneParentId];
      if (!sceneParent) continue;
      sceneParent.sceneChildIds.push(node.id);
    }
  }

  for (const node of nodes) {
    node.sceneChildIds = uniqueSorted(node.sceneChildIds, nodesById);
    node.expandable = node.depth === 1 && node.sceneChildIds.some((childId) => nodesById[childId]?.depth === 2);
    node.childCount = node.sceneChildIds.filter((childId) => nodesById[childId]?.depth === node.depth + 1).length;
  }

  const edges = map.edges.map((edge, order) => ({
    ...edge,
    order,
  }));
  const edgesById = Object.fromEntries(edges.map((edge) => [edge.id, edge] as const));

  return {
    projectId: map.projectId,
    rootId,
    nodes: nodes.toSorted((left, right) => left.order - right.order),
    nodesById,
    edges,
    edgesById,
  };
}

export function projectKnowledgeMapScene(
  scene: KnowledgeMapScene,
  options: {
    activeNodeId: string;
    expandedBranchIds: Set<string>;
    filter: string;
    query: string;
  },
): ProjectKnowledgeMapScene {
  const activeNode = scene.nodesById[options.activeNodeId] ?? scene.nodesById[scene.rootId];
  const manualExpandedBranchIds = new Set(
    [...options.expandedBranchIds].filter((branchId) => scene.nodesById[branchId]?.depth === 1),
  );
  const matches = collectMatches(scene, options.filter, options.query);
  const hasScopedSearch = options.filter !== "all" || options.query.trim().length > 0;
  const autoExpandedBranchIds = new Set<string>();

  const visibleIds = hasScopedSearch
    ? collectScopedVisibleIds(scene, activeNode.id, matches, autoExpandedBranchIds)
    : collectBaseVisibleIds(scene, activeNode.id, manualExpandedBranchIds);

  const effectiveExpandedBranchIds = new Set([
    ...manualExpandedBranchIds,
    ...autoExpandedBranchIds,
  ]);

  if (!hasScopedSearch) {
    // Base visibility depends on the branch expansion state, but we still expose the effective branch set
    // so the UI can render consistent expand markers after query-driven projections.
    autoExpandedBranchIds.clear();
  }

  const positionedNodes = layoutVisibleNodes(scene, visibleIds);
  const highlightedIds = collectHighlightIds(scene, activeNode.id);
  const activeBranchIds = new Set(activeNode.branchIds);

  const nodes = positionedNodes.map((node) => ({
    id: node.id,
    title: node.title,
    kind: node.kind,
    tone: node.tone,
    summary: node.summary,
    active: node.id === activeNode.id,
    depth: node.depth,
    branchId: node.branchId,
    expandable: node.expandable,
    expanded: effectiveExpandedBranchIds.has(node.id),
    childCount: node.childCount,
    dimmed: activeNode.id !== scene.rootId
      && !highlightedIds.has(node.id)
      && (node.depth === 0 || !node.branchIds.some((branchId) => activeBranchIds.has(branchId))),
    position: node.position,
    path: collectPathTitles(scene, node.id),
    node,
  }));

  const visibleIdSet = new Set(nodes.map((node) => node.id));
  const activeLineIds = new Set(collectActualPathIds(scene, activeNode.id));
  const edges = scene.edges
    .filter((edge) => visibleIdSet.has(edge.fromNodeId) && visibleIdSet.has(edge.toNodeId))
    .map((edge) => {
      const fromNode = scene.nodesById[edge.fromNodeId];
      const toNode = scene.nodesById[edge.toNodeId];
      const sharesBranch = fromNode?.branchId === toNode?.branchId;
      const isActive = activeLineIds.has(edge.id) || edge.fromNodeId === activeNode.id || edge.toNodeId === activeNode.id;
      return {
        id: edge.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        label: edge.label,
        kind: edge.kind,
        active: isActive,
        emphasis: isActive ? "active" : sharesBranch ? "branch" : "default",
        edge,
      } satisfies KnowledgeMapSceneRenderEdge;
    });

  return {
    nodes,
    edges,
    autoExpandedBranchIds,
  };
}

function collectMatches(scene: KnowledgeMapScene, filter: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (filter === "all" && !normalizedQuery) return new Set<string>();

  const matches = new Set<string>();

  for (const node of scene.nodes) {
    if (!matchesFilter(node, filter)) continue;
    if (!matchesQuery(node, normalizedQuery)) continue;
    matches.add(node.id);
  }

  return matches;
}

function collectScopedVisibleIds(
  scene: KnowledgeMapScene,
  activeNodeId: string,
  matches: Set<string>,
  autoExpandedBranchIds: Set<string>,
) {
  const visibleIds = new Set<string>([scene.rootId]);

  for (const nodeId of matches) {
    visibleIds.add(nodeId);
    for (const ancestorId of collectSceneAncestors(scene, nodeId)) {
      visibleIds.add(ancestorId);
    }
    const node = scene.nodesById[nodeId];
    if (!node) continue;
    for (const branchId of node.branchIds) {
      autoExpandedBranchIds.add(branchId);
    }
  }

  visibleIds.add(activeNodeId);
  for (const ancestorId of collectSceneAncestors(scene, activeNodeId)) {
    visibleIds.add(ancestorId);
  }

  return visibleIds;
}

function collectBaseVisibleIds(
  scene: KnowledgeMapScene,
  activeNodeId: string,
  expandedBranchIds: Set<string>,
) {
  const visibleIds = new Set<string>();

  for (const node of scene.nodes) {
    if (node.depth <= 1) {
      visibleIds.add(node.id);
      continue;
    }

    if (node.depth === 2 && node.branchIds.some((branchId) => expandedBranchIds.has(branchId))) {
      visibleIds.add(node.id);
      continue;
    }

    if (node.depth === 3) {
      const parentVisible = node.sceneParentIds.some((parentId) => visibleIds.has(parentId));
      const focused = node.id === activeNodeId || node.sceneParentIds.includes(activeNodeId);
      if (parentVisible && focused) {
        visibleIds.add(node.id);
      }
    }
  }

  return visibleIds;
}

function layoutVisibleNodes(scene: KnowledgeMapScene, visibleIds: Set<string>) {
  const positioned = new Map<string, { x: number; y: number }>();
  const visibleNodes = scene.nodes.filter((node) => visibleIds.has(node.id));
  const depthOneNodes = visibleNodes.filter((node) => node.depth === 1).toSorted(compareSceneNodes);
  const depthOneAngles = new Map<string, number>();

  positioned.set(scene.rootId, { x: 1.25, y: 0 });

  if (depthOneNodes.length === 1) {
    depthOneAngles.set(depthOneNodes[0].id, Math.PI);
  } else {
    const start = degreesToRadians(150);
    const end = degreesToRadians(-150);
    const steps = Math.max(depthOneNodes.length - 1, 1);

    depthOneNodes.forEach((node, index) => {
      const angle = start + ((end - start) * index) / steps;
      depthOneAngles.set(node.id, angle);
    });
  }

  for (const node of depthOneNodes) {
    const angle = depthOneAngles.get(node.id) ?? Math.PI;
    positioned.set(node.id, {
      x: 1.25 + Math.cos(angle) * 7.4,
      y: Math.sin(angle) * 5.6,
    });
  }

  for (const branchNode of depthOneNodes) {
    const branchAngle = depthOneAngles.get(branchNode.id) ?? Math.PI;
    const children = visibleNodes
      .filter((node) => node.depth === 2 && node.branchIds.includes(branchNode.id))
      .toSorted(compareSceneNodes);
    const spread = children.length <= 1 ? 0 : Math.min(0.78, 0.24 * (children.length - 1));

    children.forEach((child, index) => {
      const offset = children.length <= 1
        ? 0
        : ((index / (children.length - 1)) - 0.5) * spread;
      const angle = branchAngle + offset;
      positioned.set(child.id, {
        x: 1.25 + Math.cos(angle) * 11.2,
        y: Math.sin(angle) * 8.5,
      });
    });
  }

  const depthThreeNodes = visibleNodes.filter((node) => node.depth === 3).toSorted(compareSceneNodes);
  for (const node of depthThreeNodes) {
    const parentAngles = node.sceneParentIds
      .map((parentId) => positioned.get(parentId))
      .filter((value): value is { x: number; y: number } => Boolean(value))
      .map((position) => Math.atan2(position.y, position.x - 1.25));
    const angle = parentAngles.length ? averageAngles(parentAngles) : degreesToRadians(90);
    positioned.set(node.id, {
      x: 1.25 + Math.cos(angle) * 13.2,
      y: Math.sin(angle) * 10.1,
    });
  }

  return visibleNodes.map((node) => ({
    ...node,
    position: positioned.get(node.id) ?? { x: 1.25, y: 0 },
  }));
}

function deriveSceneDepth(
  node: KnowledgeMapNodeUi,
  isRoot: boolean,
  graphDepth: number | undefined,
  layoutRing: number | null,
): 0 | 1 | 2 | 3 {
  if (isRoot || node.kind === "project") return 0;
  if (node.kind === "training") return 3;
  if (typeof graphDepth === "number" && Number.isFinite(graphDepth)) {
    return graphDepth <= 1 ? 1 : 2;
  }
  if (layoutRing !== null) {
    if (layoutRing <= 1) return 1;
    return layoutRing >= 4 ? 3 : 2;
  }
  return 2;
}

function deriveSceneParents(
  node: KnowledgeMapSceneNode,
  nodesById: Record<string, KnowledgeMapSceneNode>,
  incoming: Record<string, KnowledgeMapEdgeUi[]>,
  rootId: string,
) {
  if (node.depth === 0) return [] as string[];
  if (node.depth === 1) return [rootId];

  const targetDepth = (node.depth - 1) as 1 | 2;
  const results = collectNearestAncestors(node.id, targetDepth, incoming, nodesById);
  if (results.length) return results;

  if (node.parentIds.length) return uniqueSorted(node.parentIds, nodesById);
  return [rootId];
}

function deriveBranchIds(
  node: KnowledgeMapSceneNode,
  nodesById: Record<string, KnowledgeMapSceneNode>,
  incoming: Record<string, KnowledgeMapEdgeUi[]>,
) {
  if (node.depth === 0) return [] as string[];
  if (node.depth === 1) return [node.id];

  const results = collectNearestAncestors(node.id, 1, incoming, nodesById);
  if (results.length) return results;

  if (node.sceneParentIds.length) {
    return uniqueSorted(
      node.sceneParentIds.flatMap((parentId) => nodesById[parentId]?.branchIds ?? []),
      nodesById,
    );
  }

  return [] as string[];
}

function collectNearestAncestors(
  startId: string,
  targetDepth: 1 | 2,
  incoming: Record<string, KnowledgeMapEdgeUi[]>,
  nodesById: Record<string, KnowledgeMapSceneNode>,
) {
  let queue = [startId];
  const visited = new Set<string>(queue);
  const results = new Set<string>();

  while (queue.length && results.size === 0) {
    const nextQueue: string[] = [];
    for (const currentId of queue) {
      const parents = incoming[currentId] ?? [];
      for (const edge of parents) {
        const parentId = edge.fromNodeId;
        if (visited.has(parentId)) continue;
        visited.add(parentId);
        const parent = nodesById[parentId];
        if (!parent) continue;
        if (parent.depth === targetDepth) {
          results.add(parentId);
          continue;
        }
        nextQueue.push(parentId);
      }
    }
    queue = nextQueue;
  }

  return uniqueSorted([...results], nodesById);
}

function collectSceneAncestors(scene: KnowledgeMapScene, nodeId: string) {
  const results = new Set<string>();
  const stack = [...(scene.nodesById[nodeId]?.sceneParentIds ?? [])];

  while (stack.length) {
    const currentId = stack.pop();
    if (!currentId || results.has(currentId)) continue;
    results.add(currentId);
    for (const parentId of scene.nodesById[currentId]?.sceneParentIds ?? []) {
      if (!results.has(parentId)) stack.push(parentId);
    }
  }

  return results;
}

function collectHighlightIds(scene: KnowledgeMapScene, activeNodeId: string) {
  const activeNode = scene.nodesById[activeNodeId];
  if (!activeNode) return new Set<string>([scene.rootId]);

  const highlighted = new Set<string>([activeNodeId]);

  for (const ancestorId of collectSceneAncestors(scene, activeNodeId)) {
    highlighted.add(ancestorId);
  }

  for (const childId of activeNode.sceneChildIds) {
    highlighted.add(childId);
  }

  for (const branchId of activeNode.branchIds) {
    highlighted.add(branchId);
  }

  highlighted.add(scene.rootId);

  return highlighted;
}

function collectActualPathIds(scene: KnowledgeMapScene, activeNodeId: string) {
  const pathIds = new Set<string>();
  const activeNode = scene.nodesById[activeNodeId];
  if (!activeNode) return pathIds;

  const stack = [...activeNode.parentIds];
  while (stack.length) {
    const parentId = stack.pop();
    if (!parentId || pathIds.has(parentId)) continue;
    pathIds.add(parentId);
    for (const nextParentId of scene.nodesById[parentId]?.parentIds ?? []) {
      if (!pathIds.has(nextParentId)) stack.push(nextParentId);
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of scene.edges) {
    if (edge.toNodeId === activeNodeId && pathIds.has(edge.fromNodeId)) {
      edgeIds.add(edge.id);
    }
    if (pathIds.has(edge.toNodeId) && pathIds.has(edge.fromNodeId)) {
      edgeIds.add(edge.id);
    }
  }

  return edgeIds;
}

function collectPathTitles(scene: KnowledgeMapScene, nodeId: string): string[] {
  const node = scene.nodesById[nodeId];
  if (!node) return [] as string[];
  if (node.depth === 0) return [node.title];

  const parentId = node.sceneParentIds[0];
  if (!parentId) return [scene.nodesById[scene.rootId]?.title ?? "项目中心", node.title];

  return [...collectPathTitles(scene, parentId), node.title];
}

function createAdjacency(
  edges: KnowledgeMapEdgeUi[],
  direction: "fromNodeId" | "toNodeId",
) {
  const adjacency: Record<string, KnowledgeMapEdgeUi[]> = {};

  for (const edge of edges) {
    const key = edge[direction];
    adjacency[key] ??= [];
    adjacency[key].push(edge);
  }

  return adjacency;
}

function deriveGraphDepth(rootId: string, outgoing: Record<string, KnowledgeMapEdgeUi[]>) {
  const depthById: Record<string, number> = {
    [rootId]: 0,
  };
  const queue = [rootId];

  while (queue.length) {
    const currentId = queue.shift();
    if (!currentId) continue;
    const currentDepth = depthById[currentId] ?? 0;
    for (const edge of outgoing[currentId] ?? []) {
      if (depthById[edge.toNodeId] !== undefined) continue;
      depthById[edge.toNodeId] = currentDepth + 1;
      queue.push(edge.toNodeId);
    }
  }

  return depthById;
}

function matchesFilter(node: KnowledgeMapSceneNode, filter: string) {
  if (filter === "all") return true;
  if (filter === "risk") return node.kind === "risk" || node.riskLevel === "high";
  if (filter === "weakness") return node.kind === "weakness";
  if (filter === "file") return node.kind === "file";
  if (filter === "training") return node.kind === "training";
  return true;
}

function matchesQuery(node: KnowledgeMapSceneNode, normalizedQuery: string) {
  if (!normalizedQuery) return true;

  return [
    node.title,
    node.summary,
    node.kind,
    node.fileKind,
    ...node.evidence,
    ...node.relatedFiles,
    ...node.relatedSlides,
    ...node.riskQuestions,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function readLayoutRing(node: KnowledgeMapNodeUi) {
  const layout = node.raw.metadata.layout;
  if (!layout || typeof layout !== "object") return null;
  const ring = (layout as { ring?: unknown }).ring;
  return typeof ring === "number" && Number.isFinite(ring) ? ring : null;
}

function uniqueSorted(values: string[], nodesById: Record<string, { order: number }>) {
  return [...new Set(values)].toSorted((left, right) => {
    return (nodesById[left]?.order ?? Number.MAX_SAFE_INTEGER) - (nodesById[right]?.order ?? Number.MAX_SAFE_INTEGER);
  });
}

function compareSceneNodes(left: KnowledgeMapSceneNode, right: KnowledgeMapSceneNode) {
  if (left.childCount !== right.childCount) return right.childCount - left.childCount;
  return left.order - right.order;
}

function averageAngles(angles: number[]) {
  const totals = angles.reduce(
    (accumulator, angle) => {
      accumulator.sin += Math.sin(angle);
      accumulator.cos += Math.cos(angle);
      return accumulator;
    },
    { sin: 0, cos: 0 },
  );

  return Math.atan2(totals.sin, totals.cos);
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}
