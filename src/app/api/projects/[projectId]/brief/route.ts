import { NextResponse } from "next/server";
import { readProjectKnowledgeChunks } from "@/lib/knowledge-db";
import { generateProjectBrief } from "@/lib/project-brief-skill";
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
    const brief = generateProjectBrief({
      projectName,
      chunks,
    });

    return NextResponse.json({
      brief,
      knowledgeChunkCount: chunks.length,
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
