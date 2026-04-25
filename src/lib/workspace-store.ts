import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DefenseWorkspace } from "./project-workspace";

export function workspaceStorePath(cwd = process.cwd()) {
  return join(cwd, ".data", "workspace", "current.json");
}

export async function readStoredWorkspace(cwd = process.cwd()) {
  try {
    const raw = await readFile(workspaceStorePath(cwd), "utf8");
    return JSON.parse(raw) as DefenseWorkspace;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function writeStoredWorkspace(
  workspace: DefenseWorkspace,
  cwd = process.cwd(),
) {
  const filePath = workspaceStorePath(cwd);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(workspace, null, 2), "utf8");
  return workspace;
}

function isNotFoundError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
