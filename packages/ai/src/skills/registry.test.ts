import assert from "node:assert/strict";
import test from "node:test";
import { listBuiltInSkills } from "./registry.ts";

test("registers the Presento built-in skill set for the MVP training loop", () => {
  const skills = listBuiltInSkills();
  const ids = skills.map((skill) => skill.id).sort();

  assert.deepEqual(ids, [
    "content_repurpose",
    "current_slide_followup",
    "project_brief",
    "review_report",
    "risk_questions",
    "slide_script",
    "weakness_deep_dive",
  ]);

  assert.equal(
    skills.find((skill) => skill.id === "current_slide_followup")?.trigger.mode,
    "defense",
  );
  assert.equal(
    skills.find((skill) => skill.id === "content_repurpose")?.output.type,
    "content_export",
  );
});
