import { NextResponse } from "next/server";
import { readProjectPracticeTurns } from "@/lib/defense-practice-db";
import { generateDefenseReview } from "@/lib/defense-review";
import { createConfiguredLlmProvider } from "@/lib/llm-provider";
import { getModelRuntimeStatus } from "@/lib/model-config";
import { runDefenseReviewGraph } from "@/lib/skill-graph";
import { writeSkillInvocation } from "@/lib/skill-invocation-db";
import { runSkill } from "@/lib/skill-runner";
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

    const [workspace, turns] = await Promise.all([
      workspacePersistence.readWorkspace(),
      readProjectPracticeTurns(projectId),
    ]);
    const projectName =
      workspace?.project.id === projectId ? workspace.project.name : "课程项目答辩";
    const { output: review, invocation } = await runSkill({
      projectId,
      skillName: "defense-review",
      trigger: "review-api",
      input: {
        projectName,
        practiceTurnCount: turns.length,
      },
      run: async () =>
        runDefenseReviewGraph({
          provider: createConfiguredLlmProvider(),
          projectName,
          turns,
        }),
      fallback: async () =>
        generateDefenseReview({
          projectName,
          turns,
        }),
    });
    await writeSkillInvocation(invocation).catch(() => undefined);

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
