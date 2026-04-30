import assert from "node:assert/strict";
import test from "node:test";
import {
  createNotebookRagClient,
  type ExplainFileStreamEvent,
  readNotebookRagEventStream,
} from "./notebook-rag-client.ts";

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

test("passes repository URLs through parse-file requests for GitHub code sources", async () => {
  let requestBody = "";
  const client = createNotebookRagClient({
    baseUrl: "https://rag.example.test/",
    fetchImpl: async (_url, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({
        source: {
          title: "openai/codex",
          summary: "GitHub repository",
          fileKind: "code",
        },
        chunks: [],
        preview: { text: "", outline: [] },
        slides: [],
        tables: [],
        codeTree: [],
        citations: [],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(client);

  await client.parseFile({
    fileId: "file-repo-1",
    fileName: "openai/codex",
    fileKind: "code",
    repositoryUrl: "https://github.com/openai/codex" as never,
  } as never);

  assert.match(requestBody, /"repositoryUrl":"https:\/\/github.com\/openai\/codex"/);
});

test("returns null client when sidecar base URL is not configured", () => {
  const client = createNotebookRagClient({ baseUrl: "" });
  assert.equal(client, null);
});

test("passes grounded retrieval options to explain-file requests", async () => {
  let requestBody = "";
  const client = createNotebookRagClient({
    baseUrl: "https://rag.example.test",
    fetchImpl: async (_url, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({
        summary: "README 的核心重点是：项目目标。",
        outline: ["项目目标"],
        answer: "一句话讲清项目目标。",
        citations: [{ fileName: "README.md", lineStart: 1, lineEnd: 3 }],
        grounded: true,
        insufficientEvidence: false,
        metadata: {
          engine: "sidecar-deterministic",
          retrievalCount: 1,
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(client);

  const response = await client.explainFile({
    fileId: "file-1",
    fileName: "README.md",
    mode: "quick",
    retrievalMode: "quick",
    topK: 4,
    conversationContext: [{ role: "user", content: "先概括这个文件" }],
    chunks: [{ content: "项目目标", metadata: { lineStart: 1, lineEnd: 3 } }],
  });

  assert.equal(response.grounded, true);
  assert.equal(response.insufficientEvidence, false);
  assert.match(requestBody, /"retrievalMode":"quick"/);
  assert.match(requestBody, /"topK":4/);
  assert.match(requestBody, /"conversationContext":/);
});

test("prepares retrieval-ready chunks through the sidecar contract", async () => {
  let requestBody = "";
  const client = createNotebookRagClient({
    baseUrl: "https://rag.example.test",
    fetchImpl: async (_url, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({
        chunks: [
          {
            id: "chunk-1",
            content: "项目目标",
            source: "README.md · document",
            metadata: {
              fileName: "README.md",
              sourceId: "source-file-1",
              lineStart: 1,
              lineEnd: 2,
            },
            retrieval: {
              embeddingV2: [0.1, 0.2, 0.3],
              chunkKind: "document",
              sourceId: "source-file-1",
              retrievalText: "README.md 项目目标",
              lineStart: 1,
              lineEnd: 2,
            },
          },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(client);

  const response = await client.prepareRetrievalChunks({
    chunks: [
      {
        id: "chunk-1",
        content: "项目目标",
        source: "README.md · document",
        metadata: {
          fileName: "README.md",
          sourceId: "source-file-1",
          lineStart: 1,
          lineEnd: 2,
        },
      },
    ],
  });

  assert.equal(response.chunks[0]?.retrieval?.chunkKind, "document");
  assert.deepEqual(response.chunks[0]?.retrieval?.embeddingV2, [0.1, 0.2, 0.3]);
  assert.match(requestBody, /"sourceId":"source-file-1"/);
});

test("retrieves hybrid-ranked chunks from the sidecar contract", async () => {
  let requestBody = "";
  const client = createNotebookRagClient({
    baseUrl: "https://rag.example.test",
    fetchImpl: async (_url, init) => {
      requestBody = String(init?.body ?? "");
      return new Response(JSON.stringify({
        chunks: [
          {
            id: "chunk-1",
            projectId: "project-defense",
            artifactId: "artifact-readme",
            fileId: "file-readme",
            content: "项目背景：解决食堂高峰期排队问题。",
            source: "README.md · document",
            metadata: {
              fileName: "README.md",
              lineStart: 1,
              lineEnd: 1,
            },
            createdAt: "2026-04-25T06:04:00.000Z",
          },
        ],
        mode: "hybrid",
        trace: {
          query: "排队问题",
          filters: { fileId: "file-readme" },
          vectorCandidateCount: 8,
          lexicalCandidateCount: 5,
          reranked: true,
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(client);

  const response = await client.retrieveChunks({
    projectId: "project-defense",
    query: "排队问题",
    limit: 4,
    fileId: "file-readme",
  });

  assert.equal(response.mode, "hybrid");
  assert.equal(response.trace?.reranked, true);
  assert.equal(response.chunks[0]?.fileId, "file-readme");
  assert.match(requestBody, /"fileId":"file-readme"/);
  assert.match(requestBody, /"limit":4/);
});

test("reads streaming notebook RAG events from server-sent events", async () => {
  const client = createNotebookRagClient({
    baseUrl: "https://rag.example.test",
    fetchImpl: async () => new Response(
      [
        "event: started",
        'data: {"mode":"quick"}',
        "",
        "event: retrieval",
        'data: {"retrievalCount":2,"retrievalMode":"quick"}',
        "",
        "event: delta",
        'data: {"delta":"第一段"}',
        "",
        "event: citations",
        'data: {"citations":[{"fileName":"README.md","lineStart":1,"lineEnd":3}]}',
        "",
        "event: completed",
        'data: {"summary":"总结","outline":["要点"],"answer":"第一段","citations":[{"fileName":"README.md","lineStart":1,"lineEnd":3}],"grounded":true,"insufficientEvidence":false,"metadata":{"engine":"sidecar-llm","retrievalCount":2}}',
        "",
        "data: [DONE]",
        "",
      ].join("\n"),
      {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      },
    ),
  });
  assert.ok(client);

  const events: ExplainFileStreamEvent[] = [];
  for await (const event of await client.explainFileStream({
    fileId: "file-1",
    fileName: "README.md",
    mode: "quick",
    retrievalMode: "quick",
    chunks: [{ content: "项目目标", metadata: { lineStart: 1, lineEnd: 3 } }],
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.map((event) => event.type),
    ["started", "retrieval", "delta", "citations", "completed"],
  );
  const deltaEvent = events[2];
  assert.ok(deltaEvent?.type === "delta");
  assert.equal(deltaEvent.delta, "第一段");
  const citationEvent = events[3];
  assert.ok(citationEvent?.type === "citations");
  assert.deepEqual(citationEvent.citations, [{ fileName: "README.md", lineStart: 1, lineEnd: 3 }]);
  const completedEvent = events[4];
  assert.ok(completedEvent?.type === "completed");
  assert.equal(completedEvent.response.metadata?.engine, "sidecar-llm");
});

test("parses multiline SSE payloads into notebook RAG events", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode("event: delta\n"));
      controller.enqueue(encoder.encode('data: {"delta":"第一"}\n'));
      controller.enqueue(encoder.encode('data: {"ignored":true}\n\n'));
      controller.enqueue(encoder.encode("event: error\n"));
      controller.enqueue(encoder.encode('data: {"message":"boom"}\n\n'));
      controller.close();
    },
  });

  const events: Array<{ type: string; [key: string]: unknown }> = [];
  for await (const event of readNotebookRagEventStream(stream)) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: "delta", delta: "第一", ignored: true },
    { type: "error", error: "boom" },
  ]);
});
