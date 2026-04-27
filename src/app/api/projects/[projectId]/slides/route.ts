import { createJsonRepositoryHelpers, runDockerComposePsql } from "@db/runner";
import { sqlText } from "@db/sql";
import { apiError, apiOk } from "../../../_utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
    const slideDecks = await helpers.readJson(
      `
SELECT COALESCE(
  json_agg(row_to_json(deck_rows) ORDER BY deck_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "SlideDeck" deck_rows
WHERE deck_rows."projectId" = ${sqlText(projectId)};`,
      [],
    );
    const slides = await helpers.readJson(
      `
SELECT COALESCE(
  json_agg(row_to_json(slide_rows) ORDER BY slide_rows."page" ASC, slide_rows."createdAt" ASC),
  '[]'::json
)::text
FROM "Slide" slide_rows
WHERE slide_rows."projectId" = ${sqlText(projectId)};`,
      [],
    );

    return apiOk({ slideDecks, slides });
  } catch (error) {
    return apiError(500, "slides_read_failed", error instanceof Error ? error.message : "Failed to read slides.");
  }
}
