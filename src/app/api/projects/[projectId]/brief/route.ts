import { NextResponse } from "next/server";
import { readProjectKnowledgeChunks } from "@/lib/knowledge-db";
import { createConfiguredLlmProvider } from "@/lib/llm-provider";
import { getModelRuntimeStatus } from "@/lib/model-config";
import { generateProjectBrief } from "@/lib/project-brief-skill";
import { runProjectBriefGraph } from "@/lib/skill-graph";
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

    const [workspace, chunks] = await Promise.all([
      workspacePersistence.readWorkspace(),
      readProjectKnowledgeChunks(projectId),
    ]);
    const projectName =
      workspace?.project.id === projectId ? workspace.project.name : "课程项目答辩";
    const { output: brief, invocation } = await runSkill({
      projectId,
      skillName: "project-brief",
      trigger: "brief-api",
      input: {
        projectName,
        knowledgeChunkCount: chunks.length,
      },
      run: async () =>
        runProjectBriefGraph({
          provider: createConfiguredLlmProvider(),
          projectName,
          chunks,
        }),
      fallback: async () =>
        generateProjectBrief({
          projectName,
          chunks,
        }),
    });
    await writeSkillInvocation(invocation).catch(() => undefined);

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
