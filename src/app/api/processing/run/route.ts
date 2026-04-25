import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import {
  createProcessingArtifact,
  resolveLocalStoragePath,
} from "@/lib/local-processing";
import type { DefenseFileRecord, DefenseProcessingTask } from "@/lib/project-workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      file?: DefenseFileRecord;
      task?: DefenseProcessingTask;
    };

    if (!payload.file?.storagePath || !payload.task) {
      return NextResponse.json(
        { error: "Missing file or processing task." },
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

    return NextResponse.json({ artifact });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Processing failed.",
      },
      { status: 500 },
    );
  }
}
