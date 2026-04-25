import { NextResponse } from "next/server";
import { generateDefenseCoachTurn, type DefenseTeacherRole } from "@/lib/defense-chat-skill";
import { writePracticeTurn } from "@/lib/defense-practice-db";
import {
  readProjectKnowledgeChunks,
  retrieveRelevantKnowledgeChunks,
} from "@/lib/knowledge-db";
import { createConfiguredLlmProvider } from "@/lib/llm-provider";
import { getModelRuntimeStatus } from "@/lib/model-config";
import { runDefenseChatGraph } from "@/lib/skill-graph";
import { writeSkillInvocation } from "@/lib/skill-invocation-db";
import { runSkill } from "@/lib/skill-runner";
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
    const [workspace, relevantChunks] = await Promise.all([
      workspacePersistence.readWorkspace(),
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
      workspace?.project.id === projectId ? workspace.project.name : "课程项目答辩";
    const { output: turn, invocation } = await runSkill({
      projectId,
      skillName: "defense-chat",
      trigger: "current-slide-answer",
      input: {
        slideTitle: payload.slideTitle ?? "当前页",
        slideIndex: payload.slideIndex ?? 1,
        teacherRole: payload.teacherRole ?? "strict",
        userAnswer: payload.userAnswer ?? "",
        retrievedChunkCount: chunks.length,
      },
      run: async () =>
        runDefenseChatGraph({
          provider: createConfiguredLlmProvider(),
          projectName,
          slideTitle: payload.slideTitle ?? "当前页",
          slideIndex: payload.slideIndex ?? 1,
          teacherRole: payload.teacherRole ?? "strict",
          userAnswer: payload.userAnswer ?? "",
          chunks,
        }),
      fallback: async () =>
        generateDefenseCoachTurn({
          projectName,
          slideTitle: payload.slideTitle ?? "当前页",
          slideIndex: payload.slideIndex ?? 1,
          teacherRole: payload.teacherRole ?? "strict",
          userAnswer: payload.userAnswer ?? "",
          chunks,
        }),
    });
    await writeSkillInvocation(invocation).catch(() => undefined);
    const practiceTurn = {
      id: `turn-${projectId}-${Date.parse(turn.generatedAt).toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
      projectId,
      slideIndex: payload.slideIndex ?? 1,
      slideTitle: payload.slideTitle ?? "当前页",
      teacherRole: payload.teacherRole ?? "strict",
      userAnswer: payload.userAnswer ?? "",
      aiMessage: turn.message,
      score: turn.feedback.score,
      strengths: turn.feedback.strengths,
      risks: turn.feedback.risks,
      improvedAnswer: turn.feedback.improvedAnswer,
      followUps: turn.followUps,
      citations: turn.citations,
      createdAt: turn.generatedAt,
    };

    let practiceWarning: string | undefined;
    try {
      await writePracticeTurn(practiceTurn);
    } catch (error) {
      practiceWarning =
        error instanceof Error ? error.message : "Practice turn persistence failed.";
    }

    return NextResponse.json({
      turn,
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
