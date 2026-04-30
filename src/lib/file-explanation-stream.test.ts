import assert from "node:assert/strict";
import test from "node:test";
import { readUIMessageStream, type UIMessage } from "ai";
import type { NotebookCitation } from "@shared/domain";
import {
  createFileExplanationUIMessageStream,
  type FileExplanationStreamMessage,
} from "./file-explanation-stream.ts";

test("converts notebook explanation events into an AI SDK UI message stream", async () => {
  const persisted: Array<{ answer: string; citations: NotebookCitation[] }> = [];
  const stream = createFileExplanationUIMessageStream({
    sessionId: "session-1",
    turnId: "turn-1",
    mode: "quick",
    events: (async function* () {
      yield { type: "started", mode: "quick" } as const;
      yield { type: "retrieval", retrievalCount: 2, retrievalMode: "quick" } as const;
      yield { type: "delta", delta: "第一段" } as const;
      yield {
        type: "citations",
        citations: [{ fileName: "README.md", lineStart: 1, lineEnd: 2 }],
      } as const;
      yield {
        type: "completed",
        response: {
          summary: "总结",
          outline: ["要点"],
          answer: "第一段",
          citations: [{ fileName: "README.md", lineStart: 1, lineEnd: 2 }],
          grounded: true,
          insufficientEvidence: false,
          metadata: {
            engine: "sidecar-llm",
            retrievalCount: 2,
          },
        },
      } as const;
    })(),
    onComplete: async (result) => {
      persisted.push({ answer: result.answer ?? "", citations: result.citations });
    },
  });

  const states: FileExplanationStreamMessage[] = [];
  for await (const state of readUIMessageStream<FileExplanationStreamMessage>({ stream })) {
    states.push(state);
  }

  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.answer, "第一段");
  const finalState = states.at(-1);
  assert.ok(finalState);
  assert.equal(finalState.metadata?.sessionId, "session-1");
  assert.equal(finalState.metadata?.engine, "sidecar-llm");
  assert.equal(finalState.metadata?.grounded, true);
  assert.equal(finalState.metadata?.fallbackUsed, false);
  assert.equal(finalState.parts.filter((part) => part.type === "text").map((part) => part.text).join(""), "第一段");
  assert.deepEqual(
    finalState.parts.filter((part) => part.type === "data-citations").map((part) => part.data),
    [{ citations: [{ fileName: "README.md", lineStart: 1, lineEnd: 2 }] }],
  );
});

test("emits fallback metadata when notebook explanation stream falls back locally", async () => {
  const stream = createFileExplanationUIMessageStream({
    sessionId: "session-2",
    turnId: "turn-2",
    mode: "mastery",
    events: (async function* () {
      yield { type: "fallback", engine: "deterministic-fallback", reason: "llm_unavailable" } as const;
      yield { type: "delta", delta: "本地兜底答案" } as const;
      yield {
        type: "completed",
        response: {
          summary: "本地总结",
          outline: ["要点"],
          answer: "本地兜底答案",
          citations: [],
          grounded: true,
          insufficientEvidence: false,
          metadata: {
            engine: "deterministic-fallback",
            retrievalCount: 1,
            fallbackUsed: true,
          },
        },
      } as const;
    })(),
    onComplete: async () => {},
  });

  const states: Array<UIMessage> = [];
  for await (const state of readUIMessageStream({ stream })) {
    states.push(state);
  }

  const finalState = states.at(-1);
  assert.ok(finalState);
  const fallbackParts = finalState.parts.filter((part) => part.type === "data-fallback");
  assert.deepEqual(fallbackParts.map((part) => ("data" in part ? part.data : undefined)), [
    {
      engine: "deterministic-fallback",
      reason: "llm_unavailable",
    },
  ]);
  const metadata = finalState.metadata as { fallbackUsed?: boolean } | undefined;
  assert.equal(metadata?.fallbackUsed, true);
});
