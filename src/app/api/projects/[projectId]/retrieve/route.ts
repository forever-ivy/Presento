import { NextResponse } from "next/server";
import { createKnowledgeMapRepository } from "@db/repositories/knowledge-map";
import { createNotebookRagClient } from "@ingest/notebook-rag-client";
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
    const fileId = searchParams.get("fileId") ?? undefined;
    const nodeId = searchParams.get("nodeId") ?? undefined;
    const slideId = searchParams.get("slideId") ?? undefined;

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }
    if (!query.trim()) {
      return NextResponse.json({ error: "Missing query." }, { status: 400 });
    }

    const resolvedNode = nodeId
      ? await createKnowledgeMapRepository().readNode(projectId, nodeId)
      : null;
    const resolvedFileId = fileId
      ?? (typeof resolvedNode?.metadata?.fileId === "string" ? resolvedNode.metadata.fileId : undefined);
    const resolvedSourceId = typeof resolvedNode?.metadata?.sourceId === "string"
      ? resolvedNode.metadata.sourceId
      : resolvedNode?.sourceId;

    const client = createNotebookRagClient();
    if (client) {
      const result = await client.retrieveChunks({
        projectId,
        query,
        limit,
        fileId: resolvedFileId,
        sourceId: resolvedSourceId ?? undefined,
        slideId,
      });
      return NextResponse.json(result);
    }

    const chunks = await retrieveRelevantKnowledgeChunks({
      projectId,
      query,
      limit,
      fileId: resolvedFileId,
      sourceId: resolvedSourceId ?? undefined,
      slideId: slideId ?? undefined,
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
