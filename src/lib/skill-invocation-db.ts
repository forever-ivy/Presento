import { execFile } from "node:child_process";
import type { SkillInvocationRecord } from "./skill-runner.ts";

export type SkillInvocationPsqlRunner = (sql: string) => Promise<string>;

export function createSkillInvocationDatabase(
  runPsql: SkillInvocationPsqlRunner = runDockerComposePsql,
) {
  return {
    async writeSkillInvocation(invocation: SkillInvocationRecord) {
      await runPsql(writeSkillInvocationSql(invocation));
    },

    async readProjectSkillInvocations(projectId: string, limit = 20) {
      const output = (await runPsql(readProjectSkillInvocationsSql(projectId, limit))).trim();
      if (!output) return [];
      return JSON.parse(output) as SkillInvocationRecord[];
    },
  };
}

export async function writeSkillInvocation(invocation: SkillInvocationRecord) {
  return createSkillInvocationDatabase().writeSkillInvocation(invocation);
}

export async function readProjectSkillInvocations(projectId: string, limit?: number) {
  return createSkillInvocationDatabase().readProjectSkillInvocations(projectId, limit);
}

function writeSkillInvocationSql(invocation: SkillInvocationRecord) {
  return `
INSERT INTO "SkillInvocation" (
  "id", "projectId", "skillName", "skillVersion", "trigger", "resolvedBy", "status", "input", "output",
  "error", "traceId", "langfuseTraceId", "langfuseObservationId", "usedFallback", "retrievalSummary",
  "toolCalls", "outputSummary", "feedbackStatus", "startedAt", "completedAt", "durationMs"
) VALUES (
  ${sqlText(invocation.id)},
  ${sqlText(invocation.projectId)},
  ${sqlText(invocation.skillName)},
  ${sqlText(invocation.skillVersion)},
  ${sqlText(invocation.trigger)},
  ${sqlText(invocation.resolvedBy)},
  ${sqlText(invocation.status)},
  ${sqlJson(invocation.input)},
  ${sqlJson(invocation.output)},
  ${sqlText(invocation.error ?? null)},
  ${sqlText(invocation.traceId ?? null)},
  ${sqlText(invocation.langfuseTraceId ?? null)},
  ${sqlText(invocation.langfuseObservationId ?? null)},
  ${sqlBoolean(invocation.usedFallback)},
  ${sqlJson(invocation.retrievalSummary ?? null)},
  ${sqlJson(invocation.toolCalls)},
  ${sqlJson(invocation.outputSummary ?? null)},
  ${sqlText(invocation.feedbackStatus)},
  ${sqlTimestamp(invocation.startedAt)},
  ${sqlTimestamp(invocation.completedAt)},
  ${sqlNumber(invocation.durationMs)}
)
ON CONFLICT ("id") DO UPDATE SET
  "skillName" = EXCLUDED."skillName",
  "skillVersion" = EXCLUDED."skillVersion",
  "trigger" = EXCLUDED."trigger",
  "resolvedBy" = EXCLUDED."resolvedBy",
  "status" = EXCLUDED."status",
  "input" = EXCLUDED."input",
  "output" = EXCLUDED."output",
  "error" = EXCLUDED."error",
  "traceId" = EXCLUDED."traceId",
  "langfuseTraceId" = EXCLUDED."langfuseTraceId",
  "langfuseObservationId" = EXCLUDED."langfuseObservationId",
  "usedFallback" = EXCLUDED."usedFallback",
  "retrievalSummary" = EXCLUDED."retrievalSummary",
  "toolCalls" = EXCLUDED."toolCalls",
  "outputSummary" = EXCLUDED."outputSummary",
  "feedbackStatus" = EXCLUDED."feedbackStatus",
  "startedAt" = EXCLUDED."startedAt",
  "completedAt" = EXCLUDED."completedAt",
  "durationMs" = EXCLUDED."durationMs";`;
}

function readProjectSkillInvocationsSql(projectId: string, limit: number) {
  return `
SELECT COALESCE(
  json_agg(
    json_build_object(
      'id', "id",
      'projectId', "projectId",
      'skillName', "skillName",
      'skillVersion', "skillVersion",
      'trigger', "trigger",
      'resolvedBy', "resolvedBy",
      'status', "status",
      'input', "input",
      'output', "output",
      'error', "error",
      'traceId', "traceId",
      'langfuseTraceId', "langfuseTraceId",
      'langfuseObservationId', "langfuseObservationId",
      'usedFallback', "usedFallback",
      'retrievalSummary', "retrievalSummary",
      'toolCalls', "toolCalls",
      'outputSummary', "outputSummary",
      'feedbackStatus', "feedbackStatus",
      'startedAt', to_json("startedAt"),
      'completedAt', to_json("completedAt"),
      'durationMs', "durationMs"
    )
    ORDER BY "startedAt" DESC
  ),
  '[]'::json
)::text
FROM (
  SELECT *
  FROM "SkillInvocation"
  WHERE "projectId" = ${sqlText(projectId)}
  ORDER BY "startedAt" DESC
  LIMIT ${sqlNumber(limit)}
) skill_rows;
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

function sqlBoolean(value: boolean) {
  return value ? "true" : "false";
}

function sqlNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.max(0, Math.trunc(value)));
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
