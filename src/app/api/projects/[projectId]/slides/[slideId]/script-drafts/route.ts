import { randomUUID } from "node:crypto";
import { createJsonRepositoryHelpers, runDockerComposePsql } from "@db/runner";
import { sqlText } from "@db/sql";
import { z } from "zod";
import { apiError, apiOk, notFound } from "../../../../../_utils";

export const runtime = "nodejs";

const scriptVersionSchema = z.enum(["normal", "short", "keywords"]);
const scriptDraftPayloadSchema = z.object({
  contentHtml: z.string().max(500_000),
  version: scriptVersionSchema.default("normal"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; slideId: string }> },
) {
  try {
    const { projectId, slideId } = await params;
    const url = new URL(request.url);
    const version = scriptVersionSchema.parse(url.searchParams.get("version") ?? "normal");
    const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
    await ensureSlideScriptDraftTable(helpers);
    const slideExists = await readSlideExists(projectId, slideId);
    if (!slideExists) return notFound("Slide");
    const draft = await helpers.readJson<{
      contentHtml: string;
      id: string;
      updatedAt: string;
      version: string;
    } | null>(
      `
SELECT COALESCE(
  (
    SELECT row_to_json(draft_rows)
    FROM (
      SELECT "id", "version", "contentHtml", "updatedAt"
      FROM "SlideScriptDraft"
      WHERE "projectId" = ${sqlText(projectId)}
        AND "slideId" = ${sqlText(slideId)}
        AND "version" = ${sqlText(version)}
      LIMIT 1
    ) draft_rows
  ),
  'null'::json
)::text;`,
      null,
    );

    return apiOk({ draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_slide_script_draft_query", "Invalid slide script draft query.", error.flatten());
    }
    return apiError(
      500,
      "slide_script_draft_read_failed",
      error instanceof Error ? error.message : "Failed to read slide script draft.",
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string; slideId: string }> },
) {
  try {
    const { projectId, slideId } = await params;
    const payload = scriptDraftPayloadSchema.parse(await request.json().catch(() => ({})));
    const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
    await ensureSlideScriptDraftTable(helpers);
    const slideExists = await readSlideExists(projectId, slideId);
    if (!slideExists) return notFound("Slide");
    const draft = await helpers.readJson<{
      contentHtml: string;
      id: string;
      updatedAt: string;
      version: string;
    }>(
      `
WITH upserted AS (
  INSERT INTO "SlideScriptDraft" (
    "id", "projectId", "slideId", "version", "contentHtml", "createdAt", "updatedAt"
  ) VALUES (
    ${sqlText(randomUUID())},
    ${sqlText(projectId)},
    ${sqlText(slideId)},
    ${sqlText(payload.version)},
    ${sqlText(payload.contentHtml)},
    NOW(),
    NOW()
  )
  ON CONFLICT ("projectId", "slideId", "version") DO UPDATE SET
    "contentHtml" = EXCLUDED."contentHtml",
    "updatedAt" = NOW()
  RETURNING *
)
SELECT row_to_json(upserted)::text FROM upserted;`,
      {
        contentHtml: payload.contentHtml,
        id: "",
        updatedAt: new Date().toISOString(),
        version: payload.version,
      },
    );

    return apiOk({ draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_slide_script_draft_payload", "Invalid slide script draft payload.", error.flatten());
    }
    return apiError(
      500,
      "slide_script_draft_save_failed",
      error instanceof Error ? error.message : "Failed to save slide script draft.",
    );
  }
}

async function ensureSlideScriptDraftTable(helpers = createJsonRepositoryHelpers(runDockerComposePsql)) {
  await helpers.run(`
CREATE TABLE IF NOT EXISTS "SlideScriptDraft" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "slideId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "contentHtml" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlideScriptDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SlideScriptDraft_projectId_slideId_version_key"
ON "SlideScriptDraft"("projectId", "slideId", "version");

CREATE INDEX IF NOT EXISTS "SlideScriptDraft_projectId_idx"
ON "SlideScriptDraft"("projectId");
`);
}

async function readSlideExists(projectId: string, slideId: string) {
  const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
  return helpers.readJson<boolean>(
    `
SELECT to_json(EXISTS(
  SELECT 1
  FROM "Slide"
  WHERE "projectId" = ${sqlText(projectId)}
    AND "id" = ${sqlText(slideId)}
))::text;`,
    false,
  );
}
