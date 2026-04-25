"use client";

import { Bot, CheckCircle2, Clock, Layers3, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
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
import { demoProject, demoSkillPacks } from "@/lib/demo-data";
import type { ModelRuntimeStatus } from "@/lib/model-config";
import { fetchModelStatus } from "@/lib/model-status-api";
import { fetchProjectBrief } from "@/lib/project-brief-api";
import type { ProjectBrief } from "@/lib/project-brief-skill";
import { fetchSkillInvocations } from "@/lib/skill-invocations-api";
import type { SkillInvocationRecord } from "@/lib/skill-runner";
import { useWorkspace } from "@/lib/use-workspace";

export default function SkillsPage() {
  const { workspace } = useWorkspace();
  const [brief, setBrief] = useState<ProjectBrief | null>(null);
  const [knowledgeChunkCount, setKnowledgeChunkCount] = useState(0);
  const [modelStatus, setModelStatus] = useState<ModelRuntimeStatus | null>(null);
  const [skillInvocations, setSkillInvocations] = useState<SkillInvocationRecord[]>([]);
  const [briefError, setBriefError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const projectId = workspace?.project.id ?? "project-db-smoke";

    async function loadBrief() {
      setBriefError("");
      try {
        const statusPayload = await fetchModelStatus();
        if (cancelled) return;
        setModelStatus(statusPayload.modelStatus);

        const [payload, invocationPayload] = await Promise.all([
          fetchProjectBrief(projectId),
          fetchSkillInvocations(projectId, 8),
        ]);
        if (cancelled) return;
        setBrief(payload.brief);
        setKnowledgeChunkCount(payload.knowledgeChunkCount);
        setModelStatus(payload.modelStatus ?? null);
        setSkillInvocations(invocationPayload.invocations);
      } catch (error) {
        if (cancelled) return;
        setBriefError(error instanceof Error ? error.message : "项目速记卡生成失败");
      }
    }

    void loadBrief();

    return () => {
      cancelled = true;
    };
  }, [workspace?.project.id]);

  return (
    <AppFrame>
      <TopNav />
      <PageWrap>
        <PageHeader
          eyebrow={`${workspace?.project.name ?? demoProject.name} / Agent Skills`}
          title="答辩 Agent Skills"
          description="把讲稿生成、代码解释、数据质疑、老师追问和复盘改答拆成可观察、可测试的能力单元。"
          actions={
            <>
              {modelStatus ? (
                <Badge tone={modelStatus.state === "configured" ? "green" : "orange"}>
                  {modelStatus.label}
                </Badge>
              ) : null}
              <BackLink />
            </>
          }
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
              {modelStatus ? (
                <div className="rounded-xl border border-[var(--notion-border)] bg-white p-3">
                  <div className="mb-1 text-sm font-bold text-[var(--notion-ink)]">
                    {modelStatus.label}
                  </div>
                  <p>{modelStatus.message}</p>
                </div>
              ) : null}
              <p>每个 Skill 都有触发入口、输入输出 schema、引用要求和失败兜底。</p>
              <p>第一版只做平台内置 Skills，不开放第三方市场和用户自定义脚本。</p>
              <p>同屏答辩中，Skill Router 会按当前 PPT 页和用户动作调用对应技能。</p>
            </div>
          </Panel>
        </section>

        <Card>
          <SectionHeading
            icon={MessageSquareText}
            title="项目速记 Skill"
            description={
              workspace
                ? `基于 ${knowledgeChunkCount} 个知识片段生成，可用于冲刺模式和同屏追问。`
                : "创建项目并解析资料后，这里会显示真实的项目速记卡。"
            }
          />
          {brief ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-[var(--notion-border)] bg-[var(--notion-warm)] p-4 text-sm font-semibold leading-6">
                {brief.oneSentence}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {brief.cards.map((card) => (
                  <article
                    className="rounded-xl border border-[var(--notion-border)] bg-white p-4"
                    key={card.title}
                  >
                    <h3 className="mb-3 text-sm font-bold">{card.title}</h3>
                    <div className="flex flex-col gap-2">
                      {card.items.map((item) => (
                        <p
                          className="notion-muted text-sm leading-6"
                          key={`${card.title}-${item}`}
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
              {brief.citations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {brief.citations.slice(0, 4).map((citation) => (
                    <Badge
                      key={`${citation.source}-${citation.lineStart}-${citation.lineEnd}`}
                      tone="gray"
                    >
                      {citation.source} L{citation.lineStart}-{citation.lineEnd}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="notion-muted text-sm leading-6">
              {briefError || "等待真实项目资料入库后生成。"}
            </p>
          )}
        </Card>

        <Card>
          <SectionHeading
            icon={MessageSquareText}
            title="最近 Skill 调用"
            description="真实后端调用记录，用于后续接入 Langfuse trace、用户反馈和 Prompt 回归评测。"
          />
          <div className="grid gap-3 md:grid-cols-2">
            {skillInvocations.length > 0 ? (
              skillInvocations.map((item) => (
              <article
                className="rounded-xl border border-[var(--notion-border)] bg-white p-4"
                key={item.id}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-bold">{skillNameLabel(item.skillName)}</div>
                  {item.status === "success" ? (
                    <CheckCircle2 className="text-[#1aae39]" aria-hidden="true" />
                  ) : (
                    <Clock className="notion-muted" aria-hidden="true" />
                  )}
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge tone={item.status === "success" ? "green" : "orange"}>
                    {skillStatusLabel(item.status)}
                  </Badge>
                  {item.usedFallback ? <Badge tone="orange">本地兜底</Badge> : null}
                  <Badge tone="gray">{item.durationMs}ms</Badge>
                </div>
                <p className="notion-muted text-sm">触发：{item.trigger}</p>
                <p className="mt-2 text-sm leading-6">
                  {item.error ?? skillOutputSummary(item.output)}
                </p>
              </article>
              ))
            ) : (
              <div className="notion-muted rounded-xl border border-dashed border-[var(--notion-border)] bg-white p-4 text-sm">
                还没有 Skill 调用记录。生成速记卡或进行一次同屏答辩后会出现在这里。
              </div>
            )}
          </div>
        </Card>
      </PageWrap>
    </AppFrame>
  );
}

function skillNameLabel(skillName: string) {
  const labels: Record<string, string> = {
    "project-brief": "项目速记",
    "defense-chat": "当前页追问",
    "defense-review": "答辩复盘",
  };
  return labels[skillName] ?? skillName;
}

function skillStatusLabel(status: SkillInvocationRecord["status"]) {
  const labels = {
    success: "成功",
    fallback: "兜底",
    failed: "失败",
  };
  return labels[status];
}

function skillOutputSummary(output: unknown) {
  if (!output || typeof output !== "object") return "已生成结构化输出。";
  if ("oneSentence" in output && typeof output.oneSentence === "string") {
    return output.oneSentence;
  }
  if ("message" in output && typeof output.message === "string") {
    return output.message;
  }
  if ("summary" in output && typeof output.summary === "string") {
    return output.summary;
  }
  return "已生成结构化输出。";
}
