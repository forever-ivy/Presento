import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createProjectRepository } from "@db/repositories/projects";
import { createReviewRepository } from "@db/repositories/reviews";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import type { DefensePracticeTurn, DefenseReview } from "@/lib/defense-review";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const trainingRepository = createTrainingSessionRepository();
    const sessionResult = await trainingRepository.readSession(sessionId);
    if (!sessionResult.session || sessionResult.session.projectId !== projectId) {
      return notFound("Training session");
    }

    const project = await createProjectRepository().read(projectId);
    if (!project) return notFound("Project");

    const turns = sessionResult.turns.map((turn) => ({
      id: turn.id,
      projectId: turn.projectId,
      slideIndex: 1,
      slideTitle: turn.slideId ?? "当前页",
      teacherRole: turn.teacherRole as DefensePracticeTurn["teacherRole"],
      userAnswer: turn.userAnswer,
      aiMessage: turn.aiMessage,
      score: turn.score ?? 0,
      strengths: Array.isArray(turn.strengths) ? (turn.strengths as string[]) : [],
      risks: Array.isArray(turn.risks) ? (turn.risks as string[]) : [],
      improvedAnswer: turn.improvedAnswer ?? "",
      followUps: Array.isArray(turn.followUps) ? (turn.followUps as string[]) : [],
      citations: Array.isArray(turn.citations) ? (turn.citations as DefensePracticeTurn["citations"]) : [],
      createdAt: turn.createdAt,
    })) satisfies DefensePracticeTurn[];

    const { output, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName: project.name,
      skillId: "review_report",
      trigger: "training_session_finish",
      payload: { turns },
    });
    await createSkillInvocationRepository().write(invocation);

    const reviewOutput = output as DefenseReview;
    const createdAt = new Date().toISOString();
    const review = {
      id: `review-${crypto.randomUUID()}`,
      projectId,
      sessionId,
      summary: reviewOutput.summary,
      averageScore: reviewOutput.averageScore,
      scoreLabel: reviewOutput.scoreLabel,
      strengths: reviewOutput.strengths,
      weaknesses: reviewOutput.weaknesses,
      nextActions: reviewOutput.nextActions,
      citations: reviewOutput.citations,
      createdAt,
    };
    const weaknesses = reviewOutput.weaknesses.map((weakness, index) => ({
      id: `weakness-${sessionId}-${index + 1}`,
      projectId,
      sessionId,
      trainingTurnId: null,
      title: weakness.title,
      reason: weakness.evidence,
      status: "open",
      citations: reviewOutput.citations,
      createdAt,
    }));

    await createReviewRepository().createReview(review, weaknesses);
    await trainingRepository.finishSession(sessionId, createdAt);

    return apiOk({
      review,
      weaknesses,
      skillInvocation: invocation,
    });
  } catch (error) {
    return apiError(500, "training_session_finish_failed", error instanceof Error ? error.message : "Failed to finish training session.");
  }
}
