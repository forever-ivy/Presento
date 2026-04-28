"use client";

import { CheckCircle2, Map, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectUploadWorkspace } from "@/components/project-upload-workspace";
import {
  AppFrame,
  BackLink,
  Badge,
  Card,
  PageWrap,
  SectionHeading,
  TopNav,
  cn,
} from "@/components/presento-ui";
import type { DefenseFileInput } from "@/lib/project-workspace";
import { useWorkspace } from "@/lib/use-workspace";
import { mergeUploadedFiles } from "@/lib/upload-workspace";

const scenarios = ["课程项目答辩", "毕设答辩", "小组展示", "比赛路演", "社团宣讲", "实习汇报"];

export default function NewProjectPage() {
  const router = useRouter();
  const { createWorkspace } = useWorkspace();
  const [projectName, setProjectName] = useState("智能点餐系统课程答辩");
  const [category, setCategory] = useState("软件 / AI / 数据类");
  const [scenario, setScenario] = useState(scenarios[0]);
  const [ownerScope, setOwnerScope] = useState("我负责：后端订单接口");
  const [teammateScope, setTeammateScope] = useState("队友负责：前端页面 / 数据库");
  const [uploadedFiles, setUploadedFiles] = useState<DefenseFileInput[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [hasActiveUploads, setHasActiveUploads] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function submitProject() {
    setIsCreating(true);

    try {
      createWorkspace({
        name: projectName,
        category: `${scenario} · ${category}`,
        ownerScope,
        teammateScope,
        files: uploadedFiles,
      });
      router.push("/projects/demo/knowledge-map");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "项目创建失败");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <AppFrame>
      <TopNav />
      <PageWrap className="gap-5" width="max-w-none">
        <div className="flex justify-end">
          <BackLink href="/" label="返回工作台" />
        </div>

        <ProjectUploadWorkspace
          initialFiles={uploadedFiles}
          onUploadActivityChange={setHasActiveUploads}
          onUploadComplete={(files) => {
            setUploadError("");
            setUploadedFiles((currentFiles) => mergeUploadedFiles(currentFiles, files));
          }}
          onUploadError={setUploadError}
          variant="create"
        />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <Card>
            <SectionHeading icon={Map} title="项目表达设定" />
            <div className="grid gap-3 md:grid-cols-3">
              {scenarios.map((item) => (
                <button
                  className={cn(
                    "rounded-2xl border p-4 text-left text-sm font-black transition hover:bg-[var(--presento-warm)]",
                    scenario === item
                      ? "border-[var(--presento-blue)] bg-[var(--presento-soft-blue)] text-[var(--presento-blue)]"
                      : "border-[var(--presento-border)] bg-white",
                  )}
                  key={item}
                  onClick={() => setScenario(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-black">项目名称</span>
                <input className="presento-input" onChange={(event) => setProjectName(event.target.value)} value={projectName} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-black">项目类型</span>
                <input className="presento-input" onChange={(event) => setCategory(event.target.value)} value={category} />
              </label>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-black">我的负责范围</span>
                <input className="presento-input" onChange={(event) => setOwnerScope(event.target.value)} value={ownerScope} />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-black">队友负责范围</span>
                <input className="presento-input" onChange={(event) => setTeammateScope(event.target.value)} value={teammateScope} />
              </label>
            </div>
          </Card>

          <Card>
            <SectionHeading icon={Sparkles} title="创建动作" />
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-[var(--presento-border)] bg-[var(--presento-warm)] p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-sm font-black">当前已接入资料</div>
                  <Badge tone="blue">{uploadedFiles.length} 份</Badge>
                </div>
                <p className="presento-muted text-sm leading-6">
                  {hasActiveUploads
                    ? "正在上传资料，完成后再创建项目会更稳。"
                    : "创建后将直接进入知识地图，不再停留在普通文件夹视角。"}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--presento-border)] bg-white p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-black">
                  <CheckCircle2 className="text-[var(--presento-blue)]" aria-hidden="true" />
                  这一步会保留当前上传结果
                </div>
                <p className="presento-muted text-sm leading-6">
                  资料会作为第一批知识源接入项目，后续还能在“知识源接入舱”继续追加。
                </p>
              </div>

              {uploadError ? <p className="text-sm font-semibold text-[#c56a09]">{uploadError}</p> : null}

              <button
                className="presento-button-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCreating || hasActiveUploads}
                onClick={submitProject}
                type="button"
              >
                {hasActiveUploads ? "等待上传完成..." : isCreating ? "正在创建..." : "创建并生成知识地图"}
              </button>
              <Link className="presento-button-secondary w-full" href="/projects/demo/knowledge-map">
                先查看 demo 知识地图
              </Link>
            </div>
          </Card>
        </section>
      </PageWrap>
    </AppFrame>
  );
}
