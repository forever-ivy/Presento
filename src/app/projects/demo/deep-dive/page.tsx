import { ArrowRight, Brain, FileText, ListChecks } from "lucide-react";
import Link from "next/link";
import {
  AppFrame,
  Badge,
  Card,
  PageHeader,
  PageWrap,
  Panel,
  SectionHeading,
  TopNav,
} from "@/components/notion-ui";
import { demoDeepDives, demoProject } from "@/lib/demo-data";

export default function DeepDivePage() {
  return (
    <AppFrame>
      <TopNav />
      <PageWrap>
        <PageHeader
          eyebrow={`${demoProject.name} / 项目钻研`}
          title="薄弱点钻研"
          description="把模拟答辩里答不稳的问题，转成证据链、深度追问和可回填到讲稿的回答片段。"
          actions={
            <Link className="notion-button-primary" href="/projects/demo/defense">
              回到同屏答辩
            </Link>
          }
        />

        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card>
            <SectionHeading icon={Brain} title="钻研队列" />
            <div className="flex flex-col gap-2">
              {demoDeepDives.map((item, index) => (
                <button
                  className="rounded-xl border border-[var(--notion-border)] bg-white p-3 text-left text-sm transition hover:bg-[var(--notion-warm)]"
                  key={item.title}
                >
                  <div className="notion-muted mb-1 text-xs font-semibold">
                    薄弱点 {index + 1}
                  </div>
                  <div className="font-bold leading-5">{item.title}</div>
                </button>
              ))}
            </div>
          </Card>

          <div className="flex flex-col gap-5">
            {demoDeepDives.map((item, index) => (
              <Card key={item.title}>
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <Badge tone="orange">薄弱点 {index + 1}</Badge>
                    <h2 className="notion-card-title mt-3">{item.title}</h2>
                    <p className="notion-muted mt-2 text-sm leading-6">{item.evidence}</p>
                  </div>
                  <FileText className="notion-muted" aria-hidden="true" />
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                  <Panel>
                    <SectionHeading title="证据链" />
                    <p className="notion-muted text-sm leading-6">
                      系统会优先引用当前 PPT 页、README、SQL 表结构和代码路径；如果资料不足，则生成“依据不足”的兜底提示，避免编造。
                    </p>
                    <Link
                      className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--notion-blue)] hover:underline"
                      href="/projects/demo/defense"
                    >
                      加入答辩回答
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Panel>

                  <div className="rounded-xl border border-[var(--notion-border)] bg-white p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                      <ListChecks className="text-[var(--notion-blue)]" aria-hidden="true" />
                      学习清单
                    </div>
                    <ul className="flex flex-col gap-2 text-sm leading-6 text-[var(--notion-muted)]">
                      {item.checklist.map((task) => (
                        <li key={task}>- {task}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </PageWrap>
    </AppFrame>
  );
}
