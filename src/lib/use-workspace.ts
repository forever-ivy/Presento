"use client";

import { useSyncExternalStore } from "react";
import {
  appendWorkspaceFiles,
  createProjectWorkspace,
  loadWorkspace,
  saveWorkspace,
  summarizeWorkspace,
  workspaceChangedEvent,
  workspaceStorageKey,
  type DefenseFileInput,
  type DefenseWorkspace,
  type DefenseWorkspaceInput,
} from "./project-workspace";

export function useWorkspace() {
  const workspace = useSyncExternalStore(
    subscribeWorkspace,
    getWorkspaceSnapshot,
    getServerWorkspaceSnapshot,
  );

  function createWorkspace(input: DefenseWorkspaceInput) {
    const nextWorkspace = createProjectWorkspace(input);
    saveWorkspace(nextWorkspace);
    return nextWorkspace;
  }

  function addFiles(files: DefenseFileInput[]) {
    if (!workspace) return null;
    const nextWorkspace = appendWorkspaceFiles(workspace, files);
    saveWorkspace(nextWorkspace);
    return nextWorkspace;
  }

  return {
    workspace,
    summary: workspace ? summarizeWorkspace(workspace) : null,
    isLoaded: true,
    createWorkspace,
    addFiles,
  };
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
