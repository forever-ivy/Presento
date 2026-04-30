import type { BuiltInSkillPackId, ProjectSkillPackRecord } from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlBoolean, sqlText, sqlTimestamp } from "../sql.ts";

export function createProjectSkillPackRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async list(projectId: string) {
      return helpers.readJson<ProjectSkillPackRecord[]>(readProjectSkillPacksSql(projectId), []);
    },

    async replace(projectId: string, assignments: ProjectSkillPackRecord[]) {
      await helpers.run(replaceProjectSkillPacksSql(projectId, assignments));
      return assignments;
    },

    async setAssignment({
      projectId,
      packId,
      enabled,
      source,
      reason,
      now = new Date().toISOString(),
    }: {
      projectId: string;
      packId: BuiltInSkillPackId;
      enabled: boolean;
      source: "default" | "explicit" | "recommended";
      reason?: string | null;
      now?: string;
    }) {
      const record: ProjectSkillPackRecord = {
        id: `project-skill-pack-${projectId}-${packId}`,
        projectId,
        packId,
        enabled,
        source,
        reason: reason ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await helpers.run(writeProjectSkillPackSql(record));
      return record;
    },
  };
}

function readProjectSkillPacksSql(projectId: string) {
  return `
SELECT COALESCE(
  json_agg(row_to_json(pack_rows) ORDER BY pack_rows."packId"),
  '[]'::json
)::text
FROM (
  SELECT *
  FROM "ProjectSkillPack"
  WHERE "projectId" = ${sqlText(projectId)}
) pack_rows;`;
}

function replaceProjectSkillPacksSql(projectId: string, assignments: ProjectSkillPackRecord[]) {
  if (assignments.length === 0) {
    return `DELETE FROM "ProjectSkillPack" WHERE "projectId" = ${sqlText(projectId)};`;
  }

  return `
BEGIN;
DELETE FROM "ProjectSkillPack" WHERE "projectId" = ${sqlText(projectId)};
${assignments.map((assignment) => writeProjectSkillPackSql(assignment)).join("\n")}
COMMIT;`;
}

function writeProjectSkillPackSql(assignment: ProjectSkillPackRecord) {
  return `
INSERT INTO "ProjectSkillPack" (
  "id", "projectId", "packId", "enabled", "source", "reason", "createdAt", "updatedAt"
) VALUES (
  ${sqlText(assignment.id)},
  ${sqlText(assignment.projectId)},
  ${sqlText(assignment.packId)},
  ${sqlBoolean(assignment.enabled)},
  ${sqlText(assignment.source)},
  ${sqlText(assignment.reason ?? null)},
  ${sqlTimestamp(assignment.createdAt)},
  ${sqlTimestamp(assignment.updatedAt)}
)
ON CONFLICT ("projectId", "packId") DO UPDATE SET
  "enabled" = EXCLUDED."enabled",
  "source" = EXCLUDED."source",
  "reason" = EXCLUDED."reason",
  "updatedAt" = EXCLUDED."updatedAt";`;
}
