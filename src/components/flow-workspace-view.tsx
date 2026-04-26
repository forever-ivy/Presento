"use client";

import {
  Bot,
  CheckCircle2,
  Code,
  FileQuestion,
  FileText,
  FileUp,
  MessageSquareText,
  Mic,
  Play,
  Radio,
  Search,
  Sparkles,
  Target,
  UploadCloud,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  AppFrame,
  Badge,
  PageWrap,
  ProgressBar,
  SectionHeading,
  TopNav,
  cn,
  type PresentoTone,
} from "@/components/presento-ui";
import { DotPattern } from "@/components/magicui/dot-pattern";
import {
  createFlowWorkspaceFlow,
  flowStepToRoute,
  getFlowStepByRoute,
  type FlowStepId,
  type FlowWorkspaceNodeData,
} from "@/lib/flow-workspace";
import {
  demoDeepDives,
  demoDefenseTurns,
  demoFiles,
  demoProcessingTasks,
  demoProject,
  demoReviewMetrics,
  demoSkillInvocations,
  demoSkillPacks,
  demoSlideScripts,
} from "@/lib/demo-data";
import { uploadDefenseFiles } from "@/lib/upload-files";
import { useWorkspace } from "@/lib/use-workspace";

export function FlowWorkspaceView() {
  const pathname = usePathname();
  const activeStep = getFlowStepByRoute(pathname);

  return (
    <AppFrame>
      <TopNav />
      <PageWrap className="presento-map-page">
        <section className="presento-flow-workspace">
          <ReactFlowProvider>
            <FlowWorkspaceCanvas activeId={activeStep.id} />
          </ReactFlowProvider>

          <div className="presento-flow-command-bar">
            <div className="min-w-0">
              <div className="text-xs font-black text-[var(--presento-blue-active)]">
                Presento 答辩流程图谱
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--presento-muted)]">
                <span>{demoProject.category}</span>
                <span>·</span>
                <span>{demoProject.deadline}</span>
                <Badge tone="orange">准备度 {demoProject.readiness}%</Badge>
                <Badge tone="orange">当前：{activeStep.label}</Badge>
              </div>
            </div>
            <Link className="presento-button-primary shrink-0" href="/projects/demo/defense">
              <Mic aria-hidden="true" />
              开始讲练
            </Link>
          </div>
        </section>
      </PageWrap>
    </AppFrame>
  );
}

function FlowWorkspaceCanvas({ activeId }: { activeId: FlowStepId }) {
  const router = useRouter();
  const flow = useMemo(() => createFlowWorkspaceFlow(activeId), [activeId]);
  const nodes = useMemo<Array<Node<FlowWorkspaceNodeData>>>(() => flow.nodes, [flow.nodes]);
  const edges = useMemo<Array<Edge>>(() => flow.edges, [flow.edges]);

  return (
    <div className="presento-process-canvas presento-flow">
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
        defaultViewport={{ x: 420, y: 280, zoom: 0.72 }}
        edges={edges}
        fitView
        fitViewOptions={{ minZoom: 0.48, maxZoom: 0.72, padding: 0.2 }}
        maxZoom={1.12}
        minZoom={0.42}
        nodeTypes={flowWorkspaceNodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={(_, node) => {
          startTransition(() => router.push(flowStepToRoute(node.id as FlowStepId)));
        }}
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <FlowViewportFocus activeId={activeId} />
      </ReactFlow>
    </div>
  );
}

function FlowViewportFocus({ activeId }: { activeId: FlowStepId }) {
  const reactFlow = useReactFlow();
  const nodesInitialized = useNodesInitialized();

  useEffect(() => {
    if (!nodesInitialized) return;

    const node = reactFlow.getNode(activeId);
    if (!node) return;

    reactFlow.setCenter(
      node.position.x + 330,
      node.position.y + 235,
      { duration: 640, zoom: 0.96 },
    );
  }, [activeId, nodesInitialized, reactFlow]);

  return null;
}

function FlowStepNode({ id, data }: NodeProps<Node<FlowWorkspaceNodeData>>) {
  return (
    <>
      <Handle className="presento-flow-handle" position={Position.Left} type="target" />
      <Handle className="presento-flow-handle" position={Position.Right} type="source" />
      <motion.article
        animate={{
          opacity: data.active ? 1 : 0.58,
          scale: data.active ? 1 : 0.88,
        }}
        className={cn(
          "presento-process-node",
          data.active && "presento-process-node-active",
          processToneClass(data.tone),
        )}
        layout
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="presento-process-node-header">
          <div className={cn("presento-process-node-icon", processIconToneClass(data.tone))}>
            <ProcessNodeIcon id={id as FlowStepId} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black text-[var(--presento-faint)]">
              {data.shortLabel}
            </div>
            <h2 className="truncate text-lg font-black text-[var(--presento-ink)]">
              {data.label}
            </h2>
          </div>
          <Badge tone={data.tone}>{statusLabel(data.status)}</Badge>
        </header>

        <p className="mt-3 text-sm font-semibold leading-6 text-[var(--presento-muted)]">
          {data.summary}
        </p>

        {data.active ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="mt-5"
            initial={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.24 }}
          >
            <FlowStepDetail stepId={id as FlowStepId} />
          </motion.div>
        ) : null}
      </motion.article>
    </>
  );
}

