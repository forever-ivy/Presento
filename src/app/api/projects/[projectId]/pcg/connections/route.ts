import { createJsonRepositoryHelpers, runDockerComposePsql } from "@db/runner";
import { sqlJson, sqlText, sqlTimestamp } from "@db/sql";
import { z } from "zod";
import { apiError, apiOk } from "../../../../_utils";

export const runtime = "nodejs";

const pcgConnectionSchema = z.object({
  channel: z.string().min(1),
  status: z.string().default("simulated"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
    const connections = await helpers.readJson(
      `
SELECT COALESCE(
  json_agg(row_to_json(connection_rows) ORDER BY connection_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "PcgMockConnection" connection_rows
WHERE connection_rows."projectId" = ${sqlText(projectId)};`,
      [],
    );
    return apiOk({ connections });
  } catch (error) {
    return apiError(500, "pcg_connections_read_failed", error instanceof Error ? error.message : "Failed to read PCG connections.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const payload = pcgConnectionSchema.parse(await request.json());
    const connection = {
      id: `pcg-${crypto.randomUUID()}`,
      projectId,
      channel: payload.channel,
      status: payload.status,
      metadata: payload.metadata,
      createdAt: new Date().toISOString(),
    };
    const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
    await helpers.run(`
INSERT INTO "PcgMockConnection" (
  "id", "projectId", "channel", "status", "metadata", "createdAt"
) VALUES (
  ${sqlText(connection.id)},
  ${sqlText(connection.projectId)},
  ${sqlText(connection.channel)},
  ${sqlText(connection.status)},
  ${sqlJson(connection.metadata)},
  ${sqlTimestamp(connection.createdAt)}
);`);
    return apiOk({ connection }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(400, "invalid_pcg_connection_payload", "Invalid PCG connection payload.", error.flatten());
    }
    return apiError(500, "pcg_connection_create_failed", error instanceof Error ? error.message : "Failed to create PCG connection.");
  }
}
