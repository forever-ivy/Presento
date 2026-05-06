import type { RealtimeEventRecord, RealtimeSessionRecord } from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlNumber, sqlText, sqlTimestamp } from "../sql.ts";

export function createRealtimeSessionRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async createSession(session: RealtimeSessionRecord) {
      await helpers.run(writeRealtimeSessionSql(session));
      return session;
    },

    async updateSession(sessionId: string, patch: Partial<RealtimeSessionRecord>) {
      await helpers.run(updateRealtimeSessionSql(sessionId, patch));
      return this.readSession(sessionId);
    },

    async readSession(sessionId: string) {
      return helpers.readJson<RealtimeSessionRecord | null>(readRealtimeSessionSql(sessionId), null);
    },

    async readActiveForTrainingSession(trainingSessionId: string) {
      return helpers.readJson<RealtimeSessionRecord | null>(
        readActiveRealtimeSessionSql(trainingSessionId),
        null,
      );
    },

    async readByToken(sessionId: string, tokenHash: string) {
      return helpers.readJson<RealtimeSessionRecord | null>(
        readRealtimeSessionByTokenSql(sessionId, tokenHash),
        null,
      );
    },

    async listEvents(realtimeSessionId: string) {
      return helpers.readJson<RealtimeEventRecord[]>(listRealtimeEventsSql(realtimeSessionId), []);
    },

    async addEvent(event: RealtimeEventRecord) {
      await helpers.run(writeRealtimeEventSql(event));
      return event;
    },
  };
}

function writeRealtimeSessionSql(session: RealtimeSessionRecord) {
  return `
INSERT INTO "RealtimeSession" (
  "id", "projectId", "trainingSessionId", "provider", "providerSessionId", "status",
  "currentSlideId", "currentKnowledgeNodeId", "currentPhase", "currentSlideIndex", "teacherRole",
  "difficulty", "contextSnapshot", "clientTokenHash", "tokenExpiresAt", "startedAt", "endedAt",
  "createdAt", "updatedAt"
) VALUES (
  ${sqlText(session.id)},
  ${sqlText(session.projectId)},
  ${sqlText(session.trainingSessionId)},
  ${sqlText(session.provider)},
  ${sqlText(session.providerSessionId)},
  ${sqlText(session.status)},
  ${sqlText(session.currentSlideId)},
  ${sqlText(session.currentKnowledgeNodeId)},
  ${sqlText(session.currentPhase)},
  ${sqlNumber(session.currentSlideIndex)},
  ${sqlText(session.teacherRole)},
  ${sqlText(session.difficulty)},
  ${sqlJson(session.contextSnapshot)},
  ${sqlText(session.clientTokenHash)},
  ${sqlTimestamp(session.tokenExpiresAt)},
  ${sqlTimestamp(session.startedAt)},
  ${sqlTimestamp(session.endedAt)},
  ${sqlTimestamp(session.createdAt)},
  ${sqlTimestamp(session.updatedAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "providerSessionId" = EXCLUDED."providerSessionId",
  "status" = EXCLUDED."status",
  "currentSlideId" = EXCLUDED."currentSlideId",
  "currentKnowledgeNodeId" = EXCLUDED."currentKnowledgeNodeId",
  "currentPhase" = EXCLUDED."currentPhase",
  "currentSlideIndex" = EXCLUDED."currentSlideIndex",
  "teacherRole" = EXCLUDED."teacherRole",
  "difficulty" = EXCLUDED."difficulty",
  "contextSnapshot" = EXCLUDED."contextSnapshot",
  "clientTokenHash" = EXCLUDED."clientTokenHash",
  "tokenExpiresAt" = EXCLUDED."tokenExpiresAt",
  "startedAt" = EXCLUDED."startedAt",
  "endedAt" = EXCLUDED."endedAt",
  "updatedAt" = EXCLUDED."updatedAt";`;
}

