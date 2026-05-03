"use client";

import {
  ArrowRight,
  Brain,
  FileText,
  MessageSquareText,
  Mic2,
  Radio,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AppFrame,
  Badge,
  CoachPanel,
  PageWrap,
  TopNav,
} from "@/components/presento-ui";
import { SigmaKnowledgeGraph } from "@/components/sigma-knowledge-graph";
import { demoKnowledgeNodes, demoProject } from "@/lib/demo-data";

const graphFilters = ["全部", "高危", "薄弱点", "PPT", "代码/数据", "我的负责"];

const highRiskQuestions = [
  "订单状态流转怎么设计？",
  "后厨接单后还能取消吗？",
  "这个模块是不是你负责的？",
];

const todayTasks = [
  "练第 2 页系统架构",
  "补数据库冗余字段解释",
  "完成一次 5 分钟模拟答辩",
];

export function KnowledgeMapView() {
  const [activeNodeId, setActiveNodeId] = useState("project");
  const activeNode = useMemo(
    () => demoKnowledgeNodes.find((node) => node.id === activeNodeId) ?? demoKnowledgeNodes[0],
    [activeNodeId],
  );
  const sigmaNodes = useMemo(
    () => demoKnowledgeNodes.map((node) => ({
      id: node.id,
      title: node.title,
      kind: node.id === "project" ? "project" : node.type.includes("资料") ? "file" : "module",
      tone: node.tone,
      summary: node.description,
    })),
    [],
  );
  const sigmaEdges = useMemo(
    () => demoKnowledgeNodes.slice(1).map((node) => ({
      id: `edge-project-${node.id}`,
      fromNodeId: "project",
      toNodeId: node.id,
      label: "知识关联",
    })),
    [],
  );

  return (
    <AppFrame>
      <TopNav />
      <PageWrap className="presento-map-page">
        <section className="presento-map-stage">
          <div className="min-h-full">
            <SigmaKnowledgeGraph
              activeId={activeNodeId}
              edges={sigmaEdges}
              nodes={sigmaNodes}
              onSelect={setActiveNodeId}
            />
          </div>

          <div className="presento-map-command-bar">
            <div className="min-w-0">
              <div className="text-xs font-black text-[var(--presento-blue-active)]">
                项目知识地图
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--presento-muted)]">
                <span>{demoProject.category}</span>
                <span>·</span>
                <span>{demoProject.deadline}</span>
                <Badge tone="orange">准备度 {demoProject.readiness}%</Badge>
                <Badge tone="orange">高危 8</Badge>
                <Badge tone="red">薄弱点 3</Badge>
              </div>
            </div>
            <Link className="presento-button-primary shrink-0" href="/projects/demo/defense">
              <Mic2 aria-hidden="true" />
              开始讲练
            </Link>
          </div>

          <div className="presento-graph-toolbar">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {graphFilters.map((filter) => (
                <button
                  className={filter === "全部" ? "presento-map-filter-active" : "presento-map-filter"}
                  key={filter}
                  type="button"
                >
                  {filter}
                </button>
              ))}
            </div>
            <label className="presento-map-search">
              <Search aria-hidden="true" />
              <input placeholder="搜索节点 / PPT 页 / 代码文件 / 风险问题" />
            </label>
          </div>

          <CoachPanel
            className="presento-map-coach"
            eyebrow="AI 教练"
            title={`当前节点：${activeNode.title}`}
            actions={
              <>
                <Link className="presento-button-primary" href="/projects/demo/defense">
                  <Mic2 aria-hidden="true" />
                  围绕此节点讲练
                </Link>
                <Link className="presento-button-secondary" href="/projects/demo/scripts">
                  <Brain aria-hidden="true" />
                  生成回答框架
                </Link>
                <Link className="presento-button-secondary" href="/projects/demo/deep-dive">
                  <ArrowRight aria-hidden="true" />
                  加入薄弱点钻研
                </Link>
              </>
            }
          >
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl border border-[var(--presento-border)] bg-[var(--presento-soft)] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black">
                  <FileText aria-hidden="true" />
                  证据链
                </div>
                <div className="flex flex-col gap-2">
                  {activeNode.evidence.map((item) => (
                    <div className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[var(--presento-muted)]" key={item}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--presento-border)] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black">
                  <MessageSquareText aria-hidden="true" />
                  高危追问
                </div>
                <div className="flex flex-col gap-2">
                  {highRiskQuestions.map((question, index) => (
                    <div
                      className="rounded-xl border border-[var(--presento-border)] bg-[var(--presento-warm)] px-3 py-2 text-sm font-bold text-[var(--presento-muted)]"
                      key={question}
                    >
                      {index + 1}. {question}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--presento-border)] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-black">
                  <Target aria-hidden="true" />
                  推荐动作
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeNode.actions.map((item) => (
                    <Badge tone="blue" key={item}>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Link className="presento-button-secondary justify-start" href="/projects/demo/scripts">
                  <Sparkles aria-hidden="true" />
                  生成逐页讲稿补强
                </Link>
                <Link className="presento-button-secondary justify-start" href="/projects/demo/pcg">
                  <Radio aria-hidden="true" />
                  输出 QQ / 微视 / 腾讯视频内容
                </Link>
              </div>
            </div>
          </CoachPanel>

          <div className="presento-today-strip">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles aria-hidden="true" className="text-[var(--presento-blue)]" />
              <span className="shrink-0 text-sm font-black">今日建议</span>
              <div className="flex min-w-0 flex-wrap gap-2">
                {todayTasks.map((task, index) => (
                  <span className="presento-today-task" key={task}>
                    {index + 1}. {task}
                  </span>
                ))}
              </div>
            </div>
            <Link className="presento-button-secondary shrink-0" href="/projects/demo/defense">
              开始第一项
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      </PageWrap>
    </AppFrame>
  );
}
