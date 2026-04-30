import assert from "node:assert/strict";
import test from "node:test";
import { ingestLocalFile } from "./pipeline.ts";

test("ingestLocalFile stamps source-aware retrieval metadata on parsed chunks", () => {
  const result = ingestLocalFile({
    projectId: "project-defense",
    file: {
      id: "file-1",
      name: "README.md",
      size: 128,
      type: "text/markdown",
      kind: "document",
      status: "ready",
      source: "upload",
      addedAt: "2026-04-29T10:00:00.000Z",
      storagePath: ".data/uploads/readme.md",
    },
    task: {
      id: "task-1",
      fileId: "file-1",
      fileName: "README.md",
      kind: "document",
      title: "README 解析",
      engine: "notebook-rag",
      status: "pending",
      progress: 0,
      createdAt: "2026-04-29T10:00:00.000Z",
    },
    content: "项目目标是减少排队时间。",
    parsed: {
      source: {
        title: "README",
        summary: "项目说明",
        fileKind: "document",
      },
      chunks: [
        {
          id: "chunk-1",
          content: "项目目标是减少排队时间。",
          source: "README.md · document",
          metadata: {
            lineStart: 1,
            lineEnd: 1,
          },
        },
      ],
      preview: {
        text: "项目目标是减少排队时间。",
        outline: ["项目目标是减少排队时间。"],
      },
    },
    createdAt: "2026-04-29T10:00:00.000Z",
  });

  assert.equal(result.chunks[0]?.metadata.sourceId, "source-file-1");
  assert.equal(result.chunks[0]?.metadata.chunkKind, "document");
});
