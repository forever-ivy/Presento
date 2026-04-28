"use client";

import { useEffect, useMemo } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
} from "@react-sigma/core";
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
          defaultEdgeColor: "#9fb3d9",
          defaultEdgeType: "line",
          labelDensity: 0.08,
          labelGridCellSize: 90,
          labelRenderedSizeThreshold: 8,
          renderEdgeLabels: false,
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

  useEffect(() => {
    const graph = new Graph();
    nodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1);
      const isActive = node.id === activeId;
      graph.addNode(node.id, {
        label: node.title,
        x: Math.cos(angle) * (index === 0 ? 0.2 : 6),
        y: Math.sin(angle) * (index === 0 ? 0.2 : 6),
        size: isActive ? 18 : node.kind === "file" ? 13 : 10,
        color: colorForTone(node.tone, isActive),
        borderColor: isActive ? "#0b1220" : "#ffffff",
        kind: node.kind,
      });
    });

    edges.forEach((edge, index) => {
      if (!graph.hasNode(edge.fromNodeId) || !graph.hasNode(edge.toNodeId)) return;
      graph.addEdgeWithKey(edge.id ?? `edge-${index}`, edge.fromNodeId, edge.toNodeId, {
        label: edge.label,
        size: 1.4,
        color: "#b4c1d8",
      });
    });

    if (graph.order > 1) {
      forceAtlas2.assign(graph, {
        iterations: 80,
        settings: {
          adjustSizes: true,
          barnesHutOptimize: true,
          gravity: 0.8,
          scalingRatio: 8,
          slowDown: 8,
        },
      });
    }

    loadGraph(graph);
  }, [activeId, edges, loadGraph, nodes]);

  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => onSelect?.(node),
    });
  }, [onSelect, registerEvents]);

  return null;
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

function colorForTone(tone: SigmaKnowledgeNode["tone"], active: boolean) {
  if (active) return "#f59e0b";
  if (tone === "green") return "#16a34a";
  if (tone === "purple") return "#7c3aed";
  if (tone === "orange") return "#ea580c";
  if (tone === "red") return "#dc2626";
  if (tone === "cyan") return "#0891b2";
  if (tone === "gray") return "#64748b";
  return "#2563eb";
}
