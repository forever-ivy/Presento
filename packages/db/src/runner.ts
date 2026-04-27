import { execFile } from "node:child_process";

export type PsqlRunner = (sql: string) => Promise<string>;

export async function runDockerComposePsql(sql: string, cwd = process.cwd()) {
  return new Promise<string>((resolve, reject) => {
    execFile(
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
        "-c",
        sql,
      ],
      {
        cwd,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }

        resolve(stdout);
      },
    );
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
