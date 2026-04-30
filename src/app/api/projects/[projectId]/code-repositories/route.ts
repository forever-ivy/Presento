import { createCodeRepositoryRepository } from "@db/repositories/code-repositories";
import { createProjectRepository } from "@db/repositories/projects";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../_utils";
import {
  buildGitHubRepositorySourceBatch,
  resolvePublicGitHubRepository,
} from "@/lib/github-repository-source";

export const runtime = "nodejs";

const createCodeRepositoryPayloadSchema = z.object({
  repositoryUrl: z.string().trim().min(1),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const repositories = await createCodeRepositoryRepository().list(projectId);
    return apiOk({ repositories });
  } catch (error) {
    return apiError(
      500,
      "code_repositories_read_failed",
      error instanceof Error ? error.message : "Failed to read code repositories.",
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = createCodeRepositoryPayloadSchema.parse(await request.json());
    const project = await createProjectRepository().read(projectId);
    if (!project) return notFound("Project");

    const repositoryMeta = await resolvePublicGitHubRepository(payload.repositoryUrl);
    const batch = buildGitHubRepositorySourceBatch({
      projectId,
      repositoryUrl: repositoryMeta.url,
      defaultBranch: repositoryMeta.defaultBranch,
      latestCommitSha: repositoryMeta.latestCommitSha,
    });

    await createCodeRepositoryRepository().createBatch({
      repository: batch.codeRepository,
      fileBatch: {
        files: [batch.file],
        processingTasks: [batch.task],
        jobRuns: [batch.job],
      },
    });

    return apiOk({
      repository: batch.codeRepository,
      file: batch.file,
      processingTask: batch.task,
      jobRun: batch.job,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(
        400,
        "invalid_code_repository_payload",
        "Invalid code repository payload.",
        error.flatten(),
      );
    }

    if (error instanceof Error) {
      if (
        error.message.includes("GitHub")
        || error.message.includes("public repository")
        || error.message.includes("not found")
        || error.message.includes("rate limit")
      ) {
        return apiError(400, "code_repository_create_failed", error.message);
      }
      return apiError(500, "code_repository_create_failed", error.message);
    }

    return apiError(500, "code_repository_create_failed", "Failed to attach code repository.");
  }
}
