import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlText, sqlTimestamp } from "../sql.ts";

export type ContentExportRecord = {
  id: string;
  projectId: string;
  reviewId?: string | null;
  kind: string;
  title: string;
  content: unknown;
  status: string;
  createdAt: string;
};

export function createContentExportRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async create(record: ContentExportRecord) {
      await helpers.run(`
INSERT INTO "ContentExport" (
  "id", "projectId", "reviewId", "kind", "title", "content", "status", "createdAt"
) VALUES (
  ${sqlText(record.id)},
  ${sqlText(record.projectId)},
  ${sqlText(record.reviewId)},
  ${sqlText(record.kind)},
  ${sqlText(record.title)},
  ${sqlJson(record.content)},
  ${sqlText(record.status)},
  ${sqlTimestamp(record.createdAt)}
)
ON CONFLICT ("id") DO UPDATE SET
  "content" = EXCLUDED."content",
  "status" = EXCLUDED."status";`);
      return record;
    },

    async list(projectId: string) {
      return helpers.readJson<ContentExportRecord[]>(
        `
SELECT COALESCE(
  json_agg(row_to_json(export_rows) ORDER BY export_rows."createdAt" DESC),
  '[]'::json
)::text
FROM "ContentExport" export_rows
WHERE export_rows."projectId" = ${sqlText(projectId)};`,
        [],
      );
    },
  };
}
