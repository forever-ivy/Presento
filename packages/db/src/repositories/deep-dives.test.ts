import assert from "node:assert/strict";
import test from "node:test";
import { createDeepDiveRepository } from "./deep-dives.ts";

test("creates and lists deep-dive tasks", async () => {
  const executed: string[] = [];
  const repository = createDeepDiveRepository(async (sql) => {
    executed.push(sql);
    if (sql.includes('FROM "DeepDive" deep_dive_rows')) {
      return JSON.stringify([
        {
          id: "deep-dive-1",
          projectId: "project-1",
          weaknessId: "weakness-1",
          title: "数据库设计解释不够具体",
          summary: "补一版 orders 与 order_items 的解释。",
          checklist: ["补一版 30 秒口头回答。"],
          citations: [],
          createdAt: "2026-04-28T12:10:00.000Z",
        },
      ]);
    }
    return "";
  });

  await repository.createMany([
    {
      id: "deep-dive-1",
      projectId: "project-1",
      weaknessId: "weakness-1",
      title: "数据库设计解释不够具体",
      summary: "补一版 orders 与 order_items 的解释。",
      checklist: ["补一版 30 秒口头回答。"],
      citations: [],
      createdAt: "2026-04-28T12:10:00.000Z",
    },
  ]);
  const rows = await repository.listByProject("project-1");

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.weaknessId, "weakness-1");
  assert.match(executed[0] ?? "", /INSERT INTO "DeepDive"/u);
  assert.match(executed[1] ?? "", /FROM "DeepDive" deep_dive_rows/u);
});
