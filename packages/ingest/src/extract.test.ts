import assert from "node:assert/strict";
import test from "node:test";
import { extractIngestContent } from "./extract.ts";

test("extractIngestContent keeps utf8 text files as text", () => {
  const result = extractIngestContent(
    {
      id: "file-1",
      name: "README.md",
      size: 32,
      kind: "document",
      status: "已上传，待入库",
      source: "项目速记 Skill",
      addedAt: "2026-04-27T00:00:00.000Z",
    },
    Buffer.from("# 项目说明\n系统负责订单处理\n", "utf8"),
  );

  assert.equal(result.synthetic, false);
  assert.equal(result.contentType, "text");
  assert.match(result.content, /项目说明/);
});

test("extractIngestContent falls back for binary presentation files", () => {
  const result = extractIngestContent(
    {
      id: "file-2",
      name: "答辩终稿.pptx",
      size: 4096,
      kind: "presentation",
      status: "已上传，待生成逐页预览",
      source: "PPT 同屏答辩",
      addedAt: "2026-04-27T00:00:00.000Z",
    },
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x08, 0x00]),
  );

  assert.equal(result.synthetic, true);
  assert.equal(result.contentType, "binary-fallback");
  assert.match(result.content, /Slide 1/);
  assert.match(result.content, /系统架构/);
});
