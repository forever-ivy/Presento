import assert from "node:assert/strict";
import test from "node:test";

import { buildDocxPreview } from "./docx-preview.ts";

test("buildDocxPreview extracts DOCX paragraphs and tables in document order", () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p>
          <w:pPr><w:pStyle w:val="Title"/><w:jc w:val="center"/></w:pPr>
          <w:r><w:rPr><w:b/></w:rPr><w:t>MiniSheet 项目报告</w:t></w:r>
        </w:p>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>姓名</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>刘轩</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>班级</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>24级软件工程</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:p><w:r><w:t>一、实验目的</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>
    </w:styles>`;
  const preview = buildDocxPreview(createStoredZip({
    "word/document.xml": documentXml,
    "word/styles.xml": stylesXml,
  }), "report.docx");

  assert.equal(preview.title, "MiniSheet 项目报告");
  assert.equal(preview.blocks[0]?.kind, "paragraph");
  assert.equal(preview.blocks[0]?.kind === "paragraph" ? preview.blocks[0].style : undefined, "title");
  assert.equal(preview.blocks[0]?.kind === "paragraph" ? preview.blocks[0].alignment : undefined, "center");
  assert.equal(preview.blocks[1]?.kind, "table");
  assert.deepEqual(preview.blocks[1]?.kind === "table" ? preview.blocks[1].rows : [], [
    ["姓名", "刘轩"],
    ["班级", "24级软件工程"],
  ]);
  assert.equal(preview.blocks[2]?.kind === "paragraph" ? preview.blocks[2].style : undefined, "heading2");
});

function createStoredZip(entries: Record<string, string>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const [name, value] of Object.entries(entries)) {
    const fileName = Buffer.from(name);
    const content = Buffer.from(value);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, fileName, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt32LE(0, 34);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, fileName);

    localOffset += localHeader.length + fileName.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}
