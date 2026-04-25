import { NextResponse } from "next/server";
import { readProjectPracticeTurns } from "@/lib/defense-practice-db";
import { generateDefenseReview } from "@/lib/defense-review";
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
    const review = generateDefenseReview({
      projectName,
      turns,
    });

    return NextResponse.json({
      review,
      practiceTurnCount: turns.length,
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
