import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildStoredFileRecord,
  isIgnoredUploadPath,
  normalizeUploadPath,
  sanitizeFileName,
  uploadDateFolder,
} from "./upload-storage.ts";

test("sanitizes uploaded file names for local storage", () => {
  assert.equal(sanitizeFileName("../答辩 PPT final.pdf"), "答辩-PPT-final.pdf");
  assert.equal(sanitizeFileName("backend   source.zip"), "backend-source.zip");
  assert.equal(sanitizeFileName(""), "untitled");
});

test("builds stable local upload metadata without exposing absolute paths", () => {
  const uploadedAt = "2026-04-25T05:00:00.000Z";
  const record = buildStoredFileRecord(
    {
      name: "答辩 PPT final.pdf",
      size: 1024,
      type: "application/pdf",
    },
    {
      nonce: "abc123",
      uploadedAt,
    },
  );

  assert.equal(record.name, "答辩 PPT final.pdf");
  assert.equal(record.storedName, "abc123-答辩-PPT-final.pdf");
  assert.equal(record.storagePath, ".data/uploads/2026-04-25/abc123-答辩-PPT-final.pdf");
  assert.equal(record.uploadedAt, uploadedAt);
  assert.equal(record.uploadStatus, "stored");
  assert.equal(uploadDateFolder(uploadedAt), "2026-04-25");
});

test("normalizes folder upload paths while removing unsafe segments", () => {
  assert.equal(
    normalizeUploadPath("../backend\\src//routes/orders.ts", "orders.ts"),
    "backend/src/routes/orders.ts",
  );
  assert.equal(normalizeUploadPath("", "orders.ts"), "orders.ts");
  assert.equal(normalizeUploadPath("../.env", ".env"), ".env");
});

test("ignores dependency folders and local secrets from folder uploads", () => {
  assert.equal(isIgnoredUploadPath("backend/node_modules/zod/index.js"), true);
  assert.equal(isIgnoredUploadPath("backend/.env.local"), true);
  assert.equal(isIgnoredUploadPath("frontend/.next/server/app.js"), true);
  assert.equal(isIgnoredUploadPath("backend/src/routes/orders.ts"), false);
});

test("builds object storage metadata when object storage is enabled", () => {
  const uploadedAt = "2026-04-25T05:00:00.000Z";
  const record = buildStoredFileRecord(
    {
      name: "答辩 PPT final.pdf",
      size: 1024,
      type: "application/pdf",
    },
    {
      nonce: "abc123",
      uploadedAt,
      storageMode: "object",
      bucket: "defense-assets",
    } as never,
  );

  const objectRecord = record as unknown as Record<string, unknown>;
  assert.equal(objectRecord.storageKey, "2026-04-25/abc123-答辩-PPT-final.pdf");
  assert.equal(record.storagePath, "s3://defense-assets/2026-04-25/abc123-答辩-PPT-final.pdf");
});
