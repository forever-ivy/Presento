import { Bot, CheckCircle2, Clock, Layers3, MessageSquareText } from "lucide-react";
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
import { demoProject, demoSkillInvocations, demoSkillPacks } from "@/lib/demo-data";

export default function SkillsPage() {
  return (
    <AppFrame>
      <TopNav />
      <PageWrap>
        <PageHeader
          eyebrow={`${demoProject.name} / Agent Skills`}
          title="答辩 Agent Skills"
          description="把讲稿生成、代码解释、数据质疑、老师追问和复盘改答拆成可观察、可测试的能力单元。"
          actions={<BackLink />}
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <SectionHeading
              icon={Bot}
              title="技能包"
              description="MVP 只开放平台内置 Skills，不做第三方市场。"
            />
            <div className="grid gap-3 md:grid-cols-2">
              {demoSkillPacks.map((pack) => (
                <article
                  className="rounded-xl border border-[var(--notion-border)] bg-white p-4 transition hover:bg-[var(--notion-warm)]"
                  key={pack.name}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold">{pack.name}</h3>
                    <Badge tone={pack.enabled ? "green" : "gray"}>
                      {pack.enabled ? "已启用" : "可启用"}
                    </Badge>
                  </div>
                  <p className="notion-muted text-sm leading-6">{pack.desc}</p>
                </article>
              ))}
            </div>
          </Card>

          <Panel>
            <SectionHeading icon={Layers3} title="运行原则" />
            <div className="flex flex-col gap-3 text-sm leading-6 text-[var(--notion-muted)]">
              <p>每个 Skill 都有触发入口、输入输出 schema、引用要求和失败兜底。</p>
              <p>第一版只做平台内置 Skills，不开放第三方市场和用户自定义脚本。</p>
              <p>同屏答辩中，Skill Router 会按当前 PPT 页和用户动作调用对应技能。</p>
            </div>
          </Panel>
        </section>

        <Card>
          <SectionHeading
            icon={MessageSquareText}
            title="最近 Skill 调用"
            description="用于后续接入 Langfuse trace、用户反馈和 Prompt 回归评测。"
          />
          <div className="grid gap-3 md:grid-cols-2">
            {demoSkillInvocations.map((item) => (
              <article
                className="rounded-xl border border-[var(--notion-border)] bg-white p-4"
                key={item.skill}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-bold">{item.skill}</div>
                  {item.status === "成功" ? (
                    <CheckCircle2 className="text-[#1aae39]" aria-hidden="true" />
                  ) : (
                    <Clock className="notion-muted" aria-hidden="true" />
                  )}
                </div>
                <p className="notion-muted text-sm">触发：{item.trigger}</p>
                <p className="mt-2 text-sm leading-6">{item.result}</p>
              </article>
            ))}
          </div>
        </Card>
      </PageWrap>
    </AppFrame>
  );
}
