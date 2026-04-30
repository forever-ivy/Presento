import { NextResponse } from "next/server";
import { processFileIngestJob } from "@ingest/process-job";
import type { DefenseFileRecord, DefenseProcessingTask } from "@/lib/project-workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId?: string;
      file?: DefenseFileRecord;
      task?: DefenseProcessingTask;
    };

    if (!payload.projectId || (!payload.file?.storagePath && !payload.file?.storageKey) || !payload.task) {
      return NextResponse.json(
        { error: "Missing project, file, or processing task." },
        { status: 400 },
      );
    }

    const ingestResult = await processFileIngestJob({
      projectId: payload.projectId,
      file: payload.file,
      task: payload.task,
    });

    return NextResponse.json({
      artifact: ingestResult.artifact,
      knowledgeChunkCount: ingestResult.knowledgeChunkCount,
      slideCount: ingestResult.slideCount,
      synthetic: ingestResult.synthetic,
      contentType: ingestResult.contentType,
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
