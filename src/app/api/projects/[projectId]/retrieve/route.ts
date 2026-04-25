import { NextResponse } from "next/server";
import {
  readProjectKnowledgeChunks,
  retrieveRelevantKnowledgeChunks,
} from "@/lib/knowledge-db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const limit = Number(searchParams.get("limit") ?? "6");

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }
    if (!query.trim()) {
      return NextResponse.json({ error: "Missing query." }, { status: 400 });
    }

    const chunks = await retrieveRelevantKnowledgeChunks({
      projectId,
      query,
      limit,
    });
    const fallbackChunks = chunks.length ? [] : await readProjectKnowledgeChunks(projectId);

    return NextResponse.json({
      chunks: chunks.length ? chunks : fallbackChunks.slice(0, Math.max(1, limit)),
      mode: chunks.length ? "vector" : "fallback",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Knowledge retrieval failed.",
      },
      { status: 500 },
    );
  }
}
