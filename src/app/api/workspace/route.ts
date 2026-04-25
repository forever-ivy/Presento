import { NextResponse } from "next/server";
import type { DefenseWorkspace } from "@/lib/project-workspace";
import { workspacePersistence } from "@/lib/workspace-persistence";

export const runtime = "nodejs";

export async function GET() {
  const workspace = await workspacePersistence.readWorkspace();
  return NextResponse.json({ workspace });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as {
    workspace?: DefenseWorkspace;
  };

  if (!payload.workspace?.project || !Array.isArray(payload.workspace.files)) {
    return NextResponse.json(
      { error: "Missing workspace payload." },
      { status: 400 },
    );
  }

  const workspace = await workspacePersistence.writeWorkspace(payload.workspace);
  return NextResponse.json({ workspace });
}
