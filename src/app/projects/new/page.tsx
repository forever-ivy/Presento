"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FolderKanban, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProjectUploadWorkspace } from "@/components/project-upload-workspace";
import {
  AppFrame,
  Badge,
  PageWrap,
  TopNav,
  cn,
} from "@/components/presento-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DefenseFileInput } from "@/lib/project-workspace";
import { projectOverviewRoute } from "@/lib/project-routes";
import {
  createProject,
  deleteProject,
  fetchProjects,
  type ProjectListItem,
} from "@/lib/projects-api";
import { mergeUploadedFiles } from "@/lib/upload-workspace";

const scenarios = ["课程项目答辩", "毕设答辩", "小组展示", "比赛路演", "社团宣讲", "实习汇报"];
const projectTypeOptions = ["软件 / AI / 数据类", "硬件 / 嵌入式", "产品 / 设计类", "商业 / 路演类", "科研 / 论文类", "通用展示"];

export default function ProjectManagementPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setIsLoading(true);
      setError("");
      try {
        const nextProjects = await fetchProjects();
        if (!cancelled) setProjects(nextProjects);
      } catch (nextError) {
        if (!cancelled) {
          setProjects([]);
          setError(nextError instanceof Error ? nextError.message : "项目列表读取失败");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreated(project: ProjectListItem) {
    setIsModalOpen(false);
    router.push(projectOverviewRoute(project.id));
  }

  async function confirmDeleteProject(project: ProjectListItem) {
    setDeletingProjectId(project.id);
    setError("");
    try {
      await deleteProject(project.id);
      setProjects((currentProjects) => currentProjects.filter((item) => item.id !== project.id));
      setDeleteTarget(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "项目删除失败");
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <AppFrame ambient={false}>
      <TopNav />
      <PageWrap className="presento-projects-workspace gap-7" width="max-w-none">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-normal text-[var(--presento-ink)]">
              项目管理
            </h1>
          </div>
          <button
            className="presento-button-primary h-12 rounded-full px-6"
            onClick={() => setIsModalOpen(true)}
            type="button"
          >
            <Plus aria-hidden="true" />
            新建项目
          </button>
        </section>

        <section className="min-h-[68vh] overflow-hidden rounded-[28px] border border-[var(--presento-border)] bg-white/86 shadow-[0_28px_80px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="grid grid-cols-[minmax(0,1.4fr)_160px_120px_170px_180px_120px_110px] gap-4 border-b border-[var(--presento-border)] px-6 py-4 text-xs font-black uppercase tracking-wider text-[var(--presento-faint)] max-lg:hidden">
            <span>项目</span>
            <span>类型</span>
            <span>资料</span>
            <span>截止时间</span>
            <span>更新时间</span>
            <span className="text-right">进入</span>
            <span className="text-right">操作</span>
          </div>

          {isLoading ? (
            <ProjectListState label="正在读取真实项目列表..." />
          ) : error ? (
            <ProjectListState label={error} tone="error" />
          ) : projects.length ? (
            <div className="divide-y divide-[var(--presento-border)]">
              {projects.map((project) => (
                <ProjectRow
                  isDeleting={deletingProjectId === project.id}
                  key={project.id}
                  onDelete={setDeleteTarget}
                  project={project}
                />
              ))}
            </div>
          ) : (
            <ProjectListState label="还没有项目，先新建一个真实项目。" />
          )}
        </section>
      </PageWrap>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && deletingProjectId === null) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `「${deleteTarget.name}」的项目资料、知识地图、讲稿和训练记录都会一起删除。`
                : "项目资料、知识地图、讲稿和训练记录都会一起删除。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProjectId !== null}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteTarget || deletingProjectId !== null}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) void confirmDeleteProject(deleteTarget);
              }}
              variant="destructive"
            >
              {deletingProjectId !== null ? "正在删除..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppFrame>
  );
}

function ProjectRow({
  isDeleting,
  onDelete,
  project,
}: {
  isDeleting: boolean;
  onDelete: (project: ProjectListItem) => void;
  project: ProjectListItem;
}) {
  return (
    <div className="grid gap-4 px-6 py-5 transition hover:bg-emerald-50/45 lg:grid-cols-[minmax(0,1.4fr)_160px_120px_170px_180px_120px_110px] lg:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-[var(--presento-blue)]">
          <FolderKanban aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-lg font-black text-[var(--presento-ink)]">
            {project.name}
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-[var(--presento-muted)]">
            {project.deadlineAt ? `截止 ${formatDate(project.deadlineAt)}` : "未设置截止时间"}
          </div>
        </div>
      </div>
      <div className="text-sm font-bold text-[var(--presento-muted)]">
        {project.category || "未分类"}
      </div>
      <div>
        <Badge tone="green">{project.fileCount ?? 0} 份</Badge>
      </div>
      <div className="text-sm font-bold text-[var(--presento-muted)]">
        {project.deadlineAt ? formatDate(project.deadlineAt) : "未设置"}
      </div>
      <div className="text-sm font-bold text-[var(--presento-muted)]">
        {formatDate(project.updatedAt ?? project.createdAt)}
      </div>
      <Link
        className="flex items-center justify-end gap-2 text-sm font-black text-[var(--presento-blue-active)] transition hover:text-[var(--presento-blue)]"
        href={projectOverviewRoute(project.id)}
      >
        进入
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      <div className="flex justify-end">
        <button
          aria-label={`删除 ${project.name}`}
          className="flex size-10 items-center justify-center rounded-full border border-red-100 bg-red-50/70 text-red-500 transition hover:border-red-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-55"
          disabled={isDeleting}
          onClick={() => onDelete(project)}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ProjectListState({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(68vh-3.5rem)] items-center justify-center px-6 text-center text-base font-black",
        tone === "error" ? "text-[#c56a09]" : "text-[var(--presento-muted)]",
      )}
    >
      {label}
    </div>
  );
}

