import type { ProjectBrief } from "./project-brief-skill";
import type { ModelRuntimeStatus } from "./model-config";

export async function fetchProjectBrief(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/brief`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readBriefError(response);
    throw new Error(message || "项目速记卡生成失败");
  }

  return (await response.json()) as {
    brief: ProjectBrief;
    knowledgeChunkCount: number;
    skillStatus?: "success" | "fallback" | "failed";
    modelStatus?: ModelRuntimeStatus;
  };
}

async function readBriefError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error;
  } catch {
    return response.text();
  }
}
