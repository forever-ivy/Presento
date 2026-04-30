import assert from "node:assert/strict";
import test from "node:test";
import type { SkillInvocationRecord } from "@shared/domain";
import { createSkillInvocationRepository } from "./skill-invocations.ts";

const invocation: SkillInvocationRecord = {
  id: "skill-invocation-1",
  projectId: "project-1",
  skillName: "review_report",
  skillVersion: "1.0.0",
  trigger: "review_generate",
  resolvedBy: "system",
  status: "success",
  input: { turns: 3 },
  output: { summary: "复盘完成" },
  error: undefined,
  traceId: "trace-local",
  langfuseTraceId: "trace-langfuse",
  langfuseObservationId: "obs-1",
  usedFallback: false,
  retrievalSummary: {
    mode: "hybrid",
    scope: "project",
    chunkCount: 4,
    sourceIds: ["source-1"],
  },
  toolCalls: [
    { tool: "writeReview", status: "success", durationMs: 12, summary: { accepted: true } },
  ],
  outputSummary: { summary: "复盘完成" },
  feedbackStatus: "none",
  startedAt: "2026-04-29T00:00:00.000Z",
  completedAt: "2026-04-29T00:00:01.000Z",
  durationMs: 1000,
};

test("writes invocation records with langfuse, retrieval, and tool call fields", async () => {
  const executed: string[] = [];
  const repository = createSkillInvocationRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.write(invocation);

  assert.match(executed[0] ?? "", /"skillVersion"/u);
  assert.match(executed[0] ?? "", /"resolvedBy"/u);
  assert.match(executed[0] ?? "", /"langfuseTraceId"/u);
  assert.match(executed[0] ?? "", /"toolCalls"/u);
  assert.match(executed[0] ?? "", /"feedbackStatus"/u);
});

test("writes feedback rows and marks invocation feedback state", async () => {
  const executed: string[] = [];
  const repository = createSkillInvocationRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.writeFeedback({
    id: "feedback-1",
    projectId: "project-1",
    invocationId: invocation.id,
    rating: "up",
    comment: "很好",
    createdAt: "2026-04-29T00:02:00.000Z",
    syncedAt: null,
  });

  assert.match(executed[0] ?? "", /INSERT INTO "SkillFeedback"/u);
  assert.match(executed[0] ?? "", /"feedbackStatus" = 'received'/u);

  executed.length = 0;
  await repository.markFeedbackSynced(invocation.id, "2026-04-29T00:03:00.000Z");
  assert.match(executed[0] ?? "", /"syncedAt"/u);
  assert.match(executed[0] ?? "", /"feedbackStatus" = 'synced'/u);
});
