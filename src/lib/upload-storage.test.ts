import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildStoredFileRecord,
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
