import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUploadWorkspaceCopy,
  formatUploadTrayStatus,
  mergeUploadedFiles,
  mergeUploadTrayItems,
  uploadWorkspaceFormats,
  type UploadTrayItem,
} from "./upload-workspace.ts";

test("lists the planned upload formats in a stable order", () => {
  assert.deepEqual(
    uploadWorkspaceFormats.map((item) => item.label),
    ["PDF", "PPTX", "DOCX", "MD", "TXT", "CSV", "XLSX", "SQL", "ZIP"],
  );
  assert.deepEqual(uploadWorkspaceFormats[0]?.extensions, [".pdf"]);
  assert.deepEqual(uploadWorkspaceFormats[1]?.extensions, [".ppt", ".pptx"]);
});

test("formats tray status labels for the upload workspace", () => {
  assert.equal(formatUploadTrayStatus("queued"), "等待上传");
  assert.equal(formatUploadTrayStatus("uploading"), "上传中");
  assert.equal(formatUploadTrayStatus("completed"), "已完成");
  assert.equal(formatUploadTrayStatus("failed"), "失败");
});

test("merges persisted uploads into the tray without duplicating session items", () => {
  const currentItems: UploadTrayItem[] = [
    {
      id: "uppy-file-1",
      name: "答辩终稿.pdf",
      size: 2048,
      status: "completed",
      persistedKey: ".data/uploads/2026-04-28/slides.pdf",
    },
    {
      id: "uppy-file-2",
      name: "orders.sql",
      size: 512,
      status: "failed",
      error: "网络波动",
    },
  ];

  const mergedItems = mergeUploadTrayItems(currentItems, [
    {
      name: "答辩终稿.pdf",
      size: 2048,
      storagePath: ".data/uploads/2026-04-28/slides.pdf",
      uploadedAt: "2026-04-28T08:00:00.000Z",
      uploadStatus: "stored",
    },
  ]);

  assert.equal(mergedItems.length, 2);
  assert.equal(
    mergedItems.filter((item) => item.name === "答辩终稿.pdf").length,
    1,
  );
  assert.equal(
    mergedItems.find((item) => item.name === "答辩终稿.pdf")?.id,
    "persisted:.data/uploads/2026-04-28/slides.pdf",
  );
  assert.equal(
    mergedItems.find((item) => item.name === "orders.sql")?.status,
    "failed",
  );
});

test("returns variant-specific copy for create and workspace surfaces", () => {
  assert.match(buildUploadWorkspaceCopy("create").title, /创建/);
  assert.match(buildUploadWorkspaceCopy("workspace").title, /继续上传/);
  assert.match(buildUploadWorkspaceCopy("workspace").emptyTrayLabel, /追加/);
});

test("deduplicates uploaded files by persisted identity", () => {
  const mergedFiles = mergeUploadedFiles(
    [
      {
        name: "README.md",
        size: 256,
        storagePath: ".data/uploads/readme.md",
      },
    ],
    [
      {
        name: "README.md",
        size: 256,
        storagePath: ".data/uploads/readme.md",
      },
      {
        name: "slides.pdf",
        size: 1024,
        storagePath: ".data/uploads/slides.pdf",
      },
    ],
  );

  assert.equal(mergedFiles.length, 2);
  assert.equal(mergedFiles[1]?.name, "slides.pdf");
});
