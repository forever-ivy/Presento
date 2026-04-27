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
    const artifacts = await helpers.readJson(
      `
SELECT COALESCE(
  json_agg(row_to_json(artifact_rows) ORDER BY artifact_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "Artifact" artifact_rows
WHERE artifact_rows."projectId" = ${sqlText(projectId)};`,
      [],
    );

    return apiOk({ artifacts });
  } catch (error) {
    return apiError(500, "artifacts_read_failed", error instanceof Error ? error.message : "Failed to read artifacts.");
  }
}
