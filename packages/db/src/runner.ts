import { spawn } from "node:child_process";

export type PsqlRunner = (sql: string) => Promise<string>;

export async function runDockerComposePsql(sql: string, cwd = process.cwd()) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "defense",
        "-d",
        "defense_coach",
        "-tA",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        cwd,
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code) {
        reject(new Error(stderr || `psql exited with code ${code}`));
        return;
      }
        resolve(stdout);
    });

    child.stdin.end(`${sql}\n`);
  });
}

export function createJsonRepositoryHelpers(runSql: PsqlRunner = runDockerComposePsql) {
  return {
    runSql,
    async readJson<T>(sql: string, fallback: T): Promise<T> {
      const output = (await runSql(sql)).trim();
      if (!output) return fallback;
      return JSON.parse(output) as T;
    },
    async run(sql: string) {
      await runSql(sql);
    },
  };
}
