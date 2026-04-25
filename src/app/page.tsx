"use client";

import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Bot,
  CheckCircle2,
  Code2,
  Database,
  FileQuestion,
  FileText,
  Gauge,
  Layers3,
  MessageSquareText,
  PanelRightOpen,
  Play,
  Search,
  ShieldQuestion,
  Sparkles,
  Timer,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AppFrame,
  Badge,
  Card,
  PageHeader,
  PageWrap,
  Panel,
  ProgressBar,
  SectionHeading,
  TopNav,
  cn,
} from "@/components/notion-ui";
import { useWorkspace } from "@/lib/use-workspace";

const prepCards = [
  {
    title: "项目速记卡",
    desc: "一句话介绍、模块、技术路线、分工",
    progress: 100,
    status: "已生成",
    icon: FileText,
  },
  {
    title: "逐页讲稿",
    desc: "正常版、30 秒版、关键词版",
    progress: 78,
    status: "待确认 3 页",
    icon: Layers3,
  },
  {
    title: "高危追问",
    desc: "技术选型、数据来源、分工真实性",
    progress: 64,
    status: "发现 8 个",
    icon: ShieldQuestion,
  },
  {
    title: "代码 / 数据解释",
    desc: "核心文件、接口流程、样本和变量",
    progress: 52,
    status: "3 个薄弱点",
    icon: Code2,
  },
  {
    title: "PPT 同屏答辩",
    desc: "对着当前页和 AI 老师实时练",
    progress: 34,
    status: "未完成训练",
    icon: MessageSquareText,
  },
  {
    title: "复盘报告",
    desc: "危险回答、改答版本、下一轮重点",
    progress: 0,
    status: "训练后生成",
    icon: Gauge,
  },
];

const skills = [
  { name: "项目速记", pack: "表达冲刺", state: "已运行", icon: BookOpen },
  { name: "当前页追问", pack: "PPT 同屏", state: "待触发", icon: FileQuestion },
  { name: "代码解释", pack: "软件项目", state: "发现薄弱点", icon: Code2 },
  { name: "数据质疑", pack: "数据项目", state: "已启用", icon: Database },
  { name: "兜底回答", pack: "表达冲刺", state: "可调用", icon: BadgeCheck },
];

const slideNotes = [
  {
    page: "01",
    title: "项目背景与痛点",
    note: "用 20 秒讲清堂食高峰排队、人工记录容易出错、后厨同步慢这三个痛点。",
    risk: "老师可能追问：你们是否调研过真实店铺流程？",
  },
  {
    page: "02",
    title: "系统架构",
    note: "重点说明前端点餐、后端订单服务、数据库和后厨看板之间的数据流。",
    risk: "老师可能追问：为什么订单状态不直接存在前端？",
  },
  {
    page: "03",
    title: "数据库设计",
    note: "讲清 users、orders、order_items、dishes 四张表的关系和订单明细的拆分原因。",
    risk: "老师可能追问：订单金额为什么要冗余保存？",
  },
];

const initialMessages = [
  {
    role: "teacher",
    text: "你正在讲第 2 页系统架构。先用 30 秒说明一次数据从用户下单到后厨接单的流程。",
  },
  {
    role: "student",
    text: "用户在前端选择菜品后提交订单，后端写入订单表和订单明细表，然后后厨看板读取待处理订单。",
  },
  {
    role: "teacher",
    text: "这里我会继续追问：如果后厨已经接单，用户还能取消订单吗？你的状态设计怎么处理？",
  },
];

const weaknesses = [
  "订单状态流转解释不够完整",
  "数据库冗余字段缺少依据",
  "个人负责模块需要说得更明确",
];

