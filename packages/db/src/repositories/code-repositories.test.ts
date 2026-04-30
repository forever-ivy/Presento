import assert from "node:assert/strict";
import test from "node:test";
import { createCodeRepositoryRepository } from "./code-repositories.ts";

test("creates and lists persisted GitHub code repositories", async () => {
  const executed: string[] = [];
  const repository = createCodeRepositoryRepository(async (sql) => {
    executed.push(sql);
    if (sql.includes('FROM "CodeRepositorySource"')) {
      return JSON.stringify([
        {
          id: "repo-1",
          projectId: "project-1",
          fileId: "file-1",
          provider: "github",
          owner: "openai",
          repo: "codex",
          url: "https://github.com/openai/codex",
          visibility: "public",
          status: "queued",
          parser: "repomix",
          defaultBranch: "main",
          latestCommitSha: "abc123",
          metadata: {},
          createdAt: "2026-04-28T10:00:00.000Z",
          updatedAt: "2026-04-28T10:00:00.000Z",
        },
      ]);
    }
    return "";
  });

  await repository.create({
    id: "repo-1",
    projectId: "project-1",
    fileId: "file-1",
    provider: "github",
    owner: "openai",
    repo: "codex",
    url: "https://github.com/openai/codex",
    visibility: "public",
    status: "queued",
    parser: "repomix",
    defaultBranch: "main",
    latestCommitSha: "abc123",
    metadata: {},
    createdAt: "2026-04-28T10:00:00.000Z",
    updatedAt: "2026-04-28T10:00:00.000Z",
  });
  const rows = await repository.list("project-1");

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.repo, "codex");
  assert.match(executed[0] ?? "", /INSERT INTO "CodeRepositorySource"/);
  assert.match(executed[1] ?? "", /FROM "CodeRepositorySource"/);
});

test("creates repository rows together with files, tasks, and jobs in one transaction", async () => {
  const executed: string[] = [];
  const repository = createCodeRepositoryRepository(async (sql) => {
    executed.push(sql);
    return "";
  });

  await repository.createBatch({
    repository: {
      id: "repo-1",
      projectId: "project-1",
      fileId: "file-1",
      provider: "github",
      owner: "openai",
      repo: "codex",
      url: "https://github.com/openai/codex",
      visibility: "public",
      status: "queued",
      parser: "repomix",
      defaultBranch: "main",
      latestCommitSha: "abc123",
      metadata: {},
      createdAt: "2026-04-28T10:00:00.000Z",
      updatedAt: "2026-04-28T10:00:00.000Z",
    },
    fileBatch: {
      files: [
        {
          id: "file-1",
          projectId: "project-1",
          name: "openai/codex",
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
          addedAt: "2026-04-28T10:00:00.000Z",
        },
      ],
      processingTasks: [
        {
          id: "task-1",
          projectId: "project-1",
          fileId: "file-1",
          fileName: "openai/codex",
          kind: "code",
          title: "解析 GitHub 仓库 openai/codex",
          engine: "Repomix",
          status: "pending",
          progress: 0,
          createdAt: "2026-04-28T10:00:00.000Z",
          startedAt: null,
          completedAt: null,
          error: null,
          artifactId: null,
        },
      ],
      jobRuns: [
        {
          id: "job-1",
          projectId: "project-1",
          kind: "repository_ingest",
          status: "queued",
          payload: {
            kind: "code",
            repositoryId: "repo-1",
            repositoryUrl: "https://github.com/openai/codex",
            fileId: "file-1",
            taskId: "task-1",
          },
          createdAt: "2026-04-28T10:00:00.000Z",
          updatedAt: "2026-04-28T10:00:00.000Z",
        },
      ],
    },
  });

  assert.match(executed[0] ?? "", /BEGIN;/u);
  assert.match(executed[0] ?? "", /INSERT INTO "FileAsset"/u);
  assert.match(executed[0] ?? "", /INSERT INTO "ProcessingTask"/u);
  assert.match(executed[0] ?? "", /INSERT INTO "JobRun"/u);
  assert.match(executed[0] ?? "", /INSERT INTO "CodeRepositorySource"/u);
  assert.match(executed[0] ?? "", /COMMIT;/u);
});
