"use client";

import { Database, FileText, FileUp, Search, Upload } from "lucide-react";
import { useMemo, useState } from "react";
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
import { demoFiles, demoProject } from "@/lib/demo-data";
import { filesToInputs, useWorkspace } from "@/lib/use-workspace";

export default function FilesPage() {
  const { workspace, summary, addFiles, isLoaded } = useWorkspace();
  const [query, setQuery] = useState("");

  const files = useMemo(() => {
    const workspaceFiles = workspace?.files.map((file) => ({
      name: file.name,
      type: kindLabel(file.kind),
      status: file.status,
      source: file.source,
    }));

    return workspaceFiles?.length ? workspaceFiles : demoFiles;
  }, [workspace]);

  const filteredFiles = files.filter((file) => {
    const text = `${file.name} ${file.type} ${file.status} ${file.source}`.toLowerCase();
    return text.includes(query.toLowerCase());
  });

  function uploadMore(files: FileList | null) {
    if (!files?.length) return;
    addFiles(filesToInputs(files));
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
          </Card>

          <aside className="flex flex-col gap-5">
            <Panel>
              <SectionHeading icon={Upload} title="上传模板" />
              <p className="notion-muted text-sm leading-6">
                第一版推荐 PDF/PPT、README、代码 zip、SQL、CSV/Excel。其他专业源文件先作为附件记录。
              </p>
              <label className="notion-button-primary mt-4 w-full cursor-pointer">
                <FileUp aria-hidden="true" />
                继续添加文件
                <input
                  className="sr-only"
                  multiple
                  onChange={(event) => uploadMore(event.target.files)}
                  type="file"
                />
              </label>
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
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={summary?.hasPresentation ? "blue" : "gray"}>PPT / PDF</Badge>
                <Badge tone={summary?.hasCode ? "blue" : "gray"}>代码包</Badge>
                <Badge tone={summary?.hasDataOrDatabase ? "blue" : "gray"}>数据 / SQL</Badge>
              </div>
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
