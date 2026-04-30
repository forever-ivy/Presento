import type { JobRunRecord } from "@shared/domain";
import type { PersistedFileRecord, PersistedTaskRecord } from "@db/repositories/files";
import { stableId } from "./project-workspace.ts";

type FetchLike = typeof fetch;

export type GitHubRepositoryDescriptor = {
  provider: "github";
  owner: string;
  repo: string;
  url: string;
};

export type CodeRepositorySourceRecord = GitHubRepositoryDescriptor & {
  id: string;
  projectId: string;
  fileId: string;
  visibility: "public";
  status: "queued" | "processing" | "ready" | "failed";
  parser: "repomix";
  defaultBranch?: string;
  latestCommitSha?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function parsePublicGitHubRepositoryUrl(input: string): GitHubRepositoryDescriptor {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Please provide a valid GitHub repository URL.");
  }

  if (url.hostname !== "github.com") {
    throw new Error("Only public GitHub repositories are supported.");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Please provide a full GitHub repository URL.");
  }

  const [owner, rawRepo] = parts;
  const repo = rawRepo.replace(/\.git$/u, "").trim();
  if (!owner || !repo) {
    throw new Error("Please provide a full GitHub repository URL.");
  }

  return {
    provider: "github",
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}

export function buildGitHubRepositorySourceBatch({
  projectId,
  repositoryUrl,
  createdAt = new Date().toISOString(),
  defaultBranch,
  latestCommitSha,
}: {
  projectId: string;
  repositoryUrl: string;
  createdAt?: string;
  defaultBranch?: string;
  latestCommitSha?: string;
}) {
  const parsed = parsePublicGitHubRepositoryUrl(repositoryUrl);
  const baseId = stableId(projectId, parsed.owner, parsed.repo, createdAt);
  const fileId = `file-repo-${baseId}`;
  const repositoryId = `repo-${baseId}`;
  const taskId = `task-repo-${baseId}`;

  const file: PersistedFileRecord = {
    id: fileId,
    projectId,
    name: `${parsed.owner}/${parsed.repo}`,
    size: 0,
    mimeType: "application/vnd.github.repository",
    kind: "code",
    status: "已接入，待入库",
    source: "GitHub 公开仓库",
    storedName: null,
    storagePath: null,
    storageKey: null,
    uploadedAt: null,
    uploadStatus: null,
    addedAt: createdAt,
  };

  const task: PersistedTaskRecord = {
    id: taskId,
    projectId,
    fileId,
    fileName: file.name,
    kind: "code",
    title: `解析 GitHub 仓库 ${parsed.owner}/${parsed.repo}`,
    engine: "Repomix",
    status: "pending",
    progress: 0,
    createdAt,
    startedAt: null,
    completedAt: null,
    error: null,
    artifactId: null,
  };

  const codeRepository: CodeRepositorySourceRecord = {
    id: repositoryId,
    projectId,
    fileId,
    provider: "github",
    owner: parsed.owner,
    repo: parsed.repo,
    url: parsed.url,
    visibility: "public",
    status: "queued",
    parser: "repomix",
    defaultBranch,
    latestCommitSha,
    metadata: {
      repositoryUrl: parsed.url,
      parser: "repomix",
      ...(defaultBranch ? { defaultBranch } : {}),
      ...(latestCommitSha ? { latestCommitSha } : {}),
    },
    createdAt,
    updatedAt: createdAt,
  };

  const job: JobRunRecord = {
    id: `job-${taskId}`,
    projectId,
    kind: "repository_ingest",
    status: "queued",
    payload: {
      kind: "code",
      repositoryId,
      repositoryUrl: parsed.url,
      owner: parsed.owner,
      repo: parsed.repo,
      fileId,
      taskId,
    },
    createdAt,
    updatedAt: createdAt,
  };

  return {
    codeRepository,
    file,
    task,
    job,
  };
}

export async function resolvePublicGitHubRepository(
  repositoryUrl: string,
  {
    fetchImpl = fetch,
  }: {
    fetchImpl?: FetchLike;
  } = {},
) {
  const parsed = parsePublicGitHubRepositoryUrl(repositoryUrl);
  const response = await fetchImpl(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "presento-notebook-rag",
    },
  });

  if (response.status === 404) {
    throw new Error("GitHub repository not found, or it is not publicly accessible.");
  }
  if (response.status === 403) {
    throw new Error("GitHub repository lookup is temporarily rate-limited. Please try again later.");
  }
  if (!response.ok) {
    throw new Error(`GitHub repository lookup failed: ${response.status}`);
  }

  const payload = await response.json() as {
    private?: boolean;
    default_branch?: string;
    pushed_at?: string;
  };

  if (payload.private) {
    throw new Error("Only public GitHub repositories are supported.");
  }

  const defaultBranch = payload.default_branch?.trim() || undefined;
  const latestCommitSha = defaultBranch
    ? await resolveLatestGitHubCommitSha(parsed, defaultBranch, fetchImpl)
    : undefined;

  return {
    ...parsed,
    defaultBranch,
    latestCommitSha,
    pushedAt: payload.pushed_at?.trim() || undefined,
  };
}

async function resolveLatestGitHubCommitSha(
  repository: GitHubRepositoryDescriptor,
  branch: string,
  fetchImpl: FetchLike,
) {
  const response = await fetchImpl(
    `https://api.github.com/repos/${repository.owner}/${repository.repo}/commits/${encodeURIComponent(branch)}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "presento-notebook-rag",
      },
    },
  );

  if (!response.ok) {
    return undefined;
  }

  const payload = await response.json() as {
    sha?: string;
  };
  return typeof payload.sha === "string" && payload.sha.trim() ? payload.sha.trim() : undefined;
}
