import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createDeepDiveRepository } from "@db/repositories/deep-dives";
import { createProjectRepository } from "@db/repositories/projects";
import { createRealtimeSessionRepository } from "@db/repositories/realtime-sessions";
import { createReviewRepository } from "@db/repositories/reviews";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import type { DefenseReview } from "@/lib/defense-review";
import {
  buildDeepDiveDrafts,
  normalizeTrainingTurnsForReview,
} from "@/lib/training-session";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const trainingRepository = createTrainingSessionRepository();
    const realtimeRepository = createRealtimeSessionRepository();
    const sessionResult = await trainingRepository.readSession(sessionId);
    if (!sessionResult.session || sessionResult.session.projectId !== projectId) {
      return notFound("Training session");
    }

    const project = await createProjectRepository().read(projectId);
    if (!project) return notFound("Project");

    const turns = normalizeTrainingTurnsForReview(sessionResult.turns);

    const { output, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName: project.name,
      skillId: "review_report",
      trigger: "training_session_finish",
      payload: {
        turns,
        sessionState: sessionResult.session,
      },
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
      clarityScore: reviewOutput.clarityScore,
      evidenceScore: reviewOutput.evidenceScore,
      pressureScore: reviewOutput.pressureScore,
      strengths: reviewOutput.strengths,
      weaknesses: reviewOutput.weaknesses,
      betterAnswers: reviewOutput.betterAnswers,
      nextActions: reviewOutput.nextActions,
      recommendedSkills: reviewOutput.recommendedSkills,
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

    const deepDives = buildDeepDiveDrafts({
      projectId,
      weaknesses,
      createdAt,
    });

    await createReviewRepository().createReview(review, weaknesses);
    await createDeepDiveRepository().createMany(deepDives);
    const activeRealtimeSession = await realtimeRepository.readActiveForTrainingSession(sessionId);
    if (activeRealtimeSession) {
      await realtimeRepository.updateSession(activeRealtimeSession.id, {
        status: "ended",
        endedAt: createdAt,
      });
    }
    const sessionPatch = {
      status: "finished",
      voiceState: "idle",
      detectedWeaknesses: weaknesses.map((weakness) => weakness.title),
      shouldFinish: true,
      finishedAt: createdAt,
    };
    await trainingRepository.updateSession(sessionId, sessionPatch);

    return apiOk({
      review,
      weaknesses,
      deepDives,
      sessionPatch,
      skillInvocation: invocation,
    });
  } catch (error) {
    return apiError(500, "training_session_finish_failed", error instanceof Error ? error.message : "Failed to finish training session.");
  }
}
