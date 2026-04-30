import type {
  DefenseFileRecord,
  DefenseProcessingArtifact,
  DefenseProcessingTask,
} from "./project-workspace";
import { readApiErrorMessage } from "./api-error";

export async function runProcessingTask({
  projectId,
  file,
  task,
}: {
  projectId: string;
  file: DefenseFileRecord;
  task: DefenseProcessingTask;
}): Promise<DefenseProcessingArtifact> {
  const response = await fetch("/api/processing/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId, file, task }),
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message || "解析任务失败");
  }

  const payload = (await response.json()) as {
    artifact?: DefenseProcessingArtifact;
  };

  if (!payload.artifact) {
    throw new Error("解析任务没有返回产物");
  }

  return payload.artifact;
}
