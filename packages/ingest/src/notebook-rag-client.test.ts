import assert from "node:assert/strict";
import test from "node:test";
import { createNotebookRagClient } from "./notebook-rag-client.ts";

test("calls notebook RAG sidecar with file metadata and API key", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = createNotebookRagClient({
    baseUrl: "https://rag.example.test/",
    apiKey: "secret-key",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(JSON.stringify({
        source: {
          title: "README",
          summary: "项目说明",
          fileKind: "document",
        },
        chunks: [
          {
            id: "chunk-1",
            content: "核心内容",
            source: "README.md",
            metadata: { page: 1 },
          },
        ],
        preview: { text: "核心内容", outline: ["核心内容"] },
        slides: [],
        tables: [],
        codeTree: [],
        citations: [{ fileName: "README.md", page: 1, text: "核心内容" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(client);

  const result = await client.parseFile({
    fileId: "file-1",
    fileName: "README.md",
    fileKind: "document",
    mimeType: "text/markdown",
    storagePath: ".data/uploads/readme.md",
    contentBase64: Buffer.from("# README").toString("base64"),
  });

  assert.equal(result.source.title, "README");
  const firstChunk = result.chunks[0];
  assert.ok(firstChunk);
  assert.equal(firstChunk.metadata?.page, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://rag.example.test/parse-file");
  const firstRequest = requests[0];
  assert.ok(firstRequest);
  assert.equal((firstRequest.init?.headers as Record<string, string>)["x-api-key"], "secret-key");
  assert.match(String(firstRequest.init?.body), /"fileName":"README.md"/);
});

test("returns null client when sidecar base URL is not configured", () => {
  const client = createNotebookRagClient({ baseUrl: "" });
  assert.equal(client, null);
});
