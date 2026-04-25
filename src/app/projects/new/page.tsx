"use client";

import { CheckCircle2, FileUp, Plus, Users } from "lucide-react";
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
} from "@/components/notion-ui";
import { uploadDefenseFiles } from "@/lib/upload-files";
import { useWorkspace } from "@/lib/use-workspace";

const uploadGroups = [
  ["PPT / PDF", "答辩展示材料，第一版会转成逐页预览"],
  ["报告 / README", "用于生成项目速记卡和讲稿依据"],
  ["代码 zip / 仓库链接", "用于代码解释、分工真实性追问"],
  ["CSV / Excel / SQL", "用于数据来源、表结构和指标质疑"],
];

const projectTypes = [
  {
    name: "软件 / AI / 数据类",
    desc: "推荐代码解释、数据库追问、模型或指标质疑等技能。",
  },
  {
    name: "经管 / 文科 / 调研类",
    desc: "推荐研究问题、问卷数据、分析方法和局限性追问。",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const { createWorkspace } = useWorkspace();
  const [projectName, setProjectName] = useState("智能点餐系统课程答辩");
  const [category, setCategory] = useState(projectTypes[0].name);
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
        category,
        ownerScope,
        teammateScope,
        files: uploadedFiles,
      });
      router.push("/projects/demo/files");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AppFrame>
      <TopNav />
      <PageWrap width="max-w-[960px]">
        <PageHeader
          eyebrow="创建课程项目"
          title="新建答辩项目"
          description="先录入项目名称、类型和小组分工，再上传 PPT、报告、代码和数据资料。"
          actions={<BackLink href="/" label="返回工作台" />}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <SectionHeading
              title="项目基础信息"
              description="MVP 先以个人使用为主，但保留小组分工、负责范围和答辩顺序。"
            />

            <div className="flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">项目名称</span>
                <input
                  className="rounded-[4px] border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--notion-focus)]"
                  onChange={(event) => setProjectName(event.target.value)}
                  value={projectName}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                {projectTypes.map((type) => (
                  <button
                    className={`rounded-xl border p-4 text-left transition hover:bg-[var(--notion-warm)] ${
                      category === type.name
                        ? "border-[var(--notion-blue)] bg-[#f2f9ff]"
                        : "border-[var(--notion-border)] bg-white"
                    }`}
                    key={type.name}
                    onClick={() => setCategory(type.name)}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <CheckCircle2
                          className={
                            category === type.name
                              ? "text-[var(--notion-blue)]"
                              : "notion-faint"
                          }
                          aria-hidden="true"
                        />
                        {type.name}
                      </div>
                      {category === type.name ? <Badge>已选择</Badge> : null}
                    </div>
                    <p className="notion-muted text-sm leading-6">{type.desc}</p>
                  </button>
                ))}
              </div>

              <Panel>
                <SectionHeading icon={Users} title="小组语义" />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-[4px] border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--notion-focus)]"
                    onChange={(event) => setOwnerScope(event.target.value)}
                    value={ownerScope}
                  />
                  <input
                    className="rounded-[4px] border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--notion-focus)]"
                    onChange={(event) => setTeammateScope(event.target.value)}
                    value={teammateScope}
                  />
                </div>
              </Panel>

              <Panel>
                <SectionHeading icon={FileUp} title="上传项目资料" />
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--notion-border)] bg-white px-4 py-8 text-center transition hover:bg-[var(--notion-warm)]">
                  <FileUp className="mb-3 text-[var(--notion-blue)]" aria-hidden="true" />
                  <span className="text-sm font-bold">选择 PPT、报告、代码 zip 或数据表</span>
                  <span className="notion-muted mt-1 text-sm">
                    当前会先保存到本地工作区，下一步进入解析与知识库任务。
                  </span>
                  <input
                    className="sr-only"
                    multiple
                    onChange={(event) =>
                      setSelectedFiles(event.target.files ? Array.from(event.target.files) : [])
                    }
                    type="file"
                  />
                </label>

                {selectedFiles.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-2">
                    {selectedFiles.map((file) => (
                      <div
                        className="flex items-center justify-between rounded-lg border border-[var(--notion-border)] bg-white px-3 py-2 text-sm"
                        key={`${file.name}-${file.size}`}
                      >
                        <span className="truncate font-medium">{file.name}</span>
                        <span className="notion-muted shrink-0 text-xs">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {uploadError ? (
                  <p className="mt-3 text-sm font-semibold text-[#dd5b00]">
                    {uploadError}
                  </p>
                ) : null}
              </Panel>
            </div>
          </Card>

          <Card>
            <SectionHeading
              icon={FileUp}
              title="推荐上传"
              description="第一版优先围绕常见课程项目资料建立知识库。"
            />
            <div className="flex flex-col gap-3">
              {uploadGroups.map(([title, desc]) => (
                <div
                  className="rounded-xl border border-[var(--notion-border)] bg-[var(--notion-warm)] p-3"
                  key={title}
                >
                  <div className="text-sm font-bold">{title}</div>
                  <p className="notion-muted mt-1 text-sm leading-5">{desc}</p>
                </div>
              ))}
            </div>
            <button
              className="notion-button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUploading}
              onClick={submitProject}
            >
              <Plus aria-hidden="true" />
              {isUploading ? "正在上传并创建..." : "创建并进入资料库"}
            </button>
            <Link
              className="mt-3 inline-flex w-full justify-center text-sm font-semibold text-[var(--notion-blue)] hover:underline"
              href="/projects/demo/files"
            >
              先查看 demo 资料库
            </Link>
          </Card>
        </section>
      </PageWrap>
    </AppFrame>
  );
}
