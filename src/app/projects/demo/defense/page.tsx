"use client";

import { ArrowRight, Bot, Send, Timer } from "lucide-react";
import { useState } from "react";
import { demoDefenseTurns, demoProject } from "@/lib/demo-data";
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
} from "@/components/notion-ui";

export default function DefensePage() {
  const [turns, setTurns] = useState(demoDefenseTurns);
  const [answer, setAnswer] = useState("");
  const [activeHint, setActiveHint] = useState("回答框架");

  function sendAnswer() {
    if (!answer.trim()) return;
    setTurns([
      ...turns,
      { speaker: "我", content: answer },
      {
        speaker: "AI 老师",
        content:
          "我会继续追问：你刚才提到后端校验订单状态，请说明这个校验发生在哪个接口，以及异常时前端如何提示用户。",
      },
    ]);
    setAnswer("");
  }

  return (
    <AppFrame>
      <TopNav />
      <PageWrap width="max-w-[1280px]">
        <PageHeader
          eyebrow={`${demoProject.name} / PPT 同屏实时答辩`}
          title="严格老师 · 第 2 页系统架构"
          description="左侧保持当前 PPT 画面，右侧实时追问和记录回答，让练习尽量贴近真实答辩现场。"
          actions={
            <>
              <BackLink />
              <span className="notion-button-primary">
                <Timer aria-hidden="true" />
                05:00
              </span>
            </>
          }
        />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <SectionHeading
              title="当前幻灯片"
              description="Slide 02 / 系统设计。AI 追问会绑定这一页的画面和讲稿。"
              action={<Badge>已加载逐页讲稿</Badge>}
            />

            <Panel className="p-5">
              <div className="aspect-[16/9] rounded-2xl border border-[var(--notion-border)] bg-white p-8 shadow-[var(--notion-card-shadow)]">
                <div className="notion-muted mb-8 flex items-center justify-between text-sm">
                  <span>Slide 02</span>
                  <span>系统设计</span>
                </div>
                <h2 className="notion-title text-[2.5rem]">系统架构</h2>
                <div className="mt-10 grid gap-3 text-base md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                  {["前端点餐", "后端订单服务", "数据库与后厨看板"].map(
                    (item, index) => (
                      <div className="contents" key={item}>
                        <div className="rounded-xl border border-[var(--notion-border)] bg-[var(--notion-warm)] p-4 text-center font-semibold">
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
            </Panel>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {["订单流转", "状态机", "个人负责后端接口"].map((keyword) => (
                <div
                  className="rounded-xl border border-[var(--notion-border)] bg-white p-3 text-sm font-semibold"
                  key={keyword}
                >
                  {keyword}
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex min-h-[660px] flex-col p-0">
            <div className="border-b border-[var(--notion-border)] p-5">
              <SectionHeading
                icon={Bot}
                title="当前页追问 Skill"
                description="已绑定第 2 页，追问聚焦状态流转、接口权限和异常处理。"
                action={<Badge>运行中</Badge>}
              />
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-auto p-5">
              {turns.map((turn, index) => (
                <div
                  className={cn(
                    "rounded-xl border p-4 text-sm leading-6",
                    turn.speaker === "我"
                      ? "ml-8 border-[#d6eaff] bg-[#f2f9ff]"
                      : "border-[var(--notion-border)] bg-[var(--notion-warm)]",
                  )}
                  key={`${turn.speaker}-${index}`}
                >
                  <div className="notion-muted mb-1 text-xs font-semibold">
                    {turn.speaker}
                  </div>
                  {turn.content}
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--notion-border)] p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {["给我关键词", "回答框架", "完整参考答案", "去钻研"].map((item) => (
                  <button
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      activeHint === item
                        ? "bg-[#f2f9ff] text-[var(--notion-focus)]"
                        : "bg-[rgba(0,0,0,0.05)] hover:bg-[rgba(0,0,0,0.075)]",
                    )}
                    key={item}
                    onClick={() => setActiveHint(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-[4px] border border-[#dddddd] px-3 py-2 text-sm outline-none placeholder:text-[var(--notion-faint)] focus:border-[var(--notion-focus)]"
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") sendAnswer();
                  }}
                  placeholder="输入你的回答..."
                  value={answer}
                />
                <button className="notion-button-primary" onClick={sendAnswer}>
                  <Send aria-hidden="true" />
                  发送
                </button>
              </div>
            </div>
          </Card>
        </section>
      </PageWrap>
    </AppFrame>
  );
}
