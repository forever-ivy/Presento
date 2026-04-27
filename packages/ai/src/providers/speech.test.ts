import assert from "node:assert/strict";
import test from "node:test";
import {
  createConfiguredSpeechProvider,
  createMiniMaxSpeechProvider,
} from "./speech.ts";

test("returns null speech provider when MiniMax credentials are missing", () => {
  assert.equal(createConfiguredSpeechProvider({}), null);
});

test("synthesizes a data url from MiniMax-like base64 audio output", async () => {
  const provider = createMiniMaxSpeechProvider({
    apiKey: "tts-key",
    groupId: "group-id",
    voiceId: "male-qn-qingse",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: {
            audio: Buffer.from("tts-ok").toString("base64"),
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
  });

  const result = await provider.synthesize({
    text: "你好，继续回答当前页。",
  });

  assert.match(result.audioUrl ?? "", /^data:audio\/mpeg;base64,/);
  assert.equal(result.traceId, undefined);
});
