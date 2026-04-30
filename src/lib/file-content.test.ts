import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { FileContentError, contentDispositionFileName, contentDispositionHeader, inferContentType, readProjectFileContent } from "./file-content.ts";

test("readProjectFileContent reads a registered local project file", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "presento-file-content-"));
  const uploadDir = join(cwd, ".data", "uploads", "2026-04-29");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, "abc-readme.md"), "# Hello\n");

  const content = await readProjectFileContent({
    cwd,
    fileId: "file-readme",
    projectId: "project-demo",
    repository: {
      async read(projectId, fileId) {
        assert.equal(projectId, "project-demo");
        assert.equal(fileId, "file-readme");
        return {
          addedAt: "2026-04-29T00:00:00.000Z",
          id: fileId,
          kind: "document",
          mimeType: "text/markdown",
          name: "README.md",
          size: 8,
          source: "upload",
          status: "stored",
          storagePath: ".data/uploads/2026-04-29/abc-readme.md",
        };
      },
    },
  });

  assert.equal(content.body.toString("utf8"), "# Hello\n");
  assert.equal(content.contentType, "text/markdown");
  assert.equal(content.fileName, "README.md");
});

test("readProjectFileContent rejects missing or unavailable files", async () => {
  await assert.rejects(
    () => readProjectFileContent({
      fileId: "missing",
      projectId: "project-demo",
      repository: { async read() { return null; } },
    }),
    (error) => error instanceof FileContentError && error.status === 404 && error.code === "file_not_found",
  );

  await assert.rejects(
    () => readProjectFileContent({
      fileId: "file-readme",
      projectId: "project-demo",
      repository: {
        async read() {
          return {
            addedAt: "2026-04-29T00:00:00.000Z",
            id: "file-readme",
            kind: "document",
            name: "README.md",
            size: 8,
            source: "upload",
            status: "stored",
          };
        },
      },
    }),
    (error) => error instanceof FileContentError && error.status === 404 && error.code === "file_content_unavailable",
  );
});

test("readProjectFileContent serves allowlisted demo mock files", async () => {
  const mockRoot = await mkdtemp(join(tmpdir(), "presento-mock-files-"));
  await writeFile(join(mockRoot, "invoice.xlsx"), "fake workbook bytes");

  const content = await readProjectFileContent({
    fileId: "mock-invoice",
    mockRoot,
    projectId: "demo",
    repository: { async read() { return null; } },
  });

  assert.equal(content.body.toString("utf8"), "fake workbook bytes");
  assert.equal(content.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(content.fileName, "invoice.xlsx");
});

test("inferContentType maps common preview file extensions", () => {
  assert.equal(inferContentType("report.pdf"), "application/pdf");
  assert.equal(inferContentType("orders.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(inferContentType("README.md"), "text/markdown; charset=utf-8");
});

test("contentDispositionHeader encodes non-ASCII file names", () => {
  const fallbackName = contentDispositionFileName("实验1运算器实验报告.pdf");
  const header = contentDispositionHeader("实验1运算器实验报告.pdf");

  assert.doesNotMatch(fallbackName, /[^\x20-\x7E]/);
  assert.doesNotMatch(header, /[^\x20-\x7E]/);
  assert.match(header, /^inline; filename="[^"]+"; filename\*=UTF-8''/);
  assert.match(header, /%E5%AE%9E%E9%AA%8C1/);
});
