import type { DefenseCoachTurn, DefenseTeacherRole } from "./defense-chat-skill";
import type { ModelRuntimeStatus } from "./model-config";

export async function requestDefenseCoachTurn({
  projectId,
  slideTitle,
  slideIndex,
  teacherRole = "strict",
  userAnswer,
}: {
  projectId: string;
  slideTitle: string;
  slideIndex: number;
  teacherRole?: DefenseTeacherRole;
  userAnswer: string;
}) {
  const response = await fetch(`/api/projects/${projectId}/defense-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      slideTitle,
      slideIndex,
      teacherRole,
      userAnswer,
    }),
  });

  if (!response.ok) {
    const message = await readDefenseChatError(response);
    throw new Error(message || "同屏追问生成失败");
  }

  return (await response.json()) as {
    turn: DefenseCoachTurn;
    knowledgeChunkCount: number;
    skillStatus?: "success" | "fallback" | "failed";
    modelStatus?: ModelRuntimeStatus;
  };
}

async function readDefenseChatError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error;
  } catch {
    return response.text();
  }
}
