"use client";

import { useEffect, useMemo, useRef } from "react";
import Graph from "graphology";
import {
  SigmaContainer,
  useSigma,
  useLoadGraph,
  useRegisterEvents,
} from "@react-sigma/core";
import type { NodeHoverDrawingFunction } from "sigma/rendering";
import type {
  SigmaKnowledgeEdge,
  SigmaKnowledgeGraphProps,
  SigmaKnowledgeNode,
} from "./sigma-knowledge-graph";

export default function SigmaKnowledgeGraphInner({
  nodes,
  edges,
  activeId,
  onSelect,
  className,
}: SigmaKnowledgeGraphProps) {
  const normalizedEdges = useMemo(() => edges?.length ? edges : inferEdges(nodes), [edges, nodes]);

  return (
    <div className={className} style={{ height: "100%", minHeight: 460 }}>
      <SigmaContainer
        graph={Graph}
        settings={{
          allowInvalidContainer: true,
          defaultEdgeColor: "rgba(55, 65, 81, 0.52)",
          defaultEdgeType: "line",
          labelColor: { color: "#52606d" },
          labelDensity: 0.08,
          labelFont: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          labelGridCellSize: 112,
          labelRenderedSizeThreshold: 8,
          labelWeight: "600",
          defaultDrawNodeHover: drawNodeOnlyHover,
          renderEdgeLabels: false,
          minCameraRatio: 0.56,
          maxCameraRatio: 1.9,
        }}
        style={{ height: "100%", width: "100%" }}
      >
        <GraphLoader
          activeId={activeId}
          edges={normalizedEdges}
          nodes={nodes}
          onSelect={onSelect}
        />
      </SigmaContainer>
    </div>
  );
}

const drawNodeOnlyHover: NodeHoverDrawingFunction = (context, data) => {
  context.save();

  context.beginPath();
  context.arc(data.x, data.y, data.size + 5, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "rgba(71, 85, 105, 0.72)";
  context.stroke();

  context.beginPath();
  context.arc(data.x, data.y, data.size + 0.5, 0, Math.PI * 2);
  context.fillStyle = data.color;
  context.fill();

  context.restore();
};

function GraphLoader({
  nodes,
  edges,
  activeId,
  onSelect,
}: {
  nodes: SigmaKnowledgeNode[];
  edges: SigmaKnowledgeEdge[];
  activeId?: string;
  onSelect?: (nodeId: string) => void;
}) {
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  const hasPositionedCameraRef = useRef(false);
  const previousCameraNodeIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const graph = new Graph();
    nodes.forEach((node) => {
      const isActive = node.id === activeId || Boolean(node.active);
      const isCenter = node.kind === "project";
      const nodeSize = sizeForNode(node, isActive);

      graph.addNode(node.id, {
        label: labelForNode(node),
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        size: nodeSize,
        color: museumNodeColor(node, isActive, isCenter),
        forceLabel: (node.depth ?? 2) <= 1 || isActive || Boolean(node.expandable),
        kind: node.kind,
        zIndex: isActive ? 3 : isCenter ? 2 : 1,
      });
    });

    edges.forEach((edge, index) => {
      if (!graph.hasNode(edge.fromNodeId) || !graph.hasNode(edge.toNodeId)) return;
      graph.addEdgeWithKey(edge.id ?? `edge-${index}`, edge.fromNodeId, edge.toNodeId, {
        label: edge.label,
        size: edge.emphasis === "active" ? 2.8 : edge.emphasis === "branch" ? 1.45 : 0.9,
        color: edgeColor(edge),
        zIndex: edge.emphasis === "active" ? 2 : 1,
      });
    });

    loadGraph(graph);
  }, [activeId, edges, loadGraph, nodes]);

  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => onSelect?.(node),
    });
  }, [onSelect, registerEvents]);

  useEffect(() => {
    const activeNode = nodes.find((node) => node.id === activeId) ?? nodes[0];
    if (!activeNode) return;
    const cameraTarget = cameraTargetForNode(nodes, activeNode);
    const cameraState = {
      x: cameraTarget.x,
      y: cameraTarget.y,
      ratio: cameraRatioForNode(activeNode),
    };
    const camera = sigma.getCamera();

    if (!hasPositionedCameraRef.current) {
      camera.setState(cameraState);
      hasPositionedCameraRef.current = true;
      previousCameraNodeIdRef.current = activeNode.id;
      return;
    }

    if (previousCameraNodeIdRef.current === activeNode.id) {
      camera.setState(cameraState);
      return;
    }

    previousCameraNodeIdRef.current = activeNode.id;
    void camera.animate(cameraState, { duration: 360 });
  }, [activeId, nodes, sigma]);

  return null;
}

