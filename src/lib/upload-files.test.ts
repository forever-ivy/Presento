import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getUploadDisplayName,
  getUploadableFiles,
  withUploadPath,
} from "./upload-files.ts";

test("uses browser folder-relative paths when preparing uploads", () => {
  const file = {
    name: "orders.ts",
    size: 128,
    webkitRelativePath: "backend/src/routes/orders.ts",
  } as File & { webkitRelativePath: string };

  assert.equal(getUploadDisplayName(file), "backend/src/routes/orders.ts");
});

test("filters ignored files from imported folders before upload", () => {
  const files = [
    {
      name: "orders.ts",
      size: 128,
      webkitRelativePath: "backend/src/routes/orders.ts",
    },
    {
      name: "index.js",
      size: 256,
      webkitRelativePath: "backend/node_modules/zod/index.js",
    },
  ] as Array<File & { webkitRelativePath: string }>;

  assert.deepEqual(
    getUploadableFiles(files).map((file) => getUploadDisplayName(file)),
    ["backend/src/routes/orders.ts"],
  );
});

test("skips code archives inside imported folders without dropping the folder batch", () => {
  const files = [
    {
      name: "orders.ts",
      size: 128,
      webkitRelativePath: "backend/src/routes/orders.ts",
    },
    {
      name: "backend.zip",
      size: 256,
      webkitRelativePath: "backend/backend.zip",
    },
  ] as Array<File & { webkitRelativePath: string }>;

  assert.deepEqual(
    getUploadableFiles(files).map((file) => getUploadDisplayName(file)),
    ["backend/src/routes/orders.ts"],
  );
});

test("keeps explicit paths collected from dropped folders", () => {
  const file = new File(["export const ok = true;"], "orders.ts", {
    type: "text/typescript",
  });

  const uploadFile = withUploadPath(file, "backend/src/routes/orders.ts");

  assert.equal(getUploadDisplayName(uploadFile), "backend/src/routes/orders.ts");
});
