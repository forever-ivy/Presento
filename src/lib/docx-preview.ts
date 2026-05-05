import { inflateRawSync } from "node:zlib";

export type DocxPreviewRun = {
  bold?: boolean;
  italic?: boolean;
  text: string;
  underline?: boolean;
};

export type DocxPreviewParagraph = {
  alignment?: "center" | "end" | "justify" | "start";
  kind: "paragraph";
  runs: DocxPreviewRun[];
  style?: "heading1" | "heading2" | "heading3" | "title";
  text: string;
};

export type DocxPreviewTable = {
  kind: "table";
  rows: string[][];
};

export type DocxPreviewBlock = DocxPreviewParagraph | DocxPreviewTable;

export type DocxPreviewDocument = {
  blocks: DocxPreviewBlock[];
  fileName: string;
  title: string;
};

type DocxStyleMap = Map<string, string>;

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;

export function buildDocxPreview(buffer: Uint8Array, fileName = "document.docx"): DocxPreviewDocument {
  const entries = readZipEntries(buffer);
  const documentXml = entries.get("word/document.xml")?.toString("utf8");
  if (!documentXml) throw new Error("DOCX document.xml is missing.");

  const styles = parseStyleMap(entries.get("word/styles.xml")?.toString("utf8") ?? "");
  const blocks = parseDocxBlocks(documentXml, styles);
  const title = blocks.find((block): block is DocxPreviewParagraph => block.kind === "paragraph" && Boolean(block.text))?.text
    ?? fileName;

  return {
    blocks,
    fileName,
    title,
  };
}

function readZipEntries(input: Uint8Array) {
  const buffer = Buffer.from(input);
  const end = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(end + 10);
  const centralDirectorySize = buffer.readUInt32LE(end + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();
  let offset = centralDirectoryOffset;
  const directoryEnd = centralDirectoryOffset + centralDirectorySize;

  for (let index = 0; index < totalEntries && offset < directoryEnd; index += 1) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Invalid DOCX central directory.");
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const entryName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);
    const localSignature = buffer.readUInt32LE(localHeaderOffset);
    if (localSignature !== ZIP_LOCAL_FILE_SIGNATURE) {
      throw new Error(`Invalid DOCX local file header for ${entryName}.`);
    }

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) {
      entries.set(entryName, Buffer.from(compressed));
    } else if (method === 8) {
      entries.set(entryName, inflateRawSync(compressed));
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  throw new Error("Invalid DOCX zip container.");
}

function parseStyleMap(stylesXml: string): DocxStyleMap {
  const styles = new Map<string, string>();
  for (const match of stylesXml.matchAll(/<w:style\b([\s\S]*?)<\/w:style>/gu)) {
    const xml = match[0] ?? "";
    const attrs = match[1] ?? "";
    const styleId = attributeValue(attrs, "w:styleId");
    const styleName = attributeValue(xml, "w:val");
    if (styleId && styleName) styles.set(styleId, decodeXmlText(styleName));
  }
  return styles;
}

function parseDocxBlocks(documentXml: string, styles: DocxStyleMap): DocxPreviewBlock[] {
  const body = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/u.exec(documentXml)?.[1] ?? documentXml;
  const blocks: DocxPreviewBlock[] = [];

  for (const match of body.matchAll(/<w:p\b[\s\S]*?<\/w:p>|<w:tbl\b[\s\S]*?<\/w:tbl>/gu)) {
    const xml = match[0] ?? "";
    if (xml.startsWith("<w:tbl")) {
      const table = parseTable(xml);
      if (table.rows.length) blocks.push(table);
      continue;
    }

    const paragraph = parseParagraph(xml, styles);
    if (paragraph) blocks.push(paragraph);
  }

  return blocks;
}

function parseParagraph(xml: string, styles: DocxStyleMap): DocxPreviewParagraph | null {
  const runs = parseRuns(xml);
  const text = runs.map((run) => run.text).join("").replace(/\u00a0/g, " ").trim();
  if (!text) return null;

  const styleId = /<w:pStyle\b[^>]*w:val="([^"]+)"/u.exec(xml)?.[1];
  const styleName = styleId ? (styles.get(styleId) ?? styleId) : undefined;
  const alignment = normalizeAlignment(/<w:jc\b[^>]*w:val="([^"]+)"/u.exec(xml)?.[1]);

  return {
    alignment,
    kind: "paragraph",
    runs: runs.length ? runs : [{ text }],
    style: normalizeParagraphStyle(styleName, text),
    text,
  };
}

function parseRuns(xml: string): DocxPreviewRun[] {
  const runs: DocxPreviewRun[] = [];
  const runMatches = [...xml.matchAll(/<w:r\b[\s\S]*?<\/w:r>/gu)];

  if (!runMatches.length) {
    return parseRunTokens(xml).map((text) => ({ text }));
  }

  for (const match of runMatches) {
    const runXml = match[0] ?? "";
    const text = parseRunTokens(runXml).join("");
    if (!text) continue;
    runs.push({
      bold: /<w:b\b/u.test(runXml),
      italic: /<w:i\b/u.test(runXml),
      text,
      underline: /<w:u\b/u.test(runXml),
    });
  }

  return runs;
}

function parseRunTokens(xml: string) {
  const tokens: string[] = [];
  for (const match of xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^/]*\/>|<w:br\b[^/]*\/>/gu)) {
    if (match[1] !== undefined) {
      tokens.push(decodeXmlText(match[1]));
    } else if ((match[0] ?? "").startsWith("<w:tab")) {
      tokens.push("    ");
    } else {
      tokens.push("\n");
    }
  }
  return tokens;
}

function parseTable(xml: string): DocxPreviewTable {
  const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/gu)]
    .map((rowMatch) => {
      const rowXml = rowMatch[0] ?? "";
      return [...rowXml.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/gu)]
        .map((cellMatch) => {
          const cellXml = cellMatch[0] ?? "";
          const paragraphs = [...cellXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gu)]
            .map((paragraphMatch) => parseParagraph(paragraphMatch[0] ?? "", new Map())?.text)
            .filter((text): text is string => Boolean(text));
          return paragraphs.join("\n");
        });
    })
    .filter((row) => row.some((cell) => cell.trim()));

  return {
    kind: "table",
    rows,
  };
}

function normalizeParagraphStyle(styleName: string | undefined, text: string): DocxPreviewParagraph["style"] {
  const normalized = (styleName ?? "").toLowerCase();
  if (normalized.includes("title") || normalized.includes("标题")) return "title";
  if (normalized.includes("heading 1") || normalized.includes("heading1") || normalized.includes("标题 1")) return "heading1";
  if (normalized.includes("heading 2") || normalized.includes("heading2") || normalized.includes("标题 2")) return "heading2";
  if (normalized.includes("heading 3") || normalized.includes("heading3") || normalized.includes("标题 3")) return "heading3";
  if (text.length <= 32 && /^[一二三四五六七八九十\d]+[、.．]/u.test(text)) return "heading2";
  return undefined;
}

function normalizeAlignment(value: string | undefined): DocxPreviewParagraph["alignment"] {
  if (value === "center") return "center";
  if (value === "right" || value === "end") return "end";
  if (value === "both" || value === "distribute") return "justify";
  return undefined;
}

function attributeValue(xml: string, attributeName: string) {
  return new RegExp(`${attributeName}="([^"]+)"`, "u").exec(xml)?.[1];
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
