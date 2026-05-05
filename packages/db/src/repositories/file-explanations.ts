import type {
  FileExplanationSessionRecord,
  FileExplanationSessionWithTurns,
  FileExplanationTurnRecord,
} from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlText, sqlTimestamp } from "../sql.ts";

export function createFileExplanationRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async createSession(session: FileExplanationSessionRecord) {
      await helpers.run(writeSessionSql(session));
      return session;
    },

    async readSession(projectId: string, sessionId: string) {
      return helpers.readJson<FileExplanationSessionWithTurns | null>(
        readSessionSql(projectId, sessionId),
        null,
      );
    },

    async readReusableSession({
      fileId,
      focusNodeId,
      mode,
      nodeId,
      projectId,
    }: {
      fileId: string;
      focusNodeId?: string;
      mode: string;
      nodeId: string;
      projectId: string;
    }) {
      return helpers.readJson<FileExplanationSessionWithTurns | null>(
        readReusableSessionSql({ fileId, focusNodeId, mode, nodeId, projectId }),
        null,
      );
    },

    async addTurn(turn: FileExplanationTurnRecord) {
      await helpers.run([
        "BEGIN;",
        writeTurnSql(turn),
        touchSessionSql(turn.sessionId, turn.createdAt),
        "COMMIT;",
      ].join("\n"));
      return turn;
    },
  };
}

function touchSessionSql(sessionId: string, updatedAt: string) {
  return `
UPDATE "FileExplanationSession"
SET "updatedAt" = ${sqlTimestamp(updatedAt)}
WHERE "id" = ${sqlText(sessionId)};`;
}

function writeSessionSql(session: FileExplanationSessionRecord) {
  return `
INSERT INTO "FileExplanationSession" (
  "id", "projectId", "nodeId", "fileId", "sourceId", "mode", "status",
  "summary", "outline", "citations", "metadata", "createdAt", "updatedAt"
) VALUES (
  ${sqlText(session.id)},
  ${sqlText(session.projectId)},
  ${sqlText(session.nodeId)},
  ${sqlText(session.fileId)},
  ${sqlText(session.sourceId ?? null)},
  ${sqlText(session.mode)},
  ${sqlText(session.status)},
  ${sqlText(session.summary)},
  ${sqlJson(session.outline)},
  ${sqlJson(session.citations)},
  ${sqlJson(session.metadata)},
  ${sqlTimestamp(session.createdAt)},
  ${sqlTimestamp(session.updatedAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "mode" = EXCLUDED."mode",
  "status" = EXCLUDED."status",
  "summary" = EXCLUDED."summary",
  "outline" = EXCLUDED."outline",
  "citations" = EXCLUDED."citations",
  "metadata" = EXCLUDED."metadata",
  "updatedAt" = EXCLUDED."updatedAt";`;
}

function writeTurnSql(turn: FileExplanationTurnRecord) {
  return `
INSERT INTO "FileExplanationTurn" (
  "id", "sessionId", "projectId", "role", "content", "citations", "metadata", "createdAt"
) VALUES (
  ${sqlText(turn.id)},
  ${sqlText(turn.sessionId)},
  ${sqlText(turn.projectId)},
  ${sqlText(turn.role)},
  ${sqlText(turn.content)},
  ${sqlJson(turn.citations)},
  ${sqlJson(turn.metadata)},
  ${sqlTimestamp(turn.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "role" = EXCLUDED."role",
  "content" = EXCLUDED."content",
  "citations" = EXCLUDED."citations",
  "metadata" = EXCLUDED."metadata";`;
}

function readSessionSql(projectId: string, sessionId: string) {
  return `
WITH target_session AS (
  SELECT *
  FROM "FileExplanationSession"
  WHERE "projectId" = ${sqlText(projectId)}
    AND "id" = ${sqlText(sessionId)}
  LIMIT 1
)
SELECT COALESCE((
  SELECT json_build_object(
    'id', target_session."id",
    'projectId', target_session."projectId",
    'nodeId', target_session."nodeId",
    'fileId', target_session."fileId",
    'sourceId', target_session."sourceId",
    'mode', target_session."mode",
    'status', target_session."status",
    'summary', target_session."summary",
    'outline', target_session."outline",
    'citations', target_session."citations",
    'metadata', target_session."metadata",
    'createdAt', target_session."createdAt",
    'updatedAt', target_session."updatedAt",
    'turns', COALESCE((
      SELECT json_agg(row_to_json(turn_rows) ORDER BY turn_rows."createdAt")
      FROM "FileExplanationTurn" turn_rows
      WHERE turn_rows."sessionId" = target_session."id"
    ), '[]'::json)
  )
  FROM target_session
), 'null'::json)::text;`;
}

function readReusableSessionSql({
  fileId,
  focusNodeId,
  mode,
  nodeId,
  projectId,
}: {
  fileId: string;
  focusNodeId?: string;
  mode: string;
  nodeId: string;
  projectId: string;
}) {
  return `
WITH target_session AS (
  SELECT *
  FROM "FileExplanationSession"
  WHERE "projectId" = ${sqlText(projectId)}
    AND "nodeId" = ${sqlText(nodeId)}
    AND "fileId" = ${sqlText(fileId)}
    AND "mode" = ${sqlText(mode)}
    AND COALESCE("metadata"->>'focusNodeId', '') = ${sqlText(focusNodeId ?? "")}
    AND "status" IN ('ready', 'completed', 'fallback')
  ORDER BY "updatedAt" DESC
  LIMIT 1
)
SELECT COALESCE((
  SELECT json_build_object(
    'id', target_session."id",
    'projectId', target_session."projectId",
    'nodeId', target_session."nodeId",
    'fileId', target_session."fileId",
    'sourceId', target_session."sourceId",
    'mode', target_session."mode",
    'status', target_session."status",
    'summary', target_session."summary",
    'outline', target_session."outline",
    'citations', target_session."citations",
    'metadata', target_session."metadata",
    'createdAt', target_session."createdAt",
    'updatedAt', target_session."updatedAt",
    'turns', COALESCE((
      SELECT json_agg(row_to_json(turn_rows) ORDER BY turn_rows."createdAt")
      FROM "FileExplanationTurn" turn_rows
      WHERE turn_rows."sessionId" = target_session."id"
    ), '[]'::json)
  )
  FROM target_session
), 'null'::json)::text;`;
}
