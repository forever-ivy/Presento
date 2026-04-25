import type { DefenseFileInput } from "./project-workspace";

export async function uploadDefenseFiles(files: File[]): Promise<DefenseFileInput[]> {
  if (!files.length) return [];

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await readUploadError(response);
    throw new Error(message || "文件上传失败");
  }

  const payload = (await response.json()) as {
    uploadedFiles?: DefenseFileInput[];
  };

  return payload.uploadedFiles ?? [];
}

async function readUploadError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error;
  } catch {
    return response.text();
  }
}
