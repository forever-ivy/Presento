import { NextResponse } from "next/server";
import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createProjectRepository } from "@db/repositories/projects";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { readProjectPracticeTurns } from "@/lib/defense-practice-db";
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

    const [workspace, project, turns] = await Promise.all([
      workspacePersistence.readWorkspace(),
      createProjectRepository().read(projectId),
      readProjectPracticeTurns(projectId),
    ]);
    const projectName =
      project?.name ?? (workspace?.project.id === projectId ? workspace.project.name : "课程项目答辩");
    const { output: review, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName,
      skillId: "review_report",
      trigger: "review-api",
      payload: {
        turns,
      },
    });
    await createSkillInvocationRepository().write(invocation).catch(() => undefined);

    return NextResponse.json({
      review,
      practiceTurnCount: turns.length,
      skillInvocationId: invocation.id,
      skillStatus: invocation.status,
      modelStatus: getModelRuntimeStatus(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Defense review failed.",
      },
      { status: 500 },
    );
  }
}
