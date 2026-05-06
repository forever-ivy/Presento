import type { KnowledgeMapUi } from "@/lib/knowledge-map-client";
import type { DefenseWorkspace } from "@/lib/project-workspace";

export function shouldShowKnowledgeMapLoadingState({
  apiNodeCount,
  generation,
  isLoadingMap,
  isLoadingWorkspace,
  workspace,
}: {
  apiNodeCount: number;
  generation: KnowledgeMapUi["generation"];
  isLoadingMap: boolean;
  isLoadingWorkspace: boolean;
  workspace: DefenseWorkspace | null;
}) {
  if (apiNodeCount > 0) return false;
  if (isLoadingMap || isLoadingWorkspace) return true;
  if (generation.status === "queued" || generation.status === "running" || generation.status === "retryable") return true;

  const tasks = workspace?.processingTasks ?? [];
  return tasks.some((task) => task.status === "pending" || task.status === "processing");
}
