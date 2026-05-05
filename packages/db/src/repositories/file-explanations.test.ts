import assert from "node:assert/strict";
import test from "node:test";
import { createFileExplanationRepository } from "./file-explanations.ts";

test("creates and reads NotebookLM-style file explanation sessions", async () => {
  const executed: string[] = [];
  const repository = createFileExplanationRepository(async (sql) => {
    executed.push(sql);
    if (sql.includes("FROM \"FileExplanationSession\"")) {
      return JSON.stringify({
        id: "session-1",
        projectId: "project-1",
        nodeId: "node-file-1",
        fileId: "file-1",
        sourceId: "source-file-1",
        mode: "quick",
        status: "ready",
        summary: "一句话总结",
        outline: ["要点"],
        citations: [],
        metadata: {},
        createdAt: "2026-04-27T10:00:00.000Z",
        updatedAt: "2026-04-27T10:00:00.000Z",
        turns: [],
      });
    }
    return "";
  });

  await repository.createSession({
    id: "session-1",
    projectId: "project-1",
    nodeId: "node-file-1",
    fileId: "file-1",
    sourceId: "source-file-1",
    mode: "quick",
    status: "ready",
    summary: "一句话总结",
    outline: ["要点"],
    citations: [],
    metadata: {},
    createdAt: "2026-04-27T10:00:00.000Z",
    updatedAt: "2026-04-27T10:00:00.000Z",
  });
  await repository.addTurn({
    id: "turn-1",
    sessionId: "session-1",
    projectId: "project-1",
    role: "assistant",
    content: "讲解内容",
    citations: [],
    metadata: {},
    createdAt: "2026-04-27T10:01:00.000Z",
  });
  const session = await repository.readSession("project-1", "session-1");

  assert.equal(session?.id, "session-1");
  assert.match(executed[0] ?? "", /INSERT INTO "FileExplanationSession"/);
  assert.match(executed[1] ?? "", /INSERT INTO "FileExplanationTurn"/);
  assert.match(executed[2] ?? "", /FROM "FileExplanationSession"/);
});

test("reads reusable file explanation session by file, mode, and focus", async () => {
  const executed: string[] = [];
  const repository = createFileExplanationRepository(async (sql) => {
    executed.push(sql);
    return JSON.stringify({
      id: "session-1",
      projectId: "project-1",
      nodeId: "node-file-1",
      fileId: "file-1",
      sourceId: "source-file-1",
      mode: "quick",
      status: "completed",
      summary: "已缓存讲解",
      outline: ["要点"],
      citations: [],
      metadata: { focusNodeId: "focus-1" },
      createdAt: "2026-04-27T10:00:00.000Z",
      updatedAt: "2026-04-27T10:00:00.000Z",
      turns: [{ id: "turn-1", role: "assistant", content: "讲解内容" }],
    });
  });

  const session = await repository.readReusableSession({
    projectId: "project-1",
    nodeId: "node-file-1",
    fileId: "file-1",
    mode: "quick",
    focusNodeId: "focus-1",
  });

  assert.equal(session?.id, "session-1");
  assert.match(executed[0] ?? "", /"fileId" = 'file-1'/u);
  assert.match(executed[0] ?? "", /"mode" = 'quick'/u);
  assert.match(executed[0] ?? "", /COALESCE\("metadata"->>'focusNodeId', ''\) = 'focus-1'/u);
  assert.match(executed[0] ?? "", /"status" IN \('ready', 'completed', 'fallback'\)/u);
});
