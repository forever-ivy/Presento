"use client";

import {
  CheckCircle2,
  Database,
  FileText,
  FileUp,
  Play,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AppFrame,
  BackLink,
  Badge,
  Card,
  PageHeader,
  PageWrap,
  Panel,
  ProgressBar,
  SectionHeading,
  TopNav,
} from "@/components/notion-ui";
import { demoFiles, demoProcessingTasks, demoProject } from "@/lib/demo-data";
import { uploadDefenseFiles } from "@/lib/upload-files";
import { useWorkspace } from "@/lib/use-workspace";

type ProcessingTaskView = {
  id: string;
  fileName: string;
  title: string;
  engine: string;
  status: string;
  progress: number;
  error?: string;
};

export default function FilesPage() {
  const {
    workspace,
    summary,
    addFiles,
    isLoaded,
    startProcessing,
    runProcessing,
    failProcessing,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [runningTaskId, setRunningTaskId] = useState("");

  const files = useMemo(() => {
    const workspaceFiles = workspace?.files.map((file) => ({
      name: file.name,
      type: kindLabel(file.kind),
      status: file.status,
      source: file.source,
    }));

    return workspaceFiles?.length ? workspaceFiles : demoFiles;
  }, [workspace]);

  const processingTasks: ProcessingTaskView[] = workspace?.processingTasks?.length
    ? workspace.processingTasks
    : demoProcessingTasks;
  const artifacts = workspace?.artifacts ?? [];
  const canControlQueue = Boolean(workspace?.processingTasks?.length);

  const filteredFiles = files.filter((file) => {
    const text = `${file.name} ${file.type} ${file.status} ${file.source}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  async function uploadMore(files: FileList | null) {
    if (!files?.length) return;
    setIsUploading(true);
    setUploadError("");

    try {
      const uploadedFiles = await uploadDefenseFiles(Array.from(files));
      addFiles(uploadedFiles);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  async function runTask(taskId: string) {
    setRunningTaskId(taskId);
    await runProcessing(taskId);
    setRunningTaskId("");
  }

  return (
    <AppFrame>
      <TopNav />
      <PageWrap>
        <PageHeader
          eyebrow={`${workspace?.project.name ?? demoProject.name} / 资料库`}
          title="项目资料库"
          description="课程项目答辩会把 PPT、README、代码包、SQL 和数据表都作为可追溯资料源。"
          actions={<BackLink />}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <div className="mb-5 flex items-center gap-2 rounded-[4px] border border-[#dddddd] bg-white px-3 py-2">
              <Search className="notion-muted" aria-hidden="true" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--notion-faint)]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索 PPT 页、代码文件、数据字段..."
                value={query}
              />
            </div>

            <div className="flex flex-col gap-3">
              {filteredFiles.map((file) => (
                <article
                  className="grid gap-3 rounded-xl border border-[var(--notion-border)] bg-white p-4 transition hover:bg-[var(--notion-warm)] md:grid-cols-[1fr_160px_160px]"
                  key={`${file.name}-${file.status}`}
                >
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-sm font-bold">
                      <FileText className="text-[var(--notion-blue)]" aria-hidden="true" />
                      {file.name}
                    </div>
                    <p className="notion-muted text-sm">{file.type}</p>
                  </div>
                  <div className="text-sm text-[var(--notion-muted)]">{file.status}</div>
                  <div className="text-sm text-[var(--notion-muted)]">{file.source}</div>
                </article>
              ))}
            </div>

            {artifacts.length > 0 ? (
              <div className="mt-6 border-t border-[var(--notion-border)] pt-5">
                <SectionHeading
                  icon={FileText}
                  title="解析产物"
                  description="这些摘要会进入后续项目速记卡、老师追问和 RAG 溯源。"
                />
                <div className="flex flex-col gap-3">
                  {artifacts.map((artifact) => (
                    <article
                      className="rounded-xl border border-[var(--notion-border)] bg-[var(--notion-warm)] p-4"
                      key={artifact.id}
                    >
                      <div className="text-sm font-bold">{artifact.title}</div>
                      <p className="notion-muted mt-2 text-sm leading-6">
                        {artifact.summary}
                      </p>
                      <div className="mt-3 flex flex-col gap-1">
                        {artifact.previewLines.map((line) => (
                          <div className="truncate text-xs text-[var(--notion-muted)]" key={line}>
                            {line}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <aside className="flex flex-col gap-5">
            <Panel>
              <SectionHeading icon={Upload} title="上传模板" />
              <p className="notion-muted text-sm leading-6">
                第一版推荐 PDF/PPT、README、代码 zip、SQL、CSV/Excel。其他专业源文件先作为附件记录。
              </p>
              <label
                className={`notion-button-primary mt-4 w-full cursor-pointer ${
                  isUploading ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <FileUp aria-hidden="true" />
                {isUploading ? "正在上传..." : "继续添加文件"}
                <input
                  className="sr-only"
                  multiple
                  onChange={(event) => uploadMore(event.target.files)}
                  type="file"
                />
              </label>
              {uploadError ? (
                <p className="mt-3 text-sm font-semibold text-[#dd5b00]">
                  {uploadError}
                </p>
              ) : null}
              {!workspace && isLoaded ? (
                <p className="notion-muted mt-3 text-xs leading-5">
                  当前展示 demo 文件。创建项目后，这里会切换到你的真实上传记录。
                </p>
              ) : null}
            </Panel>

            <Card>
              <SectionHeading icon={Database} title="工作区摘要" />
              <div className="grid grid-cols-2 gap-3">
                <Metric label="文件数" value={String(summary?.fileCount ?? demoFiles.length)} />
                <Metric label="准备度" value={`${summary?.readiness ?? demoProject.readiness}%`} />
                <Metric label="待解析" value={String(summary?.pendingTaskCount ?? 1)} />
                <Metric label="处理中" value={String(summary?.processingTaskCount ?? 1)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={summary?.hasPresentation ? "blue" : "gray"}>PPT / PDF</Badge>
                <Badge tone={summary?.hasCode ? "blue" : "gray"}>代码包</Badge>
                <Badge tone={summary?.hasDataOrDatabase ? "blue" : "gray"}>数据 / SQL</Badge>
              </div>
            </Card>

            <Card>
              <SectionHeading
                icon={Database}
                title="解析任务队列"
                description="先做本地状态流转，后面把这些任务替换为 Docling、Repomix 和向量入库 worker。"
                action={
                  <button
                    className="notion-button-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canControlQueue}
                    onClick={startProcessing}
                  >
                    <Play aria-hidden="true" />
                    启动
                  </button>
                }
              />
              <div className="flex flex-col gap-3">
                {processingTasks.map((task) => (
                  <article
                    className="rounded-xl border border-[var(--notion-border)] bg-white p-3"
                    key={task.id}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold">{task.title}</div>
                        <p className="notion-muted mt-1 text-xs leading-5">
                          {task.fileName} · {task.engine}
                        </p>
                      </div>
                      <Badge tone={taskStatusTone(task.status)}>
                        {taskStatusLabel(task.status)}
                      </Badge>
                    </div>
                    <ProgressBar value={task.progress} />
                    {task.error ? (
                      <p className="mt-2 text-xs font-semibold text-[#dd5b00]">
                        {task.error}
                      </p>
                    ) : null}
                    {canControlQueue && task.status === "processing" ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          className="notion-button-secondary flex-1 justify-center"
                          disabled={runningTaskId === task.id}
                          onClick={() => runTask(task.id)}
                        >
                          <CheckCircle2 aria-hidden="true" />
                          {runningTaskId === task.id ? "解析中" : "运行解析"}
                        </button>
                        <button
                          className="notion-button-secondary flex-1 justify-center"
                          onClick={() => failProcessing(task.id, "解析服务暂不可用")}
                        >
                          <XCircle aria-hidden="true" />
                          标记失败
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
              {!canControlQueue ? (
                <p className="notion-muted mt-3 text-xs leading-5">
                  当前是 demo 队列。创建项目并上传文件后，可以在这里模拟任务流转。
                </p>
              ) : null}
            </Card>

            <Card>
              <SectionHeading icon={Database} title="溯源要求" />
              <p className="notion-muted text-sm leading-6">
                后续回答会尽量标注来自 PPT 第几页、README、SQL 表结构或代码路径。
              </p>
            </Card>
          </aside>
        </section>
      </PageWrap>
    </AppFrame>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--notion-border)] bg-[var(--notion-warm)] p-3">
      <div className="notion-muted text-xs font-semibold">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-[-0.625px]">{value}</div>
    </div>
  );
}

function kindLabel(kind: string) {
  const labels: Record<string, string> = {
    presentation: "演示材料",
    document: "项目说明",
    code: "代码包",
    database: "数据库",
    dataset: "数据表",
    asset: "附件",
    other: "附件",
  };

  return labels[kind] ?? "附件";
}

function taskStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "待解析",
    processing: "解析中",
    completed: "已完成",
    failed: "失败",
  };

  return labels[status] ?? "未知";
}

function taskStatusTone(status: string): "blue" | "gray" | "orange" | "green" {
  if (status === "completed") return "green";
  if (status === "processing") return "blue";
  if (status === "failed") return "orange";
  return "gray";
}