function cameraTargetForNode(nodes: SigmaKnowledgeNode[], node: SigmaKnowledgeNode) {
  const positionedNodes = nodes
    .map((item) => item.position)
    .filter((position): position is { x: number; y: number } => Boolean(position));
  const target = node.position ?? positionedNodes[0] ?? { x: 0, y: 0 };
  if (!positionedNodes.length) return { x: 0.5, y: 0.5 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  positionedNodes.forEach((position) => {
    minX = Math.min(minX, position.x);
    maxX = Math.max(maxX, position.x);
    minY = Math.min(minY, position.y);
    maxY = Math.max(maxY, position.y);
  });

  const ratio = Math.max(maxX - minX, maxY - minY) || 1;
  const centerX = (maxX + minX) / 2;
  const centerY = (maxY + minY) / 2;

  return {
    x: 0.5 + (target.x - centerX) / ratio,
    y: 0.5 + (target.y - centerY) / ratio,
  };
}

function inferEdges(nodes: SigmaKnowledgeNode[]): SigmaKnowledgeEdge[] {
  const center = nodes.find((node) => node.kind === "project") ?? nodes[0];
  if (!center) return [];
  return nodes
    .filter((node) => node.id !== center.id)
    .map((node) => ({
      id: `edge-${center.id}-${node.id}`,
      fromNodeId: center.id,
      toNodeId: node.id,
      label: "关联",
    }));
}

function labelForNode(node: SigmaKnowledgeNode) {
  const title = compactNodeTitle(node);
  if (!node.expandable || !node.childCount) return title;
  return `${title}  +${node.childCount}`;
}

function sizeForNode(node: SigmaKnowledgeNode, active: boolean) {
  if (node.kind === "project") return active ? 31 : 28;
  if (node.depth === 1) return active ? 15 : node.expandable ? 13.6 : 12;
  if (node.depth === 2) return active ? 10.8 : 7.6;
  return active ? 9.2 : 6.9;
}

function cameraRatioForNode(node: SigmaKnowledgeNode) {
  if (node.depth === 0) return 1.42;
  if (node.depth === 1) return 1.55;
  if (node.depth === 3) return 1.22;
  return 1.38;
}

function museumNodeColor(
  node: SigmaKnowledgeNode,
  active: boolean,
  isCenter?: boolean,
) {
  if (isCenter) return active ? "#10b981" : "#14b8a6";
  if (active) return "#10b981";
  if (node.dimmed) return "#64748b";
  if (node.expanded) return "rgba(31, 119, 180, 0.96)";
  if (node.tone === "green") return "#2a93a3";
  if (node.tone === "purple") return "#3c81c7";
  if (node.tone === "orange") return "#d89d4d";
  if (node.tone === "red") return "#cb6d5e";
  if (node.tone === "cyan") return "#67a7cf";
  if (node.tone === "gray") return "#9ba4b2";
  return "#4c91bc";
}

function edgeColor(edge: SigmaKnowledgeEdge) {
  if (edge.emphasis === "active") return "rgba(3, 105, 161, 1)";
  if (edge.emphasis === "branch") return "rgba(71, 85, 105, 0.42)";
  return "rgba(100, 116, 139, 0.26)";
}

function compactNodeTitle(node: SigmaKnowledgeNode) {
  const depth = node.depth ?? 2;
  if (depth <= 1) return truncateMiddle(node.title, 28);
  const leafName = node.title.split(/[\\/]/).filter(Boolean).pop() ?? node.title;
  return truncateMiddle(leafName, depth === 2 ? 24 : 20);
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const leftLength = Math.ceil((maxLength - 1) * 0.58);
  const rightLength = Math.floor((maxLength - 1) * 0.42);
  return `${value.slice(0, leftLength)}…${value.slice(value.length - rightLength)}`;
}