function FlowStepDetail({ stepId }: { stepId: FlowStepId }) {
  if (stepId === "files") return <FilesDetail />;
  if (stepId === "knowledge") return <KnowledgeDetail />;
  if (stepId === "scripts") return <ScriptsDetail />;
  if (stepId === "defense") return <DefenseDetail />;
  if (stepId === "review") return <ReviewDetail />;
  if (stepId === "deepDive") return <DeepDiveDetail />;
  if (stepId === "skills") return <SkillsDetail />;
  return <PCGDetail />;
}

function FilesDetail() {
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
    <div className="presento-process-detail-grid">
      <div className="presento-process-card">
        <SectionHeading icon={UploadCloud} title="已上传与继续上传" />
        <label className="presento-process-upload">
          <FileUp aria-hidden="true" />
          <span>{isUploading ? "正在上传..." : "继续上传资料"}</span>
          <small>PDF/PPT、README、代码 zip、SQL、CSV/Excel</small>
          <input className="sr-only" multiple onChange={(event) => uploadMore(event.target.files)} type="file" />
        </label>
        <div className="mt-3 grid gap-2">
          {files.slice(0, 4).map((file) => (
            <div className="presento-process-row" key={`${file.name}-${file.status}`}>
              <FileText aria-hidden="true" />
              <span className="truncate">{file.name}</span>
              <Badge tone="blue">{file.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="presento-process-card">
        <SectionHeading icon={Bot} title="解析队列" />
        <div className="grid gap-3">
          {tasks.slice(0, 3).map((task) => (
            <div className="rounded-xl border border-[var(--presento-border)] bg-white/82 p-3" key={task.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-black">{task.title}</span>
                <Badge tone={task.status === "completed" ? "green" : task.status === "processing" ? "orange" : "gray"}>
                  {task.status}
                </Badge>
              </div>
              <ProgressBar value={task.progress} />
              {workspace?.processingTasks.length && task.status === "processing" ? (
                <button className="presento-button-secondary mt-3 w-full" onClick={() => runProcessing(task.id)} type="button">
                  写入解析结果
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <p className="presento-muted mt-3 text-xs font-bold">
          已接入 {summary?.fileCount ?? files.length} 份资料。
        </p>
      </div>
    </div>
  );
}

function KnowledgeDetail() {
  return (
    <div className="presento-process-detail-grid">
      <div className="presento-process-card">
        <SectionHeading icon={Search} title="项目知识节点" />
        <div className="grid gap-2">
          {["PPT 18 页", "后端订单模块", "数据库设计", "高危追问 8 个", "薄弱点 3 个"].map((item) => (
            <div className="presento-process-row" key={item}>
              <Sparkles aria-hidden="true" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="presento-process-card">
        <SectionHeading icon={MessageSquareText} title="高危追问" />
        {["订单状态流转怎么设计？", "后厨接单后还能取消吗？", "这个模块是不是你负责的？"].map((item, index) => (
          <div className="presento-process-question" key={item}>
            {index + 1}. {item}
          </div>
        ))}
        <Link className="presento-button-primary mt-3 w-full" href="/projects/demo/scripts">
          生成回答框架
        </Link>
      </div>
    </div>
  );
}

function ScriptsDetail() {
  const activeSlide = demoSlideScripts[1];

  return (
    <div className="presento-process-detail-grid">
      <div className="presento-process-card">
        <SectionHeading icon={FileQuestion} title={`Slide ${activeSlide.page} · ${activeSlide.title}`} />
        <p className="rounded-xl border border-[var(--presento-border)] bg-white/88 p-4 text-sm font-semibold leading-7">
          {activeSlide.normal}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {activeSlide.keywords.map((keyword) => (
            <Badge tone="cyan" key={keyword}>{keyword}</Badge>
          ))}
        </div>
      </div>
      <div className="presento-process-card">
        <SectionHeading icon={Target} title="本页高危" />
        {activeSlide.risks.map((risk) => (
          <div className="presento-process-question" key={risk}>{risk}</div>
        ))}
        <Link className="presento-button-primary mt-3 w-full" href="/projects/demo/defense">
          用这一页开练
        </Link>
      </div>
    </div>
  );
}

function DefenseDetail() {
  return (
    <div className="presento-process-detail-grid">
      <div className="presento-process-card">
        <SectionHeading icon={Play} title="PPT 当前页" action={<Badge tone="orange">严格老师</Badge>} />
        <div className="presento-process-slide">
          <span>Slide 02</span>
          <strong>系统架构</strong>
          <small>订单流转 / 状态机 / 接口权限</small>
        </div>
      </div>
      <div className="presento-process-card">
        <SectionHeading icon={Mic} title="实时追问" />
        <div className="grid gap-2">
          {demoDefenseTurns.map((turn) => (
            <div className={cn("presento-process-chat", turn.speaker === "我" && "presento-process-chat-user")} key={`${turn.speaker}-${turn.content}`}>
              <strong>{turn.speaker}</strong>
              <span>{turn.content}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewDetail() {
  return (
    <div className="presento-process-detail-grid">
      <div className="presento-process-card">
        <SectionHeading icon={CheckCircle2} title="本轮复盘" action={<Badge tone="green">82 / 100</Badge>} />
        <div className="grid gap-2">
          {demoReviewMetrics.map((metric) => (
            <div className="presento-process-row" key={metric.label}>
              <span>{metric.label}</span>
              <Badge tone={metric.value >= 80 ? "green" : metric.value >= 70 ? "orange" : "red"}>
                {metric.value}
              </Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="presento-process-card">
        <SectionHeading icon={Target} title="下一轮任务" />
        {["补数据库解释", "专项练第 2 页", "回到知识地图修复薄弱点"].map((item) => (
          <div className="presento-process-question" key={item}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function DeepDiveDetail() {
  return (
    <div className="presento-process-detail-grid">
      {demoDeepDives.slice(0, 2).map((item) => (
        <div className="presento-process-card" key={item.title}>
          <SectionHeading icon={Target} title={item.title} />
          <p className="presento-muted text-sm font-semibold leading-6">{item.evidence}</p>
          <div className="mt-3 grid gap-2">
            {item.checklist.map((task) => (
              <div className="presento-process-row" key={task}>
                <CheckCircle2 aria-hidden="true" />
                <span>{task}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillsDetail() {
  return (
    <div className="presento-process-detail-grid">
      <div className="presento-process-card">
        <SectionHeading icon={Bot} title="Skill Packs" />
        {demoSkillPacks.map((pack) => (
          <div className="presento-process-row" key={pack.name}>
            <span>{pack.name}</span>
            <Badge tone={pack.enabled ? "green" : "gray"}>{pack.enabled ? "启用" : "停用"}</Badge>
          </div>
        ))}
      </div>
      <div className="presento-process-card">
        <SectionHeading icon={Code} title="最近调用" />
        {demoSkillInvocations.slice(0, 3).map((item) => (
          <div className="presento-process-question" key={`${item.skill}-${item.trigger}`}>
            {item.skill} · {item.status}
          </div>
        ))}
      </div>
    </div>
  );
}

function PCGDetail() {
  return (
    <div className="presento-process-detail-grid">
      {["QQ 小组群", "微视口播", "腾讯视频项目展示"].map((item) => (
        <div className="presento-process-card" key={item}>
          <SectionHeading icon={Radio} title={item} />
          <p className="presento-muted text-sm font-semibold leading-6">
            从复盘结果生成可分发内容，当前为模拟接入。
          </p>
          <button className="presento-button-secondary mt-3 w-full" type="button">
            生成内容草稿
          </button>
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
    risk: "高危",
    pending: "待处理",
    weakness: "薄弱点",
    capability: "能力层",
    output: "输出",
  }[status];
}

function processToneClass(tone: PresentoTone) {
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

function processIconToneClass(tone: PresentoTone) {
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

const flowWorkspaceNodeTypes = {
  flowStep: FlowStepNode,
};
