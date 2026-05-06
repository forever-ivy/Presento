import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSelectedContexts,
  selectedContextsToPrompt,
} from "./file-explanation-context.ts";
import type { FileExplanationStreamMessage } from "./file-explanation-stream";
import {
  getFileExplanationBusyLabel,
  getInitialFileExplanationQuestion,
  getFileExplanationMessageCitations,
  getFileExplanationMessageText,
  getFileExplanationStarterPrompts,
} from "./file-explanation-chat-ui.ts";

test("extracts flattened text content from a streamed explanation message", () => {
  const message = {
    id: "assistant-1",
    parts: [
      { type: "text", text: "第一段" },
      { type: "data-status", data: { status: "started" } },
      { type: "text", text: " 第二段" },
    ],
    role: "assistant",
  } as FileExplanationStreamMessage;

  assert.equal(getFileExplanationMessageText(message), "第一段 第二段");
});

test("deduplicates citations carried on AI SDK data parts", () => {
  const message = {
    id: "assistant-2",
    parts: [
      {
        type: "data-citations",
        data: {
          citations: [
            { fileName: "README.md", lineStart: 1, lineEnd: 2 },
            { fileName: "README.md", lineStart: 1, lineEnd: 2 },
          ],
        },
      },
    ],
    role: "assistant",
  } as FileExplanationStreamMessage;

  assert.deepEqual(getFileExplanationMessageCitations(message), [
    { fileName: "README.md", lineStart: 1, lineEnd: 2 },
  ]);
});

test("maps streaming statuses to user-facing copy", () => {
  assert.equal(getFileExplanationBusyLabel("loading-cache"), "正在读取已有讲解...");
  assert.equal(getFileExplanationBusyLabel("submitted"), "正在组织回答...");
  assert.equal(getFileExplanationBusyLabel("streaming"), "正在结合当前资料生成回答...");
  assert.equal(getFileExplanationBusyLabel("ready"), null);
});

test("returns mode-aware starter prompts", () => {
  assert.equal(getFileExplanationStarterPrompts("quick", "系统架构").length, 3);
  assert.match(getFileExplanationStarterPrompts("mastery", "系统架构")[0] ?? "", /系统架构/);
});

test("returns the initial visible question for file explanations", () => {
  assert.equal(
    getInitialFileExplanationQuestion({
      focusNodeTitle: "权限模型",
      nodeTitle: "auth.ts",
    }),
    "这份资料如何支撑「权限模型」这个答辩讲点？",
  );
  assert.equal(
    getInitialFileExplanationQuestion({ nodeTitle: "auth.ts" }),
    "请讲解当前资料《auth.ts》，并指出答辩需要掌握的重点。",
  );
});

test("normalizes selected file explanation contexts for prompts", () => {
  const contexts = normalizeSelectedContexts([
    { id: " a ", text: " 第一段\n 第二段 ", fileName: " README.md " },
    { id: "empty", text: "   " },
    { id: "b", text: "第三段" },
    { id: "c", text: "第四段" },
    { id: "d", text: "第五段" },
  ]);

  assert.equal(contexts.length, 3);
  assert.deepEqual(contexts[0], { id: "a", text: "第一段 第二段", fileName: "README.md" });
  assert.match(selectedContextsToPrompt(contexts), /选中上下文 1（README\.md）：第一段 第二段/u);
});
