import { execFile } from "node:child_process";
import type { DefensePracticeTurn } from "./defense-review.ts";

export type DefensePracticePsqlRunner = (sql: string) => Promise<string>;

export function createDefensePracticeDatabase(
  runPsql: DefensePracticePsqlRunner = runDockerComposePsql,
) {
  return {
    async writePracticeTurn(turn: DefensePracticeTurn) {
      await runPsql(writePracticeTurnSql(turn));
    },

    async readProjectPracticeTurns(projectId: string) {
      const output = (await runPsql(readProjectPracticeTurnsSql(projectId))).trim();
      if (!output) return [];
      return JSON.parse(output) as DefensePracticeTurn[];
    },
  };
}

export async function writePracticeTurn(turn: DefensePracticeTurn) {
  return createDefensePracticeDatabase().writePracticeTurn(turn);
}

export async function readProjectPracticeTurns(projectId: string) {
  return createDefensePracticeDatabase().readProjectPracticeTurns(projectId);
}

function writePracticeTurnSql(turn: DefensePracticeTurn) {
  return `
INSERT INTO "DefensePracticeTurn" (
  "id", "projectId", "slideIndex", "slideTitle", "teacherRole", "userAnswer",
  "aiMessage", "score", "strengths", "risks", "improvedAnswer", "followUps",
  "citations", "createdAt"
) VALUES (
  ${sqlText(turn.id)},
  ${sqlText(turn.projectId)},
  ${sqlNumber(turn.slideIndex)},
  ${sqlText(turn.slideTitle)},
  ${sqlText(turn.teacherRole)},
  ${sqlText(turn.userAnswer)},
  ${sqlText(turn.aiMessage)},
  ${sqlNumber(turn.score)},
  ${sqlJson(turn.strengths)},
  ${sqlJson(turn.risks)},
  ${sqlText(turn.improvedAnswer)},
  ${sqlJson(turn.followUps)},
  ${sqlJson(turn.citations)},
  ${sqlTimestamp(turn.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "slideIndex" = EXCLUDED."slideIndex",
  "slideTitle" = EXCLUDED."slideTitle",
  "teacherRole" = EXCLUDED."teacherRole",
  "userAnswer" = EXCLUDED."userAnswer",
  "aiMessage" = EXCLUDED."aiMessage",
  "score" = EXCLUDED."score",
  "strengths" = EXCLUDED."strengths",
  "risks" = EXCLUDED."risks",
  "improvedAnswer" = EXCLUDED."improvedAnswer",
  "followUps" = EXCLUDED."followUps",
  "citations" = EXCLUDED."citations",
  "createdAt" = EXCLUDED."createdAt";`;
}

function readProjectPracticeTurnsSql(projectId: string) {
  return `
SELECT COALESCE(
  json_agg(
    json_build_object(
      'id', "id",
      'projectId', "projectId",
      'slideIndex', "slideIndex",
      'slideTitle', "slideTitle",
      'teacherRole', "teacherRole",
      'userAnswer', "userAnswer",
      'aiMessage', "aiMessage",
      'score', "score",
      'strengths', "strengths",
      'risks', "risks",
      'improvedAnswer', "improvedAnswer",
      'followUps', "followUps",
      'citations', "citations",
      'createdAt', to_json("createdAt")
    )
    ORDER BY "createdAt"
  ),
  '[]'::json
)::text
FROM "DefensePracticeTurn"
WHERE "projectId" = ${sqlText(projectId)};
`;
}

function sqlText(value: string | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlTimestamp(value: string | null | undefined) {
  if (!value) return "NULL";
  return `${sqlText(value)}::timestamptz`;
}

function sqlJson(value: unknown) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function sqlNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.trunc(value));
}

async function runDockerComposePsql(sql: string) {
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
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
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
