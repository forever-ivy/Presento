import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import { createTrainingSessionRepository } from "@db/repositories/training-sessions";
import { createProjectRepository } from "@db/repositories/projects";
import { z } from "zod";
import { retrieveRelevantKnowledgeChunks, readProjectKnowledgeChunks } from "@/lib/knowledge-db";
import type { DefensePracticeTurn } from "@/lib/defense-review";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

const createTurnSchema = z.object({
  slideId: z.string().optional(),
  slideTitle: z.string().default("当前页"),
  slideIndex: z.number().int().positive().default(1),
  knowledgeNodeId: z.string().optional(),
  teacherRole: z.string().default("strict"),
  userAnswer: z.string().default(""),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> },
) {
  try {
    const { projectId, sessionId } = await params;
    const payload = createTurnSchema.parse(await request.json());
    const sessionResult = await createTrainingSessionRepository().readSession(sessionId);
    if (!sessionResult.session || sessionResult.session.projectId !== projectId) {
      return notFound("Training session");
    }

    const project = await createProjectRepository().read(projectId);
    if (!project) return notFound("Project");

    const query = `${payload.slideTitle}\n${payload.userAnswer}`.trim();
    const relevantChunks = query
      ? await retrieveRelevantKnowledgeChunks({ projectId, query, limit: 6 })
      : [];
    const chunks = relevantChunks.length
      ? relevantChunks
      : await readProjectKnowledgeChunks(projectId);

    const { output, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName: project.name,
      skillId: "current_slide_followup",
      trigger: "training_session_turn",
      payload: {
        slideId: payload.slideId,
        slideTitle: payload.slideTitle,
        slideIndex: payload.slideIndex,
        knowledgeNodeId: payload.knowledgeNodeId,
        teacherRole: payload.teacherRole,
        userAnswer: payload.userAnswer,
        chunks,
      },
    });
    await createSkillInvocationRepository().write(invocation);

    const turnOutput = output as {
      message: string;
      feedback: { score: number; strengths: string[]; risks: string[]; improvedAnswer: string };
      followUps: string[];
      citations: DefensePracticeTurn["citations"];
      speech?: unknown;
    };
    const createdAt = new Date().toISOString();
    const turn = {
      id: `training-turn-${crypto.randomUUID()}`,
      sessionId,
      projectId,
      slideId: payload.slideId ?? null,
      knowledgeNodeId: payload.knowledgeNodeId ?? null,
      teacherRole: payload.teacherRole,
      userAnswer: payload.userAnswer,
      aiMessage: turnOutput.message,
      score: turnOutput.feedback.score,
      strengths: turnOutput.feedback.strengths,
      risks: turnOutput.feedback.risks,
      improvedAnswer: turnOutput.feedback.improvedAnswer,
      followUps: turnOutput.followUps,
      citations: turnOutput.citations,
      createdAt,
    };
    await createTrainingSessionRepository().addTurn(turn);

    return apiOk({
      turn,
      skillInvocation: invocation,
      speech: turnOutput.speech ?? null,
      knowledgeChunkCount: chunks.length,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_training_turn_payload", "Invalid training turn payload.", error.flatten());
    }
    return apiError(500, "training_turn_create_failed", error instanceof Error ? error.message : "Failed to create training turn.");
  }
}
