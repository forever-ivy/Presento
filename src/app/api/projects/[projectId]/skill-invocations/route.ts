import { NextResponse } from "next/server";
import { readProjectSkillInvocations } from "@/lib/skill-invocation-db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "20");

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const invocations = await readProjectSkillInvocations(projectId, limit);
    return NextResponse.json({ invocations });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Skill invocation query failed.",
      },
      { status: 500 },
    );
  }
}