export default function Home() {
  const [activeMode, setActiveMode] = useState<"sprint" | "deep">("sprint");
  const [activeSlide, setActiveSlide] = useState(1);
  const [messages, setMessages] = useState(initialMessages);
  const [answer, setAnswer] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("当前页追问");
  const { workspace, summary } = useWorkspace();

  const demoReadiness = useMemo(() => {
    return Math.round(
      prepCards.reduce((sum, card) => sum + card.progress, 0) / prepCards.length,
    );
  }, []);
  const readiness = summary?.readiness ?? demoReadiness;
  const projectName = workspace?.project.name ?? "智能点餐系统课程答辩";
  const projectCategory = workspace?.project.category ?? "软件与数据类";

  const currentSlide = slideNotes[activeSlide];

  function submitAnswer() {
    if (!answer.trim()) return;

    setMessages([
      ...messages,
      { role: "student", text: answer },
      {
        role: "teacher",
        text:
          activeSlide === 2
            ? "这个回答有方向。再补一句：后端如何避免订单状态被前端随意篡改？"
            : "我会继续追问：这一页里哪一部分是你本人负责的？请结合项目资料说明。",
      },
    ]);
    setAnswer("");
    setSelectedSkill("当前页追问");
  }

  return (
    <AppFrame>
      <TopNav />
      <PageWrap>
        <PageHeader
          eyebrow={`课程项目 / ${projectCategory}`}
          title={projectName}
          description="把 PPT、代码、报告和数据整理成一个可以练习、追问和复盘的答辩工作区。"
          actions={
            <>
              <Link className="notion-button-secondary" href="/projects/demo/files">
                <Search aria-hidden="true" />
                搜索资料
              </Link>
              <Link className="notion-button-primary" href="/projects/demo/defense">
                <Play aria-hidden="true" />
                开始同屏答辩
              </Link>
            </>
          }
        />

        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["总体准备度", `${readiness}%`, "已覆盖 6 个准备任务"],
            ["已完成任务", workspace ? `${summary?.fileCount ?? 0} 个文件` : "4 / 12", "讲稿与速记卡优先"],
            ["剩余时间", "2 天", "建议今天完成一次模拟"],
            ["高危问题", "8 个", "3 个需要进入钻研"],
          ].map(([label, value, desc]) => (
            <Card className="p-4" key={label}>
              <div className="notion-muted text-xs font-medium">{label}</div>
              <div className="mt-3 text-[2rem] font-bold leading-none tracking-[-1px]">
                {value}
              </div>
              <p className="notion-muted mt-2 text-sm leading-5">{desc}</p>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <Badge>
                    <Timer aria-hidden="true" />
                    距离答辩 2 天
                  </Badge>
                  <h2 className="notion-title mt-4 text-[1.625rem]">答辩准备台</h2>
                  <p className="notion-muted mt-2 max-w-2xl text-base leading-7">
                    系统把资料理解、讲稿、追问和复盘拆成可检查任务，避免只拿到一份无法上台的生成稿。
                  </p>
                </div>
                <div className="w-full rounded-xl border border-[var(--notion-border)] bg-[var(--notion-warm)] p-4 md:w-60">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>准备度</span>
                    <span className="notion-blue">{readiness}%</span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={readiness} />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {prepCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      className="rounded-xl border border-[var(--notion-border)] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--notion-card-shadow)]"
                      key={card.title}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg border border-[var(--notion-border)] bg-[var(--notion-warm)]">
                          <Icon aria-hidden="true" />
                        </div>
                        <Badge tone={card.progress === 100 ? "green" : "gray"}>
                          {card.status}
                        </Badge>
                      </div>
                      <h3 className="text-base font-bold tracking-[-0.25px]">
                        {card.title}
                      </h3>
                      <p className="notion-muted mt-2 min-h-10 text-sm leading-5">
                        {card.desc}
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        <div className="flex-1">
                          <ProgressBar value={card.progress} />
                        </div>
                        <span className="notion-muted w-8 text-right text-xs">
                          {card.progress}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
              <Card>
                <SectionHeading
                  icon={Layers3}
                  title="逐页讲稿"
                  description="绑定 PPT 当前页、资料来源和用户负责范围。后续用 Tiptap 编辑。"
                  action={
                    <div className="flex rounded-full bg-[rgba(0,0,0,0.05)] p-1">
                      {(["sprint", "deep"] as const).map((mode) => (
                        <button
                          className={cn(
                            "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                            activeMode === mode
                              ? "bg-white text-[var(--notion-blue)] shadow-[var(--notion-card-shadow)]"
                              : "notion-muted hover:text-[rgba(0,0,0,0.95)]",
                          )}
                          key={mode}
                          onClick={() => setActiveMode(mode)}
                        >
                          {mode === "sprint" ? "答辩冲刺" : "项目钻研"}
                        </button>
                      ))}
                    </div>
                  }
                />

                <div className="flex flex-col gap-3">
                  {slideNotes.map((slide, index) => (
                    <button
                      className={cn(
                        "rounded-xl border p-4 text-left transition",
                        activeSlide === index
                          ? "border-[var(--notion-blue)] bg-[#f2f9ff]"
                          : "border-[var(--notion-border)] bg-white hover:bg-[var(--notion-warm)]",
                      )}
                      key={slide.page}
                      onClick={() => setActiveSlide(index)}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-bold">
                          {slide.page}. {slide.title}
                        </span>
                        {activeSlide === index ? (
                          <CheckCircle2 className="text-[var(--notion-blue)]" aria-hidden="true" />
                        ) : null}
                      </div>
                      <p className="notion-muted text-sm leading-6">
                        {activeMode === "sprint" ? slide.note : slide.risk}
                      </p>
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionHeading
                  icon={MessageSquareText}
                  title="PPT 同屏实时答辩"
                  description="AI 老师围绕当前页追问，不是泛泛聊天。"
                  action={<Badge>{selectedSkill}</Badge>}
                />

                <Panel className="p-4">
                  <div className="aspect-[16/9] rounded-xl border border-[var(--notion-border)] bg-white p-5 shadow-[var(--notion-card-shadow)]">
                    <div className="notion-muted mb-5 flex items-center justify-between text-xs">
                      <span>Slide {currentSlide.page}</span>
                      <span>系统设计</span>
                    </div>
                    <h3 className="text-[1.625rem] font-bold tracking-[-0.625px]">
                      {currentSlide.title}
                    </h3>
                    <div className="mt-6 grid gap-2 text-sm md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                      {["前端点餐", "后端订单服务", "数据库与后厨看板"].map(
                        (item, index) => (
                          <div className="contents" key={item}>
                            <div className="rounded-lg border border-[var(--notion-border)] bg-[var(--notion-warm)] p-2 text-center">
                              {item}
                            </div>
                            {index < 2 ? (
                              <ArrowRight
                                className="notion-muted hidden md:block"
                                aria-hidden="true"
                              />
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                  <p className="notion-muted mt-3 text-sm leading-6">
                    关键词：订单流转、状态机、数据库一致性、个人负责后端接口。
                  </p>
                </Panel>

                <div className="mt-4 flex min-h-[360px] flex-col rounded-xl border border-[var(--notion-border)] bg-white">
                  <div className="border-b border-[var(--notion-border)] px-4 py-3 text-sm font-bold">
                    严格老师 · 正常难度
                  </div>
                  <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
                    {messages.map((message, index) => (
                      <div
                        className={cn(
                          "rounded-xl border p-3 text-sm leading-6",
                          message.role === "teacher"
                            ? "border-[var(--notion-border)] bg-[var(--notion-warm)]"
                            : "ml-6 border-[#d6eaff] bg-[#f2f9ff]",
                        )}
                        key={`${message.role}-${index}`}
                      >
                        <div className="notion-muted mb-1 text-xs font-semibold">
                          {message.role === "teacher" ? "AI 老师" : "我"}
                        </div>
                        {message.text}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[var(--notion-border)] p-4">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {["给我关键词", "回答框架", "完整参考答案", "去钻研"].map(
                        (action) => (
                          <button
                            className="rounded-full bg-[rgba(0,0,0,0.05)] px-3 py-1.5 text-xs font-semibold transition hover:bg-[rgba(0,0,0,0.075)]"
                            key={action}
                            onClick={() => setSelectedSkill(action)}
                          >
                            {action}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-[4px] border border-[#dddddd] bg-white px-3 py-2 text-sm outline-none placeholder:text-[var(--notion-faint)] focus:border-[var(--notion-focus)]"
                        onChange={(event) => setAnswer(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") submitAnswer();
                        }}
                        placeholder="输入你的回答..."
                        value={answer}
                      />
                      <button className="notion-button-primary" onClick={submitAnswer}>
                        发送
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {weaknesses.map((item, index) => (
                <Card className="p-4" key={item}>
                  <div className="mb-4 flex items-center justify-between">
                    <Badge tone="orange">薄弱点 {index + 1}</Badge>
                    <PanelRightOpen className="notion-muted" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-bold tracking-[-0.25px]">{item}</h3>
                  <p className="notion-muted mt-2 text-sm leading-6">
                    点击进入项目钻研，生成证据链、深度追问和可加入讲稿的回答。
                  </p>
                </Card>
              ))}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <Card>
              <SectionHeading
                icon={Bot}
                title="Agent Skills"
                description="内置一方答辩技能，按当前页面上下文触发。"
              />
              <div className="flex flex-col gap-2">
                {skills.map((skill) => {
                  const Icon = skill.icon;
                  return (
                    <button
                      className={cn(
                        "rounded-xl border p-3 text-left transition",
                        selectedSkill === skill.name
                          ? "border-[var(--notion-blue)] bg-[#f2f9ff]"
                          : "border-[var(--notion-border)] hover:bg-[var(--notion-warm)]",
                      )}
                      key={skill.name}
                      onClick={() => setSelectedSkill(skill.name)}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Icon className="text-[var(--notion-blue)]" aria-hidden="true" />
                        <span className="text-sm font-bold">{skill.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="notion-muted">{skill.pack}</span>
                        <span className="notion-muted">{skill.state}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <SectionHeading icon={Sparkles} title="推荐技能包" />
              <div className="flex flex-col gap-3">
                {[
                  ["软件项目答辩", "代码解释、数据库追问、分工真实性"],
                  ["表达冲刺", "逐页讲稿、30 秒压缩、兜底回答"],
                  ["数据项目答辩", "数据来源、指标质疑、实验复盘"],
                ].map(([title, desc]) => (
                  <div
                    className="rounded-xl border border-[var(--notion-border)] bg-[var(--notion-warm)] p-3"
                    key={title}
                  >
                    <div className="text-sm font-bold">{title}</div>
                    <div className="notion-muted mt-1 text-sm leading-5">{desc}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionHeading icon={Upload} title="资料解析状态" />
              <div className="flex flex-col gap-3 text-sm">
                {[
                  ["答辩 PPT.pdf", "已生成 18 页预览"],
                  ["README.md", "已入库"],
                  ["backend.zip", "Repomix 处理中"],
                  ["orders.sql", "已解析表结构"],
                ].map(([file, state]) => (
                  <div
                    className="flex items-center justify-between gap-3 border-b border-[var(--notion-border)] pb-3 last:border-b-0 last:pb-0"
                    key={file}
                  >
                    <span className="truncate font-medium">{file}</span>
                    <span className="notion-muted shrink-0 text-xs">{state}</span>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </section>
      </PageWrap>
    </AppFrame>
  );
}
