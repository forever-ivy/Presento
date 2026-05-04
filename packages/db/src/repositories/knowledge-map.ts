import type { KnowledgeEdgeRecord, KnowledgeNodeRecord } from "@shared/domain";
import { createJsonRepositoryHelpers, type PsqlRunner, runDockerComposePsql } from "../runner.ts";
import { sqlJson, sqlText, sqlTimestamp } from "../sql.ts";

export function createKnowledgeMapRepository(runSql: PsqlRunner = runDockerComposePsql) {
  const helpers = createJsonRepositoryHelpers(runSql);

  return {
    async read(projectId: string) {
      return helpers.readJson<{ nodes: KnowledgeNodeRecord[]; edges: KnowledgeEdgeRecord[] }>(
        readKnowledgeMapSql(projectId),
        { nodes: [], edges: [] },
      );
    },

    async readNode(projectId: string, nodeId: string) {
      return helpers.readJson<KnowledgeNodeRecord | null>(
        readKnowledgeNodeSql(projectId, nodeId),
        null,
      );
    },

    async upsert(nodes: KnowledgeNodeRecord[], edges: KnowledgeEdgeRecord[]) {
      const statements = [
        "BEGIN;",
        insertKnowledgeNodesSql(nodes),
        insertKnowledgeEdgesSql(edges),
        "COMMIT;",
      ].filter(Boolean);

      await helpers.run(statements.join("\n"));
      return { nodes, edges };
    },

    async replaceProjectMap(projectId: string, nodes: KnowledgeNodeRecord[], edges: KnowledgeEdgeRecord[]) {
      const statements = [
        "BEGIN;",
        `DELETE FROM "KnowledgeEdge" WHERE "projectId" = ${sqlText(projectId)};`,
        `DELETE FROM "KnowledgeNode" WHERE "projectId" = ${sqlText(projectId)};`,
        insertKnowledgeNodesSql(nodes),
        insertKnowledgeEdgesSql(edges),
        "COMMIT;",
      ].filter(Boolean);

      await helpers.run(statements.join("\n"));
      return { nodes, edges };
    },
  };
}

function readKnowledgeNodeSql(projectId: string, nodeId: string) {
  return `
SELECT COALESCE((
  SELECT row_to_json(node_rows)
  FROM "KnowledgeNode" node_rows
  WHERE node_rows."projectId" = ${sqlText(projectId)}
    AND node_rows."id" = ${sqlText(nodeId)}
  LIMIT 1
), 'null'::json)::text;`;
}

function readKnowledgeMapSql(projectId: string) {
  return `
SELECT json_build_object(
  'nodes', COALESCE((
    SELECT json_agg(row_to_json(node_rows) ORDER BY node_rows."createdAt")
    FROM "KnowledgeNode" node_rows
    WHERE node_rows."projectId" = ${sqlText(projectId)}
  ), '[]'::json),
  'edges', COALESCE((
    SELECT json_agg(row_to_json(edge_rows) ORDER BY edge_rows."createdAt")
    FROM "KnowledgeEdge" edge_rows
    WHERE edge_rows."projectId" = ${sqlText(projectId)}
  ), '[]'::json)
)::text;`;
}

function insertKnowledgeNodesSql(nodes: KnowledgeNodeRecord[]) {
  if (nodes.length === 0) return "";
  return `
INSERT INTO "KnowledgeNode" (
  "id", "projectId", "kind", "title", "summary", "tone", "sourceId", "metadata", "createdAt"
) VALUES
${nodes
  .map(
    (node) => `(
  ${sqlText(node.id)},
  ${sqlText(node.projectId)},
  ${sqlText(node.kind)},
  ${sqlText(node.title)},
  ${sqlText(node.summary)},
  ${sqlText(node.tone)},
  ${sqlText(node.sourceId ?? null)},
  ${sqlJson(node.metadata)},
  ${sqlTimestamp(node.createdAt)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "kind" = EXCLUDED."kind",
  "title" = EXCLUDED."title",
  "summary" = EXCLUDED."summary",
  "tone" = EXCLUDED."tone",
  "sourceId" = EXCLUDED."sourceId",
  "metadata" = EXCLUDED."metadata";`;
}

function insertKnowledgeEdgesSql(edges: KnowledgeEdgeRecord[]) {
  if (edges.length === 0) return "";
  return `
INSERT INTO "KnowledgeEdge" (
  "id", "projectId", "fromNodeId", "toNodeId", "kind", "label", "createdAt"
) VALUES
${edges
  .map(
    (edge) => `(
  ${sqlText(edge.id)},
  ${sqlText(edge.projectId)},
  ${sqlText(edge.fromNodeId)},
  ${sqlText(edge.toNodeId)},
  ${sqlText(edge.kind)},
  ${sqlText(edge.label ?? null)},
  ${sqlTimestamp(edge.createdAt)}
)`,
  )
  .join(",\n")}
ON CONFLICT ("id") DO UPDATE SET
  "fromNodeId" = EXCLUDED."fromNodeId",
  "toNodeId" = EXCLUDED."toNodeId",
  "kind" = EXCLUDED."kind",
  "label" = EXCLUDED."label";`;
}