function updateRealtimeSessionSql(sessionId: string, patch: Partial<RealtimeSessionRecord>) {
  const sets = [
    patch.providerSessionId !== undefined
      ? `"providerSessionId" = ${sqlText(patch.providerSessionId ?? null)}`
      : null,
    patch.status !== undefined ? `"status" = ${sqlText(patch.status)}` : null,
    patch.currentSlideId !== undefined
      ? `"currentSlideId" = ${sqlText(patch.currentSlideId ?? null)}`
      : null,
    patch.currentKnowledgeNodeId !== undefined
      ? `"currentKnowledgeNodeId" = ${sqlText(patch.currentKnowledgeNodeId ?? null)}`
      : null,
    patch.currentPhase !== undefined ? `"currentPhase" = ${sqlText(patch.currentPhase)}` : null,
    patch.currentSlideIndex !== undefined ? `"currentSlideIndex" = ${sqlNumber(patch.currentSlideIndex)}` : null,
    patch.teacherRole !== undefined ? `"teacherRole" = ${sqlText(patch.teacherRole)}` : null,
    patch.difficulty !== undefined ? `"difficulty" = ${sqlText(patch.difficulty)}` : null,
    patch.contextSnapshot !== undefined ? `"contextSnapshot" = ${sqlJson(patch.contextSnapshot)}` : null,
    patch.clientTokenHash !== undefined ? `"clientTokenHash" = ${sqlText(patch.clientTokenHash)}` : null,
    patch.tokenExpiresAt !== undefined ? `"tokenExpiresAt" = ${sqlTimestamp(patch.tokenExpiresAt)}` : null,
    patch.startedAt !== undefined ? `"startedAt" = ${sqlTimestamp(patch.startedAt ?? null)}` : null,
    patch.endedAt !== undefined ? `"endedAt" = ${sqlTimestamp(patch.endedAt ?? null)}` : null,
    `"updatedAt" = now()`,
  ].filter(Boolean);

  return `
UPDATE "RealtimeSession"
SET ${sets.join(",\n    ")}
WHERE "id" = ${sqlText(sessionId)};`;
}

function readRealtimeSessionSql(sessionId: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(realtime_rows)
  FROM "RealtimeSession" realtime_rows
  WHERE realtime_rows."id" = ${sqlText(sessionId)}
  LIMIT 1
), 'null'::json)::text;`;
}

function readActiveRealtimeSessionSql(trainingSessionId: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(realtime_rows)
  FROM "RealtimeSession" realtime_rows
  WHERE realtime_rows."trainingSessionId" = ${sqlText(trainingSessionId)}
    AND realtime_rows."status" IN ('created', 'connecting', 'active', 'draining')
  ORDER BY realtime_rows."createdAt" DESC
  LIMIT 1
), 'null'::json)::text;`;
}

function readRealtimeSessionByTokenSql(sessionId: string, tokenHash: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(realtime_rows)
  FROM "RealtimeSession" realtime_rows
  WHERE realtime_rows."id" = ${sqlText(sessionId)}
    AND realtime_rows."clientTokenHash" = ${sqlText(tokenHash)}
    AND realtime_rows."tokenExpiresAt" >= now()
  LIMIT 1
), 'null'::json)::text;`;
}

function listRealtimeEventsSql(realtimeSessionId: string) {
  return `
SELECT COALESCE(
  json_agg(row_to_json(event_rows) ORDER BY event_rows."sequence"),
  '[]'::json
)::text
FROM "RealtimeEvent" event_rows
WHERE event_rows."realtimeSessionId" = ${sqlText(realtimeSessionId)};`;
}

function writeRealtimeEventSql(event: RealtimeEventRecord) {
  return `
INSERT INTO "RealtimeEvent" (
  "id", "projectId", "trainingSessionId", "realtimeSessionId", "turnId",
  "sequence", "source", "eventType", "payload", "createdAt"
) VALUES (
  ${sqlText(event.id)},
  ${sqlText(event.projectId)},
  ${sqlText(event.trainingSessionId)},
  ${sqlText(event.realtimeSessionId)},
  ${sqlText(event.turnId)},
  ${sqlNumber(event.sequence)},
  ${sqlText(event.source)},
  ${sqlText(event.eventType)},
  ${sqlJson(event.payload)},
  ${sqlTimestamp(event.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "turnId" = EXCLUDED."turnId",
  "sequence" = EXCLUDED."sequence",
  "source" = EXCLUDED."source",
  "eventType" = EXCLUDED."eventType",
  "payload" = EXCLUDED."payload";`;
}
