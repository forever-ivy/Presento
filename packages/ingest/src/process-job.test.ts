import assert from "node:assert/strict";
import test from "node:test";
import { createLocalParsedFileResult } from "./process-job.ts";

test("createLocalParsedFileResult parses source code without a Notebook RAG sidecar", () => {
  const parsed = createLocalParsedFileResult({
    id: "file-main",
    name: "src/main.ts",
    size: 32,
    type: "text/typescript",
    kind: "code",
    status: "pending",
    source: "代码解释 Skill",
    addedAt: "2026-05-01T00:00:00.000Z",
    storagePath: ".data/uploads/main.ts",
  }, Buffer.from("export const ok = true;\nconsole.log(ok);\n", "utf8"));

  assert.equal(parsed.source.title, "src/main.ts");
  assert.equal(parsed.source.fileKind, "code");
  assert.equal(parsed.source.metadata?.parser, "local-code-fallback");
  assert.equal(parsed.chunks.length, 1);
  assert.match(parsed.chunks[0].content, /export const ok/u);
  assert.equal(parsed.chunks[0].metadata?.codePath, "src/main.ts");
  assert.equal(parsed.codeTree?.[0]?.path, "src/main.ts");
  assert.equal(parsed.preview.text, "export const ok = true;\nconsole.log(ok);");
});
