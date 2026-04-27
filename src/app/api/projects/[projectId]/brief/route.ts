import { NextResponse } from "next/server";
import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createProjectRepository } from "@db/repositories/projects";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { readProjectKnowledgeChunks } from "@/lib/knowledge-db";
import { getModelRuntimeStatus } from "@/lib/model-config";
import { workspacePersistence } from "@/lib/workspace-persistence";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const [workspace, project, chunks] = await Promise.all([
      workspacePersistence.readWorkspace(),
      createProjectRepository().read(projectId),
      readProjectKnowledgeChunks(projectId),
    ]);
    const projectName =
      project?.name ?? (workspace?.project.id === projectId ? workspace.project.name : "课程项目答辩");
    const { output: brief, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName,
      skillId: "project_brief",
      trigger: "brief-api",
      payload: {
        chunks,
      },
    });
    await createSkillInvocationRepository().write(invocation).catch(() => undefined);

    return NextResponse.json({
      brief,
      knowledgeChunkCount: chunks.length,
      skillInvocationId: invocation.id,
      skillStatus: invocation.status,
      modelStatus: getModelRuntimeStatus(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Project brief generation failed.",
      },
      { status: 500 },
    );
  }
}
