"use client";

import dynamic from "next/dynamic";

export type SigmaKnowledgeNode = {
  id: string;
  title: string;
  kind?: string;
  tone?: "blue" | "gray" | "orange" | "green" | "red" | "purple" | "cyan";
  summary?: string;
  metadata?: Record<string, unknown>;
};

export type SigmaKnowledgeEdge = {
  id?: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
};

export type SigmaKnowledgeGraphProps = {
  nodes: SigmaKnowledgeNode[];
  edges?: SigmaKnowledgeEdge[];
  activeId?: string;
  onSelect?: (nodeId: string) => void;
  className?: string;
};

const ClientOnlySigmaKnowledgeGraph = dynamic(
  () => import("./sigma-knowledge-graph-inner"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[460px] items-center justify-center rounded-[2rem] border border-slate-200 bg-white/70 text-sm font-bold text-slate-500">
        正在加载知识图谱...
      </div>
    ),
  },
);

export function SigmaKnowledgeGraph(props: SigmaKnowledgeGraphProps) {
  return <ClientOnlySigmaKnowledgeGraph {...props} />;
}
