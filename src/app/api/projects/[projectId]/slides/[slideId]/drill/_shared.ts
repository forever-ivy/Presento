import { createJsonRepositoryHelpers, runDockerComposePsql } from "@db/runner";
import { sqlText } from "@db/sql";

export type SlideDrillStateRow = {
  id: string;
  messages: unknown[];
  questions: unknown[];
  updatedAt: string;
};

export type DrillSlideRow = {
  id: string;
  deckId: string;
  projectId: string;
  fileId?: string | null;
  page: number;
  title: string;
  extractedText?: string | null;
};

export async function ensureSlideDrillStateTable(
  helpers = createJsonRepositoryHelpers(runDockerComposePsql),
) {
  await helpers.run(`
CREATE TABLE IF NOT EXISTS "SlideDrillState" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "slideId" TEXT NOT NULL,
  "questions" JSONB NOT NULL,
  "messages" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlideDrillState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SlideDrillState_projectId_slideId_key"
ON "SlideDrillState"("projectId", "slideId");

CREATE INDEX IF NOT EXISTS "SlideDrillState_projectId_idx"
ON "SlideDrillState"("projectId");
`);
}

export async function readDrillSlide(projectId: string, slideId: string) {
  const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
  return helpers.readJson<DrillSlideRow | null>(
    `
SELECT COALESCE(
  (
    SELECT row_to_json(slide_rows)
    FROM "Slide" slide_rows
    WHERE slide_rows."projectId" = ${sqlText(projectId)}
      AND slide_rows."id" = ${sqlText(slideId)}
    LIMIT 1
  ),
  'null'::json
)::text;`,
    null,
  );
}

export async function readSlideDrillState(projectId: string, slideId: string) {
  const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
  await ensureSlideDrillStateTable(helpers);
  return helpers.readJson<SlideDrillStateRow | null>(
    `
SELECT COALESCE(
  (
    SELECT row_to_json(state_rows)
    FROM (
      SELECT "id", "questions", "messages", "updatedAt"
      FROM "SlideDrillState"
      WHERE "projectId" = ${sqlText(projectId)}
        AND "slideId" = ${sqlText(slideId)}
      LIMIT 1
    ) state_rows
  ),
  'null'::json
)::text;`,
    null,
  );
}
