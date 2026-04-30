import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubRepositorySourceBatch,
  parsePublicGitHubRepositoryUrl,
  resolvePublicGitHubRepository,
} from "./github-repository-source.ts";

test("parses a public GitHub repository URL into normalized repository metadata", () => {
  const parsed = parsePublicGitHubRepositoryUrl("https://github.com/openai/codex");

  assert.deepEqual(parsed, {
    provider: "github",
    owner: "openai",
    repo: "codex",
    url: "https://github.com/openai/codex",
  });
});

test("rejects non-GitHub and private-looking repository URLs", () => {
  assert.throws(() => parsePublicGitHubRepositoryUrl("https://gitlab.com/openai/codex"), /GitHub/u);
  assert.throws(() => parsePublicGitHubRepositoryUrl("https://github.com/openai"), /repository/u);
});

test("builds a repository source batch with a synthetic code file, task, and ingest job", () => {
  const batch = buildGitHubRepositorySourceBatch({
    projectId: "project-1",
    repositoryUrl: "https://github.com/openai/codex",
    createdAt: "2026-04-28T10:00:00.000Z",
    defaultBranch: "main",
    latestCommitSha: "abc123",
  });

  assert.equal(batch.codeRepository.provider, "github");
  assert.equal(batch.codeRepository.owner, "openai");
  assert.equal(batch.codeRepository.repo, "codex");
  assert.equal(batch.codeRepository.parser, "repomix");
  assert.equal(batch.codeRepository.defaultBranch, "main");
  assert.equal(batch.codeRepository.latestCommitSha, "abc123");
  assert.equal(batch.file.kind, "code");
  assert.equal(batch.file.source, "GitHub 公开仓库");
  assert.equal(batch.task.kind, "code");
  assert.equal(batch.task.engine, "Repomix");
  assert.equal(batch.job.kind, "repository_ingest");
  assert.equal(batch.job.payload.repositoryUrl, "https://github.com/openai/codex");
});

test("resolves a public GitHub repository and returns normalized metadata", async () => {
  const fetchCalls: string[] = [];
  const repository = await resolvePublicGitHubRepository("https://github.com/openai/codex", {
    fetchImpl: async (input) => {
      fetchCalls.push(String(input));
      if (String(input).includes("/commits/")) {
        return new Response(JSON.stringify({
          sha: "abc123",
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        private: false,
        default_branch: "main",
        pushed_at: "2026-04-28T12:00:00Z",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(repository.defaultBranch, "main");
  assert.equal(repository.latestCommitSha, "abc123");
  assert.equal(fetchCalls[0], "https://api.github.com/repos/openai/codex");
});

test("rejects private or missing GitHub repositories", async () => {
  await assert.rejects(
    () => resolvePublicGitHubRepository("https://github.com/openai/codex", {
      fetchImpl: async () => new Response("{}", { status: 404 }),
    }),
    /not found/u,
  );

  await assert.rejects(
    () => resolvePublicGitHubRepository("https://github.com/openai/codex", {
      fetchImpl: async () => new Response(JSON.stringify({ private: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    }),
    /public GitHub repositories/u,
  );
});
