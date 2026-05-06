"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  FileQuestion,
  FileText,
  FileUp,
  Loader2,
  Map,
  MessageSquareText,
  Mic,
  Network,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  AppFrame,
  PageWrap,
  TopNav,
} from "@/components/presento-ui";
import { ProjectUploadWorkspace } from "@/components/project-upload-workspace";
import Folder from "@/components/react-bits/folder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DefenseFileInput } from "@/lib/project-workspace";
import { projectOverviewRoute } from "@/lib/project-routes";
import { createProject } from "@/lib/projects-api";
import { mergeUploadedFiles } from "@/lib/upload-workspace";

const projectCategoryOptions = [
  "课程项目答辩",
  "毕设答辩",
  "小组展示",
  "比赛路演",
  "实习汇报",
  "社团宣讲",
];

gsap.registerPlugin(useGSAP);

export function FirstProjectHome() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBursting, setIsBursting] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [category, setCategory] = useState(projectCategoryOptions[0]);
  const [deadlineLocal, setDeadlineLocal] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<DefenseFileInput[]>([]);
  const [hasActiveUploads, setHasActiveUploads] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = Boolean(projectName.trim() && deadlineLocal && uploadedFiles.length > 0 && !hasActiveUploads);

  async function submitProject() {
    const name = projectName.trim();
    const deadlineAt = datetimeLocalToIso(deadlineLocal);
    if (!name) {
      setError("请先填写项目名称");
      return;
    }
    if (!deadlineAt) {
      setError("请设置截止日期和时间");
      return;
    }
    if (!uploadedFiles.length) {
      setError("请至少上传一份项目资料");
      return;
    }

    setIsCreating(true);
    setError("");
    try {
      const project = await createProject({
        name,
        category: category.trim() || "第一个答辩项目",
        deadlineAt,
        uploadedFiles,
      });
      setIsModalOpen(false);
      setIsBursting(true);
      window.setTimeout(() => {
        router.push(projectOverviewRoute(project.id));
      }, reduceMotion ? 120 : 2800);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "项目创建失败");
      setIsCreating(false);
    }
  }

  return (
    <AppFrame>
      <TopNav showProjectSwitch={false} />
      <PageWrap className="presento-first-project-page" width="max-w-none">
        <section className="presento-first-project-canvas presento-first-project-canvas-centered">
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="presento-first-project-folder-wrap"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 24 }}
            transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              aria-label="创建第一个项目"
              className="presento-first-project-folder-button"
              onClick={() => setIsModalOpen(true)}
              type="button"
            >
              <span className="presento-first-project-folder-stage" aria-hidden="true">
                <Folder
                  className="presento-first-project-folder"
                  color="#10b981"
                  items={[
                    <FolderPaper label="PPT" key="ppt" />,
                    <FolderPaper label="DOC" key="doc" />,
                    <FolderPaper label="CODE" key="code" />,
                  ]}
                  size={2.25}
                />
              </span>
              <span className="presento-first-project-folder-copy">
                <strong>创建第一个项目</strong>
              </span>
            </button>
          </motion.div>
        </section>
      </PageWrap>

      <AnimatePresence>
        {isModalOpen ? (
          <ProjectCreateModal
            canSubmit={canSubmit}
            category={category}
            deadlineLocal={deadlineLocal}
            error={error}
            hasActiveUploads={hasActiveUploads}
            isCreating={isCreating}
            onCategoryChange={setCategory}
            onClose={() => {
              if (!isCreating) setIsModalOpen(false);
            }}
            onDeadlineChange={setDeadlineLocal}
            onError={setError}
            onProjectNameChange={setProjectName}
            onSubmit={submitProject}
            onUploadActivityChange={setHasActiveUploads}
            onUploadComplete={(files) => {
              setError("");
              setUploadedFiles((currentFiles) => mergeUploadedFiles(currentFiles, files));
            }}
            projectName={projectName}
            reduceMotion={Boolean(reduceMotion)}
            uploadedFiles={uploadedFiles}
          />
        ) : null}
      </AnimatePresence>

      <NodeBurstOverlay
        projectName={projectName.trim() || "新项目"}
        reduceMotion={Boolean(reduceMotion)}
        show={isBursting}
      />
    </AppFrame>
  );
}

