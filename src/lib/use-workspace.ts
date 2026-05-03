"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchProjectWorkspace } from "./project-workspace-api";
import {
  summarizeWorkspace,
  type DefenseWorkspace,
} from "./project-workspace";

export function useProjectWorkspace(projectId: string) {
  const [workspace, setWorkspace] = useState<DefenseWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setWorkspace(null);
      setIsLoading(false);
      setError("缺少项目 ID");
      return null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextWorkspace = await fetchProjectWorkspace(projectId);
      setWorkspace(nextWorkspace);
      return nextWorkspace;
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "项目资料读取失败";
      setWorkspace(null);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const nextWorkspace = await fetchProjectWorkspace(projectId);
        if (!cancelled) setWorkspace(nextWorkspace);
      } catch (nextError) {
        if (!cancelled) {
          setWorkspace(null);
          setError(nextError instanceof Error ? nextError.message : "项目资料读取失败");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const summary = useMemo(
    () => (workspace ? summarizeWorkspace(workspace) : null),
    [workspace],
  );

  return {
    workspace,
    summary,
    isLoading,
    isLoaded: !isLoading,
    error,
    refresh,
  };
}

export function filesToInputs(files: FileList | File[]) {
  return Array.from(files).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));
}
