import type { DefenseFileInput } from "./project-workspace";
import { readApiErrorMessage } from "./api-error";

export async function uploadDefenseFiles(files: File[], options?: { projectId?: string }): Promise<DefenseFileInput[]> {
  if (!files.length) return [];

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (options?.projectId) {
    formData.append("projectId", options.projectId);
  }

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message || "文件上传失败");
  }

  const payload = (await response.json()) as {
    uploadedFiles?: DefenseFileInput[];
  };

  return payload.uploadedFiles ?? [];
}
