import { readFile } from "node:fs/promises";
import path from "node:path";

import { createJsonRepositoryHelpers, runDockerComposePsql } from "@db/runner";
import { sqlText } from "@db/sql";
import { apiError } from "../../../../../_utils";

export const runtime = "nodejs";

type SlideAssetRecord = {
  imagePath?: string | null;
  thumbnailPath?: string | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; slideId: string }> },
) {
  try {
    const { projectId, slideId } = await params;
    const variant = new URL(request.url).searchParams.get("variant");
    const helpers = createJsonRepositoryHelpers(runDockerComposePsql);
    const slide = await helpers.readJson<SlideAssetRecord | null>(
      `
SELECT row_to_json(slide_rows)::text
FROM (
  SELECT "imagePath", "thumbnailPath"
  FROM "Slide"
  WHERE "projectId" = ${sqlText(projectId)}
    AND "id" = ${sqlText(slideId)}
  LIMIT 1
) slide_rows;`,
      null,
    );
    if (!slide) return apiError(404, "slide_not_found", "Slide not found.");

    const assetPath = variant === "thumbnail" ? slide.thumbnailPath : slide.imagePath;
    if (!assetPath) return apiError(404, "slide_asset_missing", "Slide image has not been rendered yet.");

    const resolvedPath = resolveSafeDataPath(assetPath);
    const body = await readFile(resolvedPath);
    return new Response(body, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": "image/png",
      },
    });
  } catch (error) {
    return apiError(500, "slide_asset_read_failed", error instanceof Error ? error.message : "Failed to read slide image.");
  }
}

function resolveSafeDataPath(assetPath: string) {
  const root = process.cwd();
  const resolved = path.resolve(root, assetPath);
  const dataRoot = path.resolve(root, ".data");
  if (!resolved.startsWith(`${dataRoot}${path.sep}`)) {
    throw new Error("Slide asset path is outside the project data directory.");
  }
  return resolved;
}
