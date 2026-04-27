import type { ProjectSourceRecord } from "../../shared/src/domain.ts";
import type { DefenseFileRecord } from "../../../src/lib/project-workspace.ts";

export type SlideDeckRecord = {
  id: string;
  projectId: string;
  fileId: string;
  title: string;
  pageCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SlideRecord = {
  id: string;
  deckId: string;
  projectId: string;
  fileId: string;
  page: number;
  title: string;
  extractedText?: string;
  imagePath?: string;
  thumbnailPath?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export function buildPresentationSlideRecords({
  projectId,
  file,
  source,
  content,
  createdAt,
  synthetic = false,
}: {
  projectId: string;
  file: DefenseFileRecord;
  source: ProjectSourceRecord;
  content: string;
  createdAt: string;
  synthetic?: boolean;
}) {
  if (file.kind !== "presentation") {
    return {
      slideDeck: null,
      slides: [] as SlideRecord[],
    };
  }

  const sections = segmentSlides(content);
  const deckId = `deck-${file.id}`;
  const slideDeck: SlideDeckRecord = {
    id: deckId,
    projectId,
    fileId: file.id,
    title: `${file.name} 逐页结构`,
    pageCount: sections.length,
    metadata: {
      sourceId: source.id,
      sourcePath: source.sourcePath,
      synthetic,
    },
    createdAt,
  };

  const slides = sections.map((section, index) => ({
    id: `slide-${file.id}-${index + 1}`,
    deckId,
    projectId,
    fileId: file.id,
    page: index + 1,
    title: section.title,
    extractedText: section.body,
    metadata: {
      lineStart: section.lineStart,
      lineEnd: section.lineEnd,
      sourceId: source.id,
      sourcePath: source.sourcePath,
      synthetic,
    },
    createdAt,
  }));

  return {
    slideDeck,
    slides,
  };
}

function segmentSlides(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return fallbackSections();
  }

  const sections: Array<{
    title: string;
    body: string;
    lineStart: number;
    lineEnd: number;
  }> = [];
  let currentTitle = "项目概览";
  let currentLines: string[] = [];
  let lineStart = 1;

  lines.forEach((line, index) => {
    if (isSlideHeading(line)) {
      if (currentLines.length > 0) {
        sections.push({
          title: currentTitle,
          body: currentLines.join("\n"),
          lineStart,
          lineEnd: index,
        });
      }

      currentTitle = cleanHeading(line) || `Slide ${sections.length + 1}`;
      currentLines = [];
      lineStart = index + 1;
      return;
    }

    currentLines.push(line);
  });

  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      body: currentLines.join("\n"),
      lineStart,
      lineEnd: lines.length,
    });
  }

  if (sections.length === 0) {
    return chunkSections(lines);
  }

  return sections.slice(0, 12);
}

function isSlideHeading(line: string) {
  return /^#{1,6}\s+/u.test(line) || /^(slide\s*\d+|第\s*\d+\s*页)/iu.test(line);
}

function cleanHeading(line: string) {
  return line
    .replace(/^#{1,6}\s*/u, "")
    .replace(/^(slide\s*\d+[:：\-]?\s*)/iu, "")
    .replace(/^(第\s*\d+\s*页[:：\-]?\s*)/u, "")
    .trim();
}

function chunkSections(lines: string[]) {
  const sections: Array<{
    title: string;
    body: string;
    lineStart: number;
    lineEnd: number;
  }> = [];

  for (let index = 0; index < lines.length; index += 4) {
    const chunk = lines.slice(index, index + 4);
    sections.push({
      title: chunk[0]?.slice(0, 24) || `Slide ${sections.length + 1}`,
      body: chunk.join("\n"),
      lineStart: index + 1,
      lineEnd: index + chunk.length,
    });
  }

  return sections.slice(0, 8);
}

function fallbackSections() {
  return [
    {
      title: "项目概览",
      body: "介绍项目目标、场景和一句话价值。",
      lineStart: 1,
      lineEnd: 1,
    },
    {
      title: "系统架构",
      body: "解释模块拆分、数据流向和你的负责范围。",
      lineStart: 2,
      lineEnd: 2,
    },
    {
      title: "答辩重点",
      body: "准备高危追问、性能取舍和数据库设计的回答。",
      lineStart: 3,
      lineEnd: 3,
    },
  ];
}
