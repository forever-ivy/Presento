"use client";

import { CheckCircle2, FileUp, Map, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AppFrame,
  BackLink,
  Badge,
  Card,
  PageHeader,
  PageWrap,
  Panel,
  SectionHeading,
  TopNav,
  cn,
} from "@/components/presento-ui";
import { uploadDefenseFiles } from "@/lib/upload-files";
import { useWorkspace } from "@/lib/use-workspace";

const scenarios = ["课程项目答辩", "毕设答辩", "小组展示", "比赛路演", "社团宣讲", "实习汇报"];
const uploadGroups = [
  ["PPT / PDF", "用于逐页讲稿和同屏讲练"],
  ["报告 / README", "用于项目速记卡和证据链"],
  ["代码 zip", "用于代码解释和分工真实性追问"],
  ["SQL / CSV / Excel", "用于数据库和数据来源质疑"],
];

export default function NewProjectPage() {
  const router = useRouter();
  const { createWorkspace } = useWorkspace();
  const [projectName, setProjectName] = useState("智能点餐系统课程答辩");
  const [category, setCategory] = useState("软件 / AI / 数据类");
  const [scenario, setScenario] = useState(scenarios[0]);
  const [ownerScope, setOwnerScope] = useState("我负责：后端订单接口");
  const [teammateScope, setTeammateScope] = useState("队友负责：前端页面 / 数据库");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function submitProject() {
    setIsUploading(true);
    setUploadError("");

    try {
      const uploadedFiles = await uploadDefenseFiles(selectedFiles);
      createWorkspace({
        name: projectName,
        category: `${scenario} · ${category}`,
        ownerScope,
        teammateScope,
        files: uploadedFiles,
      });
      router.push("/projects/demo/knowledge-map");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AppFrame>
      <TopNav />
      <PageWrap width="max-w-[1180px]">
        <PageHeader
          eyebrow="训练启动舱"
          title="创建一个可讲练、可追问、可复盘的项目"
          description="先选择表达场景，再导入资料和负责范围。创建后进入项目知识地图，而不是普通文件夹。"
          actions={<BackLink href="/" label="返回工作台" />}
        />

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <SectionHeading icon={Map} title="1. 选择表达场景" />
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

            <Panel className="mt-6">
              <SectionHeading icon={Users} title="2. 负责范围" />
              <div className="grid gap-3 md:grid-cols-2">
                <input className="presento-input" onChange={(event) => setOwnerScope(event.target.value)} value={ownerScope} />
                <input className="presento-input" onChange={(event) => setTeammateScope(event.target.value)} value={teammateScope} />
              </div>
            </Panel>

            <Panel className="mt-6">
              <SectionHeading icon={FileUp} title="3. 导入资料" />
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--presento-border)] bg-white px-4 py-8 text-center transition hover:bg-[var(--presento-warm)]">
                <FileUp className="mb-3 text-[var(--presento-blue)]" aria-hidden="true" />
                <span className="text-sm font-black">选择 PPT、报告、代码 zip 或数据表</span>
                <span className="presento-muted mt-1 text-sm">
                  上传后进入知识源接入舱，生成项目知识地图。
                </span>
                <input
                  className="sr-only"
                  multiple
                  onChange={(event) => setSelectedFiles(event.target.files ? Array.from(event.target.files) : [])}
                  type="file"
                />
              </label>
              {selectedFiles.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2">
                  {selectedFiles.map((file) => (
                    <div className="flex items-center justify-between rounded-xl border border-[var(--presento-border)] bg-white px-3 py-2 text-sm" key={`${file.name}-${file.size}`}>
                      <span className="truncate font-semibold">{file.name}</span>
                      <span className="presento-muted shrink-0 text-xs">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {uploadError ? <p className="mt-3 text-sm font-semibold text-[#c56a09]">{uploadError}</p> : null}
            </Panel>
          </Card>

          <Card>
            <SectionHeading icon={CheckCircle2} title="生成项目知识地图" />
            <div className="flex flex-col gap-3">
              {uploadGroups.map(([title, desc]) => (
                <div className="rounded-2xl border border-[var(--presento-border)] bg-[var(--presento-warm)] p-4" key={title}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-black">{title}</div>
                    <Badge tone="blue">建议</Badge>
                  </div>
                  <p className="presento-muted text-sm leading-5">{desc}</p>
                </div>
              ))}
            </div>
            <button className="presento-button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isUploading} onClick={submitProject}>
              <Plus aria-hidden="true" />
              {isUploading ? "正在创建..." : "创建并生成知识地图"}
            </button>
            <Link className="presento-button-secondary mt-3 w-full" href="/projects/demo/knowledge-map">
              先查看 demo 知识地图
            </Link>
          </Card>
        </section>
      </PageWrap>
    </AppFrame>
  );
}
