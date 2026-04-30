import assert from "node:assert/strict";
import test from "node:test";
import { getBuiltInSkillPack, listBuiltInSkillPacks, listBuiltInSkills } from "./registry.ts";

test("registers the Presento built-in skill set for the MVP training loop", () => {
  const skills = listBuiltInSkills();
  const ids = skills.map((skill) => skill.id).sort();

  assert.deepEqual(ids, [
    "architecture_explainer",
    "code_explainer",
    "code_walkthrough",
    "content_repurpose",
    "current_slide_followup",
    "data_survey_explainer",
    "dataset_explainer",
    "evidence_gap_check",
    "fallback_answer",
    "file_outline_explainer",
    "member_scope_defense",
    "project_brief",
    "review_report",
    "risk_questions",
    "rubric_scoring",
    "slide_script",
    "teacher_style_followup",
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
  assert.deepEqual(
    listBuiltInSkillPacks().map((pack) => pack.id),
    ["core-training", "deep-dive", "defense-advanced", "file-explainers"],
  );
  assert.deepEqual(
    getBuiltInSkillPack("defense-advanced")?.skills,
    ["teacher_style_followup", "rubric_scoring", "member_scope_defense", "evidence_gap_check"],
  );
  assert.equal(
    skills.find((skill) => skill.id === "fallback_answer")?.fallbackPolicy,
    "none",
  );
});
