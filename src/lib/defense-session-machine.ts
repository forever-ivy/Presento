import type { DefensePhase, TurnType } from "@shared/domain";

export type CommitEventType = "presentation.commit" | "followup.answer.commit";

export function getTurnTypeForCommit(type: CommitEventType): TurnType {
  return type === "presentation.commit" ? "presentation" : "followup_answer";
}

export function getNextPhaseAfterTurn({
  currentPhase,
  turnType,
  finalQuestionIndex,
  finalQuestionLimit,
}: {
  currentPhase: DefensePhase;
  turnType: TurnType;
  finalQuestionIndex: number;
  finalQuestionLimit: number;
}) {
  if (turnType === "presentation") {
    return "teacher_followup" as const;
  }

  if (turnType === "followup_answer") {
    return "slide_feedback" as const;
  }

  if (currentPhase !== "final_questions") {
    return "final_questions" as const;
  }

  return finalQuestionIndex + 1 >= finalQuestionLimit ? "finishing" : "final_questions";
}

export function isPresentationPhase(phase: DefensePhase) {
  return phase === "slide_intro" || phase === "user_presenting";
}
