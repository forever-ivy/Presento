import type { DefenseFileInput } from "./project-workspace";
import { readApiErrorMessage } from "./api-error";

export type ProjectListItem = {
  id: string;
  name: string;
  category: string;
  ownerScope: string;
  teammateScope: string;
  createdAt: string;
  updatedAt?: string;
  fileCount?: number;
  trainingSessionCount?: number;
};

export type CreateProjectPayload = {
  name: string;
  category: string;
  ownerScope: string;
  teammateScope: string;
  uploadedFiles?: DefenseFileInput[];
};

export async function fetchProjects() {
  const response = await fetch("/api/projects", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  const payload = (await response.json()) as { projects?: ProjectListItem[] };
  return payload.projects ?? [];
}

export async function createProject(payload: CreateProjectPayload) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  const body = (await response.json()) as { project?: ProjectListItem };
  if (!body.project?.id) {
    throw new Error("项目创建成功但没有返回项目 ID");
  }
  return body.project;
}

export async function deleteProject(projectId: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
}
