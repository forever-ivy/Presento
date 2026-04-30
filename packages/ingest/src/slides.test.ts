import assert from "node:assert/strict";
import test from "node:test";
import { buildPresentationSlideRecords } from "./slides.ts";

test("buildPresentationSlideRecords derives slides from markdown headings", () => {
  const result = buildPresentationSlideRecords({
    projectId: "project-1",
    file: {
      id: "file-1",
      name: "答辩稿.md",
      size: 512,
      kind: "presentation",
      status: "已上传",
      source: "PPT 同屏答辩",
      addedAt: "2026-04-27T00:00:00.000Z",
    },
    source: {
      id: "source-1",
      projectId: "project-1",
      fileId: "file-1",
      kind: "presentation",
      title: "答辩来源",
      summary: "答辩摘要",
      metadata: {},
      createdAt: "2026-04-27T00:00:00.000Z",
    },
    content: [
      "# Slide 1 项目概览",
      "介绍项目背景",
      "# Slide 2 系统架构",
      "解释模块拆分",
    ].join("\n"),
    createdAt: "2026-04-27T00:00:00.000Z",
  });

  assert.ok(result.slideDeck);
  assert.equal(result.slideDeck?.pageCount, 2);
  assert.equal(result.slides.length, 2);
  assert.equal(result.slides[0]?.title, "项目概览");
  assert.match(result.slides[1]?.extractedText ?? "", /模块拆分/);
});

test("buildPresentationSlideRecords prefers parser-provided slides when available", () => {
  const result = buildPresentationSlideRecords({
    projectId: "project-1",
    file: {
      id: "file-1",
      name: "答辩稿.pptx",
      size: 512,
      kind: "presentation",
      status: "已上传",
      source: "PPT 同屏答辩",
      addedAt: "2026-04-27T00:00:00.000Z",
    },
    source: {
      id: "source-1",
      projectId: "project-1",
      fileId: "file-1",
      kind: "presentation",
      title: "答辩来源",
      summary: "答辩摘要",
      metadata: {},
      createdAt: "2026-04-27T00:00:00.000Z",
    },
    content: "fallback content",
    parsedSlides: [
      {
        page: 1,
        title: "项目背景",
        text: "介绍项目背景",
        metadata: {
          imagePath: ".data/slides/1.png",
          thumbnailPath: ".data/slides/1-thumb.png",
        },
      },
      {
        page: 2,
        title: "系统架构",
        text: "解释模块拆分",
        metadata: {},
      },
    ],
    createdAt: "2026-04-27T00:00:00.000Z",
  });

  assert.ok(result.slideDeck);
  assert.equal(result.slideDeck?.pageCount, 2);
  assert.equal(result.slides[0]?.title, "项目背景");
  assert.equal(result.slides[0]?.imagePath, ".data/slides/1.png");
  assert.equal(result.slides[0]?.thumbnailPath, ".data/slides/1-thumb.png");
  assert.equal(result.slides[1]?.page, 2);
});
