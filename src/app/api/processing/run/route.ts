import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  createProcessingArtifact,
  resolveLocalStoragePath,
} from "@/lib/local-processing";
import { replaceArtifactKnowledgeChunks } from "@/lib/knowledge-db";
import { createKnowledgeChunks } from "@/lib/knowledge-chunks";
import type { DefenseFileRecord, DefenseProcessingTask } from "@/lib/project-workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId?: string;
      file?: DefenseFileRecord;
      task?: DefenseProcessingTask;
    };

    if (!payload.projectId || !payload.file?.storagePath || !payload.task) {
      return NextResponse.json(
        { error: "Missing project, file, or processing task." },
        { status: 400 },
      );
    }

    const absolutePath = resolveLocalStoragePath(payload.file.storagePath, process.cwd());
    const content = await readFile(absolutePath, "utf8");
    const artifact = createProcessingArtifact({
      file: payload.file,
      task: payload.task,
      content,
    });
    const knowledgeChunks = createKnowledgeChunks({
      projectId: payload.projectId,
      artifact,
      content,
      createdAt: artifact.createdAt,
    });

    let knowledgeWarning: string | undefined;
    try {
      await replaceArtifactKnowledgeChunks(artifact.id, knowledgeChunks);
    } catch (error) {
      knowledgeWarning =
        error instanceof Error ? error.message : "Knowledge chunk persistence failed.";
    }

    return NextResponse.json({
      artifact,
      knowledgeChunkCount: knowledgeWarning ? 0 : knowledgeChunks.length,
      knowledgeWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Processing failed.",
      },
      { status: 500 },
    );
  }
}
