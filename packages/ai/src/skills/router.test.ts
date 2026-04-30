import assert from "node:assert/strict";
import test from "node:test";
import { resolveBuiltInSkill } from "./router.ts";

test("routes completed defense turns to the structured defense analysis stack", () => {
  const resolution = resolveBuiltInSkill({
    enabledPackIds: ["core-training", "deep-dive", "defense-advanced"],
    projectType: "software_ai_data",
    mode: "defense",
    event: "user_finished_slide",
  });

  assert.equal(resolution.resolvedBy, "router");
  assert.equal(resolution.selectedSkillId, "current_slide_followup");
  assert.deepEqual(
    resolution.recommendations.slice(0, 4).map((item) => item.skillId),
    ["current_slide_followup", "rubric_scoring", "evidence_gap_check", "member_scope_defense"],
  );
});

test("respects explicitly requested skills", () => {
  const resolution = resolveBuiltInSkill({
    explicitSkillId: "review_report",
    enabledPackIds: ["core-training", "deep-dive"],
    projectType: "software_ai_data",
    mode: "review",
    event: "review_generate",
  });

  assert.equal(resolution.resolvedBy, "explicit");
  assert.equal(resolution.selectedSkillId, "review_report");
});

test("routes code explanation requests to code walkthrough when the explainer pack is enabled", () => {
  const resolution = resolveBuiltInSkill({
    enabledPackIds: ["file-explainers", "deep-dive"],
    projectType: "software_ai_data",
    mode: "file_explanation",
    event: "code_explain",
    fileKind: "code",
  });

  assert.equal(resolution.selectedSkillId, "code_walkthrough");
});

test("falls back when a more specific skill pack is disabled", () => {
  const resolution = resolveBuiltInSkill({
    enabledPackIds: ["core-training"],
    projectType: "software_ai_data",
    mode: "file_explanation",
    event: "dataset_explain",
    fileKind: "dataset",
    trainingState: { shouldFinish: false },
  });

  assert.equal(resolution.selectedSkillId, "fallback_answer");
  assert.match(resolution.reason, /兜底/u);
});
