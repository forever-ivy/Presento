import type { DefenseWorkspace } from "./project-workspace";
import { readApiErrorMessage } from "./api-error";

export async function fetchServerWorkspace(): Promise<DefenseWorkspace | null> {
  const response = await fetch("/api/workspace", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    workspace?: DefenseWorkspace | null;
  };

  return payload.workspace ?? null;
}

export async function persistServerWorkspace(workspace: DefenseWorkspace) {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspace }),
  });

  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message || "工作区同步失败");
  }

  const payload = (await response.json()) as {
    workspace?: DefenseWorkspace;
  };

  return payload.workspace ?? workspace;
}