function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: ProjectListItem) => void;
}) {
  const [projectName, setProjectName] = useState("");
  const [category, setCategory] = useState(projectTypeOptions[0]);
  const [scenario, setScenario] = useState(scenarios[0]);
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<DefenseFileInput[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [hasActiveUploads, setHasActiveUploads] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function submitProject() {
    const name = projectName.trim();
    if (!name) {
      setUploadError("请先填写项目名称");
      return;
    }
    const deadlineAt = datetimeLocalToIso(deadlineLocal);
    if (!deadlineAt) {
      setUploadError("请设置截止日期和时间");
      return;
    }
    if (!uploadedFiles.length) {
      setUploadError("请至少上传一份项目资料");
      return;
    }

    setIsCreating(true);
    setUploadError("");
    try {
      const project = await createProject({
        name,
        category: `${scenario} · ${category.trim() || "未分类"}`,
        deadlineAt,
        uploadedFiles,
      });
      onCreated(project);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "项目创建失败");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(15,23,42,0.24)] p-4 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onClose}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[32px] border border-white/80 bg-[rgba(250,252,251,0.96)] p-5 shadow-[0_30px_100px_rgba(15,23,42,0.22)]"
            exit={{ opacity: 0, scale: 0.985, y: 12 }}
            initial={{ opacity: 0, scale: 0.985, y: 12 }}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-4 flex items-center justify-between gap-4 px-2">
              <div>
                <div className="presento-kicker mb-1">New Project</div>
                <h2 className="text-2xl font-black text-[var(--presento-ink)]">新建项目</h2>
              </div>
              <button
                aria-label="关闭"
                className="flex size-11 items-center justify-center rounded-full border border-[var(--presento-border)] bg-white text-[var(--presento-muted)] shadow-sm transition hover:text-[var(--presento-ink)]"
                onClick={onClose}
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <ProjectUploadWorkspace
              className="mb-5"
              initialFiles={uploadedFiles}
              onUploadActivityChange={setHasActiveUploads}
              onUploadComplete={(files) => {
                setUploadError("");
                setUploadedFiles((currentFiles) => mergeUploadedFiles(currentFiles, files));
              }}
              onUploadError={setUploadError}
              variant="create"
            />

            <section className="rounded-[28px] border border-[var(--presento-border)] bg-white/90 p-5">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {scenarios.map((item) => (
                  <button
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left text-sm font-black transition",
                      scenario === item
                        ? "border-emerald-200 bg-emerald-50 text-[var(--presento-blue-active)]"
                        : "border-[var(--presento-border)] bg-white text-[var(--presento-muted)] hover:bg-[var(--presento-hover)]",
                    )}
                    key={item}
                    onClick={() => setScenario(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black">项目名称</span>
                  <input className="presento-input" onChange={(event) => setProjectName(event.target.value)} placeholder="例如：智能点餐系统课程答辩" value={projectName} />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black">项目类型</span>
                  <Select onValueChange={setCategory} value={category}>
                    <SelectTrigger className="presento-input h-11 w-full justify-between px-3 py-0 shadow-none">
                      <SelectValue placeholder="选择项目类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTypeOptions.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black">截止日期和时间</span>
                  <input className="presento-input" onChange={(event) => setDeadlineLocal(event.target.value)} type="datetime-local" value={deadlineLocal} />
                </label>
              </div>

              {uploadError ? <p className="mt-4 text-sm font-semibold text-[#c56a09]">{uploadError}</p> : null}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-bold text-[var(--presento-muted)]">
                  已接入 {uploadedFiles.length} 份资料
                </div>
                <button
                  className="presento-button-primary h-12 rounded-full px-6 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCreating || hasActiveUploads || !projectName.trim() || !deadlineLocal || uploadedFiles.length === 0}
                  onClick={submitProject}
                  type="button"
                >
                  {hasActiveUploads ? "等待上传完成..." : isCreating ? "正在创建..." : "创建并进入总览图"}
                </button>
              </div>
            </section>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function datetimeLocalToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
