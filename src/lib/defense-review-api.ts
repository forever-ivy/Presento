import type { DefenseReview } from "./defense-review";
import { readApiErrorMessage } from "./api-error";

export async function fetchDefenseReview(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/review`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message || "答辩复盘生成失败");
  }

  return (await response.json()) as {
    review: DefenseReview;
    practiceTurnCount: number;
  };
}
