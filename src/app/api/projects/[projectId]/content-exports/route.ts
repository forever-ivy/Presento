import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createContentExportRepository } from "@db/repositories/content-exports";
import { createProjectRepository } from "@db/repositories/projects";
import { createReviewRepository } from "@db/repositories/reviews";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../_utils";

export const runtime = "nodejs";

const contentExportSchema = z.object({
  summary: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const exports = await createContentExportRepository().list(projectId);
    return apiOk({ exports });
  } catch (error) {
    return apiError(500, "content_exports_read_failed", error instanceof Error ? error.message : "Failed to read content exports.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const project = await createProjectRepository().read(projectId);
    if (!project) return notFound("Project");

    const payload = contentExportSchema.parse(await request.json().catch(() => ({})));
    const weaknesses = await createReviewRepository().listWeaknesses(projectId);
    const summary = payload.summary ?? `${project.name} 当前待补强点：${weaknesses.slice(0, 2).map((item) => item.title).join("、") || "已完成一轮训练复盘"}`;
    const { output, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName: project.name,
      skillId: "content_repurpose",
      trigger: "content_export",
      payload: { summary },
    });
    await createSkillInvocationRepository().write(invocation);

    const content = output as {
      qqSpaceSummary: string;
      weishiScript: string;
      tencentVideoScript: string;
    };
    const repository = createContentExportRepository();
    const createdAt = new Date().toISOString();
    const exports = await Promise.all([
      repository.create({
        id: `export-${crypto.randomUUID()}`,
        projectId,
        kind: "qq-space-summary",
        title: "QQ 空间答辩摘要",
        content: { text: content.qqSpaceSummary },
        status: "generated",
        createdAt,
      }),
      repository.create({
        id: `export-${crypto.randomUUID()}`,
        projectId,
        kind: "weishi-script",
        title: "微视口播脚本",
        content: { text: content.weishiScript },
        status: "generated",
        createdAt,
      }),
      repository.create({
        id: `export-${crypto.randomUUID()}`,
        projectId,
        kind: "tencent-video-script",
        title: "腾讯视频展示脚本",
        content: { text: content.tencentVideoScript },
        status: "generated",
        createdAt,
      }),
    ]);

    return apiOk({ exports, skillInvocation: invocation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_content_export_payload", "Invalid content export payload.", error.flatten());
    }
    return apiError(500, "content_export_failed", error instanceof Error ? error.message : "Failed to generate content exports.");
  }
}
