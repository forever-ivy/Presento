import assert from "node:assert/strict";
import { test } from "node:test";
import type { SkillInvocationRecord } from "./skill-runner.ts";
import { createSkillInvocationDatabase } from "./skill-invocation-db.ts";

const invocation: SkillInvocationRecord = {
  id: "skill-run-1",
  projectId: "project-defense",
  skillName: "project-brief",
  trigger: "manual",
  status: "success",
  input: { query: "项目速记" },
  output: { ok: true },
  usedFallback: false,
  startedAt: "2026-04-25T08:00:00.000Z",
  completedAt: "2026-04-25T08:00:01.250Z",
  durationMs: 1250,
};

test("writes skill invocation trace into database", async () => {
  let sql = "";
  const database = createSkillInvocationDatabase(async (query) => {
    sql = query;
    return "";
  });

  await database.writeSkillInvocation(invocation);

  assert.match(sql, /INSERT INTO "SkillInvocation"/);
  assert.match(sql, /'project-brief'/);
  assert.match(sql, /'success'/);
  assert.match(sql, /"durationMs"/);
  assert.match(sql, /ON CONFLICT \("id"\) DO UPDATE/);
});

test("reads recent skill invocations for project", async () => {
  const database = createSkillInvocationDatabase(async () => JSON.stringify([invocation]));

  const invocations = await database.readProjectSkillInvocations("project-defense");

  assert.deepEqual(invocations, [invocation]);
});
