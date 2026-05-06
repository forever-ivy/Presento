import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "@db/runner";
import { sqlText } from "@db/sql";
import { buildProjectOverview, type ProjectOverviewCounts, type ProjectOverviewDto } from "./project-overview";

export async function readProjectOverview(
  projectId: string,
  runSql: PsqlRunner = runDockerComposePsql,
): Promise<ProjectOverviewDto | null> {
  const helpers = createJsonRepositoryHelpers(runSql);
  const row = await helpers.readJson<{
    counts: ProjectOverviewCounts;
    latestReview: ProjectOverviewDto["latestReview"];
    project: ProjectOverviewDto["project"];
  } | null>(readProjectOverviewSql(projectId), null);

  if (!row) return null;
  return buildProjectOverview(row);
}

function readProjectOverviewSql(projectId: string) {
  return `
WITH target_project AS (
  SELECT *
  FROM "Project"
  WHERE "id" = ${sqlText(projectId)}
  LIMIT 1
),
completed_training_slides AS (
  SELECT DISTINCT completed_slide_ids.value AS "slideId"
  FROM "TrainingSession" training_rows
  CROSS JOIN LATERAL jsonb_array_elements_text(training_rows."completedSlideIds") completed_slide_ids(value)
  WHERE training_rows."projectId" = ${sqlText(projectId)}
)
SELECT COALESCE((
  SELECT json_build_object(
    'project', json_build_object(
      'id', target_project."id",
      'name', target_project."name",
      'category', target_project."category",
      'ownerScope', target_project."ownerScope",
      'teammateScope', target_project."teammateScope",
      'deadlineAt', row_to_json(target_project)->'deadlineAt',
      'createdAt', to_json(target_project."createdAt"),
      'updatedAt', to_json(target_project."updatedAt")
    ),
    'counts', json_build_object(
      'contentExportCount', COALESCE((SELECT count(*) FROM "ContentExport" export_rows WHERE export_rows."projectId" = target_project."id"), 0),
      'deepDiveCount', COALESCE((SELECT count(*) FROM "DeepDive" deep_dive_rows WHERE deep_dive_rows."projectId" = target_project."id"), 0),
      'fileCount', COALESCE((SELECT count(*) FROM "FileAsset" file_rows WHERE file_rows."projectId" = target_project."id"), 0),
      'knowledgeNodeCount', COALESCE((SELECT count(*) FROM "KnowledgeNode" node_rows WHERE node_rows."projectId" = target_project."id"), 0),
      'practiceCompletedSlideCount', COALESCE((SELECT count(*) FROM completed_training_slides), 0),
      'scriptCompletedSlideCount', COALESCE((
        SELECT count(DISTINCT draft_rows."slideId")
        FROM "SlideScriptDraft" draft_rows
        WHERE draft_rows."projectId" = target_project."id"
          AND draft_rows."version" = 'normal'
          AND btrim(draft_rows."contentHtml") <> ''
      ), 0),
      'slideCount', COALESCE((SELECT count(*) FROM "Slide" slide_rows WHERE slide_rows."projectId" = target_project."id"), 0),
      'trainingSessionCount', COALESCE((SELECT count(*) FROM "TrainingSession" training_rows WHERE training_rows."projectId" = target_project."id"), 0),
      'weaknessCount', COALESCE((SELECT count(*) FROM "Weakness" weakness_rows WHERE weakness_rows."projectId" = target_project."id"), 0)
    ),
    'latestReview', (
      SELECT json_build_object(
        'id', review_rows."id",
        'averageScore', review_rows."averageScore",
        'scoreLabel', review_rows."scoreLabel",
        'createdAt', to_json(review_rows."createdAt")
      )
      FROM "ReviewReport" review_rows
      WHERE review_rows."projectId" = target_project."id"
      ORDER BY review_rows."createdAt" DESC
      LIMIT 1
    )
  )
  FROM target_project
), 'null'::json)::text;
`;
}