function ProjectCreateModal({
  canSubmit,
  category,
  deadlineLocal,
  error,
  hasActiveUploads,
  isCreating,
  onCategoryChange,
  onClose,
  onDeadlineChange,
  onError,
  onProjectNameChange,
  onSubmit,
  onUploadActivityChange,
  onUploadComplete,
  projectName,
  reduceMotion,
  uploadedFiles,
}: {
  canSubmit: boolean;
  category: string;
  deadlineLocal: string;
  error: string;
  hasActiveUploads: boolean;
  isCreating: boolean;
  onCategoryChange: (value: string) => void;
  onClose: () => void;
  onDeadlineChange: (value: string) => void;
  onError: (value: string) => void;
  onProjectNameChange: (value: string) => void;
  onSubmit: () => void;
  onUploadActivityChange: (value: boolean) => void;
  onUploadComplete: (files: DefenseFileInput[]) => void;
  projectName: string;
  reduceMotion: boolean;
  uploadedFiles: DefenseFileInput[];
}) {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="presento-first-project-modal-backdrop"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={onClose}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <motion.section
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-modal="true"
        className="presento-first-project-modal"
        exit={{ opacity: 0, scale: 0.97, y: 18 }}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 34 }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <button
          aria-label="关闭"
          className="presento-first-project-modal-close"
          disabled={isCreating}
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" />
        </button>

        <div className="presento-first-project-modal-header">
          <h2>上传资料</h2>
        </div>

        <ProjectUploadWorkspace
          initialFiles={uploadedFiles}
          onUploadActivityChange={onUploadActivityChange}
          onUploadComplete={onUploadComplete}
          onUploadError={onError}
          variant="create"
        />

        <div className="presento-first-project-modal-fields">
          <label>
            <span>项目名称</span>
            <Input
              onChange={(event) => onProjectNameChange(event.target.value)}
              placeholder="例如：智能点餐系统课程答辩"
              value={projectName}
            />
          </label>
          <label>
            <span>项目类型</span>
            <Select onValueChange={onCategoryChange} value={category}>
              <SelectTrigger className="presento-first-project-select">
                <SelectValue placeholder="选择项目类型" />
              </SelectTrigger>
              <SelectContent className="presento-first-project-select-content">
                {projectCategoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            <span>截止日期和时间</span>
            <Input
              onChange={(event) => onDeadlineChange(event.target.value)}
              type="datetime-local"
              value={deadlineLocal}
            />
          </label>
        </div>

        {error ? <p className="presento-first-project-error">{error}</p> : null}

        <div className="presento-first-project-modal-footer">
          <span>
            <CalendarClock aria-hidden="true" />
            {uploadedFiles.length ? `已接入 ${uploadedFiles.length} 份资料` : "先上传至少一份资料"}
          </span>
          <Button
            className="presento-first-project-modal-submit"
            disabled={!canSubmit || isCreating}
            onClick={onSubmit}
            type="button"
          >
            {isCreating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Network aria-hidden="true" />}
            {hasActiveUploads ? "等待上传完成" : isCreating ? "正在生成" : "创建并展开节点"}
          </Button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function FolderPaper({ label }: { label: string }) {
  return (
    <div className="presento-folder-paper">
      <FileText aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function NodeBurstOverlay({
  projectName,
  reduceMotion,
  show,
}: {
  projectName: string;
  reduceMotion: boolean;
  show: boolean;
}) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const flowNodes = [
    { icon: FileUp, title: "资料", tone: "green", x: -250, y: -54, rotate: -1.2 },
    { icon: Map, title: "地图", tone: "green", x: 0, y: -205, rotate: 0 },
    { icon: FileQuestion, title: "讲稿", tone: "blue", x: 250, y: -54, rotate: 1.2 },
    { icon: Mic, title: "练讲", tone: "amber", x: -154, y: 154, rotate: -0.8 },
    { icon: MessageSquareText, title: "复盘", tone: "purple", x: 154, y: 154, rotate: 0.8 },
  ] as const;

  useGSAP(
    () => {
      if (!scopeRef.current || !show) return;

      const overlay = scopeRef.current;
      const nodes = gsap.utils.toArray<HTMLElement>(".presento-first-project-flow-node", overlay);
      const lines = gsap.utils.toArray<HTMLElement>(".presento-first-project-flow-line", overlay);
      const documents = gsap.utils.toArray<HTMLElement>(".presento-first-project-burst-document", overlay);
      const folder = overlay.querySelector<HTMLElement>(".presento-first-project-burst-folder");
      const halo = overlay.querySelector<HTMLElement>(".presento-first-project-burst-halo");
      const copy = overlay.querySelector<HTMLElement>(".presento-first-project-burst-copy");
      const nodeIcons = nodes
        .map((node) => node.querySelector<HTMLElement>(".presento-first-project-flow-node-icon"))
        .filter((icon): icon is HTMLElement => icon !== null);
      const isNarrow = window.matchMedia("(max-width: 767px)").matches;
      const isTablet = window.matchMedia("(max-width: 1180px)").matches;
      const layoutScale = isNarrow ? 0.58 : isTablet ? 0.78 : 1;
      const folderTarget = isNarrow
        ? { scale: 0.76, y: 62 }
        : isTablet
          ? { scale: 0.88, y: 70 }
          : { scale: 0.96, y: 76 };
      const folderStart = {
        scale: Math.max(0.34, folderTarget.scale * 0.56),
        y: folderTarget.y + (isNarrow ? 34 : 42),
      };
      const documentTargets = isNarrow
        ? [
            { x: -42, y: -62, rotate: -8 },
            { x: 0, y: -88, rotate: 2 },
            { x: 42, y: -62, rotate: 8 },
          ]
        : [
            { x: -64, y: -82, rotate: -8 },
            { x: 0, y: -112, rotate: 2 },
            { x: 64, y: -82, rotate: 8 },
          ];
      const numberFromData = (target: HTMLElement, key: string, fallback = 0) => {
        const value = target.dataset[key];
        return value === undefined ? fallback : Number(value);
      };
      const nodeX = (target: HTMLElement) => numberFromData(target, "x") * layoutScale;
      const nodeY = (target: HTMLElement) => numberFromData(target, "y") * layoutScale;
      const lineRotate = (target: HTMLElement) =>
        Math.atan2(nodeY(target), nodeX(target)) * (180 / Math.PI);
      const lineWidth = (target: HTMLElement) =>
        Math.max(48, Math.hypot(nodeX(target), nodeY(target)) - (isNarrow ? 44 : 62));

      if (reduceMotion) {
        gsap.set(overlay, { opacity: 1 });
        gsap.set(folder, { opacity: 1, scale: folderTarget.scale, y: folderTarget.y });
        gsap.set(halo, { opacity: 1, scale: 1 });
        gsap.set(nodes, {
          opacity: 1,
          scale: 1,
          x: (index, target) => nodeX(target as HTMLElement),
          y: (index, target) => nodeY(target as HTMLElement),
          rotate: (index, target) => numberFromData(target as HTMLElement, "rotate"),
          filter: "blur(0px)",
        });
        gsap.set(lines, {
          opacity: 0.42,
          scaleX: 1,
          x: 0,
          y: 0,
          rotate: (index, target) => lineRotate(target as HTMLElement),
          width: (index, target) => lineWidth(target as HTMLElement),
        });
        gsap.set(documents, {
          opacity: 1,
          scale: 1,
          x: (index) => documentTargets[index]?.x ?? 0,
          y: (index) => documentTargets[index]?.y ?? -80,
          rotate: (index) => documentTargets[index]?.rotate ?? 0,
        });
        gsap.set(copy, { opacity: 1, y: 0 });
        return;
      }

      gsap.set(overlay, { opacity: 0 });
      gsap.set(halo, { opacity: 0, scale: 0.82 });
      gsap.set(folder, { opacity: 0, scale: folderStart.scale, y: folderStart.y, rotate: 0, transformOrigin: "50% 84%" });
      gsap.set(nodes, {
        opacity: 0,
        scale: 0.72,
        x: 0,
        y: folderTarget.y + 22,
        rotate: (index) => (index % 2 === 0 ? -4 : 4),
        filter: "blur(8px)",
        transformOrigin: "50% 62%",
      });
      gsap.set(lines, {
        opacity: 0,
        scaleX: 0,
        x: 0,
        y: 0,
        rotate: (index, target) => lineRotate(target as HTMLElement),
        width: (index, target) => lineWidth(target as HTMLElement),
        transformOrigin: "0% 50%",
      });
      gsap.set(documents, {
        opacity: 0,
        scale: 0.48,
        x: 0,
        y: 80,
        rotate: 0,
        transformOrigin: "50% 100%",
      });
      gsap.set(copy, { opacity: 0, y: 14 });

      const timeline = gsap.timeline({
        defaults: { force3D: true, overwrite: "auto" },
      });

      timeline
        .to(overlay, { opacity: 1, duration: 0.22, ease: "power2.out" })
        .to(halo, { opacity: 1, scale: 1, duration: 0.88, ease: "power3.out" }, 0.02)
        .to(folder, { opacity: 1, scale: folderTarget.scale, y: folderTarget.y, duration: 0.74, ease: "expo.out" }, 0.04)
        .to(
          documents,
          {
            opacity: 1,
            scale: 1,
            x: (index) => documentTargets[index]?.x ?? 0,
            y: (index) => documentTargets[index]?.y ?? -80,
            rotate: (index) => documentTargets[index]?.rotate ?? 0,
            duration: 0.84,
            ease: "expo.out",
            stagger: 0.055,
          },
          0.2,
        )
        .to(
          lines,
          {
            opacity: 0.42,
            scaleX: 1,
            duration: 0.64,
            ease: "power2.out",
            stagger: { each: 0.045, from: "center" },
          },
          0.42,
        )
        .to(
          nodes,
          {
            opacity: 1,
            scale: 1,
            x: (index, target) => nodeX(target as HTMLElement),
            y: (index, target) => nodeY(target as HTMLElement),
            rotate: (index, target) => numberFromData(target as HTMLElement, "rotate"),
            filter: "blur(0px)",
            duration: 0.78,
            ease: "expo.out",
            stagger: { each: 0.055, from: "center" },
          },
          0.52,
        )
        .fromTo(
          nodeIcons,
          { scale: 0.72, rotate: -8 },
          { scale: 1, rotate: 0, duration: 0.42, ease: "back.out(1.8)", stagger: 0.035 },
          0.78,
        )
        .to(copy, { opacity: 1, y: 0, duration: 0.36, ease: "power2.out" }, 0.98)
        .to(nodes, { y: "-=3", duration: 1.05, repeat: 1, yoyo: true, ease: "sine.inOut", stagger: 0.035 }, 1.12)
        .to(documents, { y: "-=5", duration: 1, repeat: 1, yoyo: true, ease: "sine.inOut", stagger: 0.06 }, 1.12);
    },
    { dependencies: [show, reduceMotion], scope: scopeRef },
  );

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          animate={false}
          className="presento-first-project-burst-overlay"
          exit={{ opacity: 0 }}
          initial={false}
          ref={scopeRef}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
        >
          <div className="presento-first-project-burst-folder">
            <Folder
              color="#10b981"
              defaultOpen
              items={[
                <FolderPaper label="PPT" key="ppt" />,
                <FolderPaper label="DOC" key="doc" />,
                <FolderPaper label="AI" key="ai" />,
              ]}
              size={2.25}
            />
          </div>
          <div className="presento-first-project-flow-stage">
            <span className="presento-first-project-burst-halo" aria-hidden="true" />
            {flowNodes.map((node, index) => (
              <span
                className="presento-first-project-flow-line"
                data-x={node.x}
                data-y={node.y}
                key={`line-${node.title}-${index}`}
              />
            ))}
            <div className="presento-first-project-burst-documents" aria-hidden="true">
              {["PPT", "AI", "DOC"].map((label) => (
                <div className="presento-first-project-burst-document" key={label}>
                  <FileText aria-hidden="true" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {flowNodes.map((node) => {
              const Icon = node.icon;
              return (
                <div
                  className={`presento-first-project-flow-node presento-first-project-flow-node-${node.tone}`}
                  data-rotate={node.rotate}
                  data-x={node.x}
                  data-y={node.y}
                  key={node.title}
                >
                  <span className="presento-first-project-flow-node-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <strong>{node.title}</strong>
                </div>
              );
            })}
          </div>
          <div className="presento-first-project-burst-copy">
            <strong>{projectName}</strong>
            <span>项目已创建，正在打开总览图</span>
          </div>
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
