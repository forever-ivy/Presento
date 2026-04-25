import { NextResponse } from "next/server";
import { generateDefenseCoachTurn, type DefenseTeacherRole } from "@/lib/defense-chat-skill";
import { readProjectKnowledgeChunks } from "@/lib/knowledge-db";
import { workspacePersistence } from "@/lib/workspace-persistence";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = (await request.json()) as {
      slideTitle?: string;
      slideIndex?: number;
      teacherRole?: DefenseTeacherRole;
      userAnswer?: string;
    };

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const [workspace, chunks] = await Promise.all([
      workspacePersistence.readWorkspace(),
      readProjectKnowledgeChunks(projectId),
    ]);
    const projectName =
      workspace?.project.id === projectId ? workspace.project.name : "课程项目答辩";
    const turn = generateDefenseCoachTurn({
      projectName,
      slideTitle: payload.slideTitle ?? "当前页",
      slideIndex: payload.slideIndex ?? 1,
      teacherRole: payload.teacherRole ?? "strict",
      userAnswer: payload.userAnswer ?? "",
      chunks,
    });

    return NextResponse.json({
      turn,
      knowledgeChunkCount: chunks.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Defense chat failed.",
      },
      { status: 500 },
    );
  }
}
