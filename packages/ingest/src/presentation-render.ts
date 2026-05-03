import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { DefenseFileRecord } from "../../../src/lib/project-workspace.ts";

export type RenderedPresentationSlide = {
  page: number;
  imagePath: string;
  thumbnailPath: string;
};

export async function renderPresentationSlides({
  buffer,
  file,
  projectId,
  repoRoot = process.cwd(),
}: {
  buffer: Buffer;
  file: DefenseFileRecord;
  projectId: string;
  repoRoot?: string;
}): Promise<RenderedPresentationSlide[]> {
  if (file.kind !== "presentation" || !file.name.toLowerCase().endsWith(".pptx")) {
    return [];
  }

  const outputDir = path.join(repoRoot, ".data", "slide-renders", projectId, file.id);
  const scriptPath = path.join(repoRoot, "scripts", "render_pptx_slides.py");
  const tempDir = await mkdtemp(path.join(tmpdir(), "presento-pptx-render-"));
  const sourcePath = path.join(tempDir, sanitizeFileName(file.name, "source.pptx"));

  try {
    await writeFile(sourcePath, buffer);
    const output = await execPythonJson(scriptPath, [sourcePath, outputDir, repoRoot]);
    return Array.isArray(output.slides) ? output.slides.filter(isRenderedPresentationSlide) : [];
  } catch {
    return [];
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

function execPythonJson(scriptPath: string, args: string[]) {
  return new Promise<{ slides?: unknown[] }>((resolve, reject) => {
    execFile(
      process.env.PRESENTO_PPT_RENDER_PYTHON ?? "python3",
      [scriptPath, ...args],
      {
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim() || "{}") as { slides?: unknown[] });
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

function isRenderedPresentationSlide(value: unknown): value is RenderedPresentationSlide {
  if (!value || typeof value !== "object") return false;
  const slide = value as Partial<RenderedPresentationSlide>;
  return (
    typeof slide.page === "number"
    && typeof slide.imagePath === "string"
    && typeof slide.thumbnailPath === "string"
  );
}

function sanitizeFileName(fileName: string, fallback: string) {
  const candidate = fileName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return candidate || fallback;
}
