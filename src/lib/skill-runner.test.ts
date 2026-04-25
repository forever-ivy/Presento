import assert from "node:assert/strict";
import { test } from "node:test";
import { runSkill } from "./skill-runner.ts";

test("runs a skill and returns invocation metadata", async () => {
  const result = await runSkill({
    projectId: "project-defense",
    skillName: "project-brief",
    trigger: "manual",
    input: { query: "项目速记" },
    now: (() => {
      const dates = [
        "2026-04-25T08:00:00.000Z",
        "2026-04-25T08:00:01.250Z",
      ];
      return () => dates.shift() ?? "2026-04-25T08:00:01.250Z";
    })(),
    generateId: () => "skill-run-1",
    run: async () => ({ ok: true }),
  });

  assert.deepEqual(result.output, { ok: true });
  assert.equal(result.invocation.id, "skill-run-1");
  assert.equal(result.invocation.status, "success");
  assert.equal(result.invocation.durationMs, 1250);
  assert.equal(result.invocation.usedFallback, false);
});

test("uses fallback output when a skill fails", async () => {
  const result = await runSkill({
    projectId: "project-defense",
    skillName: "defense-chat",
    trigger: "current-slide-answer",
    input: { answer: "我负责后端" },
    now: () => "2026-04-25T08:00:00.000Z",
    generateId: () => "skill-run-fallback",
    run: async () => {
      throw new Error("LLM timeout");
    },
    fallback: async () => ({ message: "使用本地规则生成" }),
  });

  assert.deepEqual(result.output, { message: "使用本地规则生成" });
  assert.equal(result.invocation.status, "fallback");
  assert.equal(result.invocation.usedFallback, true);
  assert.equal(result.invocation.error, "LLM timeout");
});

test("records failed invocation when no fallback is available", async () => {
  await assert.rejects(
    () =>
      runSkill({
        projectId: "project-defense",
        skillName: "review",
        trigger: "review-page-load",
        input: {},
        now: () => "2026-04-25T08:00:00.000Z",
        generateId: () => "skill-run-failed",
        run: async () => {
          throw new Error("no model");
        },
      }),
    /no model/,
  );
});
