import type { SkillInvocationRecord } from "./skill-runner";

export async function fetchSkillInvocations(projectId: string, limit = 8) {
  const response = await fetch(`/api/projects/${projectId}/skill-invocations?limit=${limit}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Skill 调用记录读取失败");
  }

  return (await response.json()) as {
    invocations: SkillInvocationRecord[];
  };
}
