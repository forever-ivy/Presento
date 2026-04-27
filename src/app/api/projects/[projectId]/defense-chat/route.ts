import { NextResponse } from "next/server";
import { invokeBuiltInSkillWithInvocation } from "@ai/executor";
import { createProjectRepository } from "@db/repositories/projects";
import { createSkillInvocationRepository } from "@db/repositories/skill-invocations";
import type { DefenseCoachTurn, DefenseTeacherRole } from "@/lib/defense-chat-skill";
import { writePracticeTurn } from "@/lib/defense-practice-db";
import {
  readProjectKnowledgeChunks,
  retrieveRelevantKnowledgeChunks,
} from "@/lib/knowledge-db";
import { getModelRuntimeStatus } from "@/lib/model-config";
import { workspacePersistence } from "@/lib/workspace-persistence";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = (await request.json()) as {
      slideTitle?: string;
      slideIndex?: number;
      teacherRole?: DefenseTeacherRole;
      userAnswer?: string;
    };

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const query = `${payload.slideTitle ?? ""}\n${payload.userAnswer ?? ""}`;
    const [workspace, project, relevantChunks] = await Promise.all([
      workspacePersistence.readWorkspace(),
      createProjectRepository().read(projectId),
      retrieveRelevantKnowledgeChunks({
        projectId,
        query,
        limit: 6,
      }),
    ]);
    const chunks = relevantChunks.length
      ? relevantChunks
      : await readProjectKnowledgeChunks(projectId);
    const projectName =
      project?.name ?? (workspace?.project.id === projectId ? workspace.project.name : "课程项目答辩");
    const { output: turn, invocation } = await invokeBuiltInSkillWithInvocation({
      projectId,
      projectName,
      skillId: "current_slide_followup",
      trigger: "current-slide-answer",
      payload: {
        slideTitle: payload.slideTitle ?? "当前页",
        slideIndex: payload.slideIndex ?? 1,
        teacherRole: payload.teacherRole ?? "strict",
        userAnswer: payload.userAnswer ?? "",
        chunks,
      },
    });
    await createSkillInvocationRepository().write(invocation).catch(() => undefined);
    const coachTurn = turn as DefenseCoachTurn & { speech?: unknown };
    const practiceTurn = {
      id: `turn-${projectId}-${Date.parse(coachTurn.generatedAt).toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
      projectId,
      slideIndex: payload.slideIndex ?? 1,
      slideTitle: payload.slideTitle ?? "当前页",
      teacherRole: payload.teacherRole ?? "strict",
      userAnswer: payload.userAnswer ?? "",
      aiMessage: coachTurn.message,
      score: coachTurn.feedback.score,
      strengths: coachTurn.feedback.strengths,
      risks: coachTurn.feedback.risks,
      improvedAnswer: coachTurn.feedback.improvedAnswer,
      followUps: coachTurn.followUps,
      citations: coachTurn.citations,
      createdAt: coachTurn.generatedAt,
    };

    let practiceWarning: string | undefined;
    try {
      await writePracticeTurn(practiceTurn);
    } catch (error) {
      practiceWarning =
        error instanceof Error ? error.message : "Practice turn persistence failed.";
    }

    return NextResponse.json({
      turn: coachTurn,
      knowledgeChunkCount: chunks.length,
      practiceTurnId: practiceWarning ? undefined : practiceTurn.id,
      skillInvocationId: invocation.id,
      skillStatus: invocation.status,
      modelStatus: getModelRuntimeStatus(),
      practiceWarning,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Defense chat failed.",
      },
      { status: 500 },
    );
  }
}
