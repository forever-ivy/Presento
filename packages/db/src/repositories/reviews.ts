import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlNumber, sqlText, sqlTimestamp } from "../sql.ts";

export type ReviewReportRecord = {
  id: string;
  projectId: string;
  sessionId: string;
  summary: string;
  averageScore: number;
  scoreLabel: string;
  clarityScore: number;
  evidenceScore: number;
  pressureScore: number;
  strengths: unknown;
  weaknesses: unknown;
  betterAnswers: unknown;
  nextActions: unknown;
  recommendedSkills: unknown;
  citations: unknown;
  createdAt: string;
};

export type WeaknessRecord = {
  id: string;
  projectId: string;
  sessionId?: string | null;
  trainingTurnId?: string | null;
  title: string;
  reason: string;
  status: string;
  citations: unknown;
  createdAt: string;
};

export function createReviewRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async createReview(review: ReviewReportRecord, weaknesses: WeaknessRecord[] = []) {
      const statements = [
        "BEGIN;",
        writeReviewSql(review),
        insertWeaknessesSql(weaknesses),
        "COMMIT;",
      ].filter(Boolean);
      await helpers.run(statements.join("\n"));
      return review;
    },

    async readBySession(sessionId: string) {
      return helpers.readJson<ReviewReportRecord | null>(readReviewBySessionSql(sessionId), null);
    },

    async readLatestByProject(projectId: string) {
      return helpers.readJson<ReviewReportRecord | null>(readLatestReviewByProjectSql(projectId), null);
    },

    async readSessionBundle(projectId: string, sessionId: string) {
      return helpers.readJson<{
        review: ReviewReportRecord | null;
        weaknesses: WeaknessRecord[];
        deepDiveRefs: Array<{ id: string; weaknessId?: string | null; title: string }>;
      }>(readReviewSessionBundleSql(projectId, sessionId), {
        review: null,
        weaknesses: [],
        deepDiveRefs: [],
      });
    },

    async listWeaknesses(projectId: string) {
      return helpers.readJson<WeaknessRecord[]>(
        `
SELECT COALESCE(
  json_agg(row_to_json(weakness_rows) ORDER BY weakness_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "Weakness" weakness_rows
WHERE weakness_rows."projectId" = ${sqlText(projectId)};`,
        [],
      );
    },

    async createWeakness(weakness: WeaknessRecord) {
      await helpers.run(insertWeaknessesSql([weakness]));
      return weakness;
    },
  };
}

function writeReviewSql(review: ReviewReportRecord) {
  return `
INSERT INTO "ReviewReport" (
  "id", "projectId", "sessionId", "summary", "averageScore", "scoreLabel",
  "clarityScore", "evidenceScore", "pressureScore", "strengths", "weaknesses",
  "betterAnswers", "nextActions", "recommendedSkills", "citations", "createdAt"
) VALUES (
  ${sqlText(review.id)},
  ${sqlText(review.projectId)},
  ${sqlText(review.sessionId)},
  ${sqlText(review.summary)},
  ${sqlNumber(review.averageScore)},
  ${sqlText(review.scoreLabel)},
  ${sqlNumber(review.clarityScore)},
  ${sqlNumber(review.evidenceScore)},
  ${sqlNumber(review.pressureScore)},
  ${sqlJson(review.strengths)},
  ${sqlJson(review.weaknesses)},
  ${sqlJson(review.betterAnswers)},
  ${sqlJson(review.nextActions)},
  ${sqlJson(review.recommendedSkills)},
  ${sqlJson(review.citations)},
  ${sqlTimestamp(review.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "summary" = EXCLUDED."summary",
  "averageScore" = EXCLUDED."averageScore",
  "scoreLabel" = EXCLUDED."scoreLabel",
  "clarityScore" = EXCLUDED."clarityScore",
  "evidenceScore" = EXCLUDED."evidenceScore",
  "pressureScore" = EXCLUDED."pressureScore",
  "strengths" = EXCLUDED."strengths",
  "weaknesses" = EXCLUDED."weaknesses",
  "betterAnswers" = EXCLUDED."betterAnswers",
  "nextActions" = EXCLUDED."nextActions",
  "recommendedSkills" = EXCLUDED."recommendedSkills",
  "citations" = EXCLUDED."citations";`;
}

function insertWeaknessesSql(weaknesses: WeaknessRecord[]) {
  if (weaknesses.length === 0) return "";
  return `
INSERT INTO "Weakness" (
  "id", "projectId", "sessionId", "trainingTurnId", "title", "reason", "status", "citations", "createdAt"
) VALUES
${weaknesses
  .map(
    (weakness) => `(
  ${sqlText(weakness.id)},
  ${sqlText(weakness.projectId)},
  ${sqlText(weakness.sessionId ?? null)},
  ${sqlText(weakness.trainingTurnId ?? null)},
  ${sqlText(weakness.title)},
  ${sqlText(weakness.reason)},
  ${sqlText(weakness.status)},
  ${sqlJson(weakness.citations)},
  ${sqlTimestamp(weakness.createdAt)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "reason" = EXCLUDED."reason",
  "status" = EXCLUDED."status",
  "citations" = EXCLUDED."citations";`;
}

function readReviewBySessionSql(sessionId: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(review_rows)
  FROM "ReviewReport" review_rows
  WHERE review_rows."sessionId" = ${sqlText(sessionId)}
  ORDER BY review_rows."createdAt" DESC
  LIMIT 1
), 'null'::json)::text;`;
}

function readLatestReviewByProjectSql(projectId: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(review_rows)
  FROM "ReviewReport" review_rows
  WHERE review_rows."projectId" = ${sqlText(projectId)}
  ORDER BY review_rows."createdAt" DESC
  LIMIT 1
), 'null'::json)::text;`;
}

function readReviewSessionBundleSql(projectId: string, sessionId: string) {
  return `
SELECT json_build_object(
  'review', (
    SELECT row_to_json(review_rows)
    FROM "ReviewReport" review_rows
    WHERE review_rows."projectId" = ${sqlText(projectId)}
      AND review_rows."sessionId" = ${sqlText(sessionId)}
    ORDER BY review_rows."createdAt" DESC
    LIMIT 1
  ),
  'weaknesses', COALESCE((
    SELECT json_agg(row_to_json(weakness_rows) ORDER BY weakness_rows."createdAt" DESC)
    FROM "Weakness" weakness_rows
    WHERE weakness_rows."projectId" = ${sqlText(projectId)}
      AND weakness_rows."sessionId" = ${sqlText(sessionId)}
  ), '[]'::json),
  'deepDiveRefs', COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', deep_dive_rows."id",
        'weaknessId', deep_dive_rows."weaknessId",
        'title', deep_dive_rows."title"
      )
      ORDER BY deep_dive_rows."createdAt" DESC
    )
    FROM "DeepDive" deep_dive_rows
    LEFT JOIN "Weakness" weakness_rows ON weakness_rows."id" = deep_dive_rows."weaknessId"
    WHERE weakness_rows."projectId" = ${sqlText(projectId)}
      AND weakness_rows."sessionId" = ${sqlText(sessionId)}
  ), '[]'::json)
)::text;`;
}
