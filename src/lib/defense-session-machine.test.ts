import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextPhaseAfterTurn,
  getTurnTypeForCommit,
  isPresentationPhase,
} from "./defense-session-machine.ts";

test("maps commit actions to stable turn types", () => {
  assert.equal(getTurnTypeForCommit("presentation.commit"), "presentation");
  assert.equal(getTurnTypeForCommit("followup.answer.commit"), "followup_answer");
});

test("presentation and followup answers move to the expected next phase", () => {
  assert.equal(
    getNextPhaseAfterTurn({
      currentPhase: "user_presenting",
      turnType: "presentation",
      finalQuestionIndex: 0,
      finalQuestionLimit: 3,
    }),
    "teacher_followup",
  );

  assert.equal(
    getNextPhaseAfterTurn({
      currentPhase: "user_answering",
      turnType: "followup_answer",
      finalQuestionIndex: 0,
      finalQuestionLimit: 3,
    }),
    "slide_feedback",
  );
});

test("final question answers either continue pressure questioning or finish the session", () => {
  assert.equal(
    getNextPhaseAfterTurn({
      currentPhase: "final_questions",
      turnType: "final_question",
      finalQuestionIndex: 1,
      finalQuestionLimit: 3,
    }),
    "final_questions",
  );

  assert.equal(
    getNextPhaseAfterTurn({
      currentPhase: "final_questions",
      turnType: "final_question",
      finalQuestionIndex: 2,
      finalQuestionLimit: 3,
    }),
    "finishing",
  );
});

test("presentation phases are detected without leaking followup states", () => {
  assert.equal(isPresentationPhase("slide_intro"), true);
  assert.equal(isPresentationPhase("user_presenting"), true);
  assert.equal(isPresentationPhase("teacher_followup"), false);
});
