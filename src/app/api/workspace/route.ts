import { NextResponse } from "next/server";
import { createProjectRepository } from "@db/repositories/projects";
import type { DefenseWorkspace } from "@/lib/project-workspace";
import { workspacePersistence } from "@/lib/workspace-persistence";

export const runtime = "nodejs";

export async function GET() {
  const latestProject = (await createProjectRepository().list().catch(() => [])).at(0);
  if (latestProject) {
    const workspace = await createProjectRepository().readWorkspace(latestProject.id).catch(() => null);
    if (workspace) {
      return NextResponse.json({
        workspace: {
          project: workspace.project,
          files: workspace.files,
          processingTasks: workspace.processingTasks,
          artifacts: workspace.artifacts,
        },
      });
    }
  }

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
