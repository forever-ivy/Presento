import type { DefenseReview } from "./defense-review";

export async function fetchDefenseReview(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}/review`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await readDefenseReviewError(response);
    throw new Error(message || "答辩复盘生成失败");
  }

  return (await response.json()) as {
    review: DefenseReview;
    practiceTurnCount: number;
  };
}

async function readDefenseReviewError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error;
  } catch {
    return response.text();
  }
}
