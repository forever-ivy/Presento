import type { ProjectWorkspaceDto } from "@shared/domain";
import { readApiErrorMessage } from "./api-error";
import type {
  DefenseFileKind,
  DefenseFileRecord,
  DefenseProcessingArtifact,
  DefenseProcessingTask,
  DefenseWorkspace,
  ProcessingTaskStatus,
} from "./project-workspace";

export async function fetchProjectWorkspace(projectId: string) {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workspace`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  const payload = (await response.json()) as { workspace?: ProjectWorkspaceDto | null };
  return payload.workspace ? toDefenseWorkspace(payload.workspace) : null;
}

function toDefenseWorkspace(workspace: ProjectWorkspaceDto): DefenseWorkspace {
  return {
    project: workspace.project,
    files: workspace.files.map((file) => ({
      ...file,
      type: file.mimeType ?? undefined,
    })) as DefenseFileRecord[],
    processingTasks: workspace.processingTasks.map((task) => ({
      ...task,
      kind: task.kind as DefenseFileKind,
      status: task.status as ProcessingTaskStatus,
      error: task.error ?? undefined,
      startedAt: task.startedAt ?? undefined,
      completedAt: task.completedAt ?? undefined,
      artifactId: task.artifactId ?? undefined,
    })) as DefenseProcessingTask[],
    artifacts: workspace.artifacts.map((artifact) => ({
      ...artifact,
      kind: artifact.kind as DefenseFileKind,
      previewLines: Array.isArray(artifact.previewLines)
        ? artifact.previewLines.map(String)
        : [],
      sourcePath: artifact.sourcePath ?? undefined,
    })) as DefenseProcessingArtifact[],
    trainingSessionCount: workspace.trainingSessionCount,
    latestReview: workspace.latestReview,
  };
}
