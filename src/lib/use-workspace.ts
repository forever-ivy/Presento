"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  appendWorkspaceFiles,
  completeProcessingTask,
  createProjectWorkspace,
  failProcessingTask,
  loadWorkspace,
  saveWorkspace,
  summarizeWorkspace,
  startNextProcessingTask,
  workspaceChangedEvent,
  workspaceStorageKey,
  type DefenseFileInput,
  type DefenseWorkspace,
  type DefenseWorkspaceInput,
} from "./project-workspace";
import { runProcessingTask } from "./run-processing-task";
import { fetchServerWorkspace, persistServerWorkspace } from "./workspace-api";

export function useWorkspace() {
  const workspace = useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceSnapshot,
    getServerWorkspaceSnapshot,
  );

  useEffect(() => {
    let cancelled = false;

    async function syncInitialWorkspace() {
      const serverWorkspace = await fetchServerWorkspace();
      if (cancelled) return;

      if (serverWorkspace) {
        saveWorkspace(serverWorkspace);
        return;
      }

      const localWorkspace = loadWorkspace();
      if (localWorkspace) {
        await saveWorkspaceEverywhere(localWorkspace);
      }
    }

    void syncInitialWorkspace();

    return () => {
      cancelled = true;
    };
  }, []);

  function createWorkspace(input: DefenseWorkspaceInput) {
    const nextWorkspace = createProjectWorkspace(input);
    void saveWorkspaceEverywhere(nextWorkspace);
    return nextWorkspace;
  }

  function addFiles(files: DefenseFileInput[]) {
    if (!workspace) return null;
    const nextWorkspace = appendWorkspaceFiles(workspace, files);
    void saveWorkspaceEverywhere(nextWorkspace);
    return nextWorkspace;
  }

  function startProcessing() {
    if (!workspace) return null;
    const nextWorkspace = startNextProcessingTask(workspace);
    void saveWorkspaceEverywhere(nextWorkspace);
    return nextWorkspace;
  }

  function completeProcessing(taskId: string) {
    if (!workspace) return null;
    const nextWorkspace = completeProcessingTask(workspace, taskId);
    void saveWorkspaceEverywhere(nextWorkspace);
    return nextWorkspace;
  }

  async function runProcessing(taskId: string) {
    if (!workspace) return null;
    const task = workspace.processingTasks.find((item) => item.id === taskId);
    const file = workspace.files.find((item) => item.id === task?.fileId);
    if (!task || !file) return null;

    try {
      const artifact = await runProcessingTask({ file, task });
      const nextWorkspace = completeProcessingTask(
        workspace,
        taskId,
        artifact.createdAt,
        artifact,
      );
      await saveWorkspaceEverywhere(nextWorkspace);
      return nextWorkspace;
    } catch (error) {
      const nextWorkspace = failProcessingTask(
        workspace,
        taskId,
        error instanceof Error ? error.message : "解析任务失败",
      );
      await saveWorkspaceEverywhere(nextWorkspace);
      return nextWorkspace;
    }
  }

  function failProcessing(taskId: string, error: string) {
    if (!workspace) return null;
    const nextWorkspace = failProcessingTask(workspace, taskId, error);
    void saveWorkspaceEverywhere(nextWorkspace);
    return nextWorkspace;
  }

  return {
    workspace,
    summary: workspace ? summarizeWorkspace(workspace) : null,
    isLoaded: true,
    createWorkspace,
    addFiles,
    startProcessing,
    completeProcessing,
    runProcessing,
    failProcessing,
  };
}

async function saveWorkspaceEverywhere(workspace: DefenseWorkspace) {
  saveWorkspace(workspace);

  try {
    await persistServerWorkspace(workspace);
  } catch (error) {
    console.warn("Failed to sync workspace to server", error);
  }
}

function subscribeWorkspace(onStoreChange: () => void) {
  window.addEventListener(workspaceChangedEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(workspaceChangedEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

let cachedRawWorkspace: string | null = null;
let cachedWorkspace: DefenseWorkspace | null = null;

function getWorkspaceSnapshot() {
  const rawWorkspace = window.localStorage.getItem(workspaceStorageKey);
  if (rawWorkspace === cachedRawWorkspace) return cachedWorkspace;

  cachedRawWorkspace = rawWorkspace;
  cachedWorkspace = loadWorkspace();
  return cachedWorkspace;
}

function getServerWorkspaceSnapshot(): DefenseWorkspace | null {
  return null;
}

export function filesToInputs(files: FileList | File[]) {
  return Array.from(files).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));
}
