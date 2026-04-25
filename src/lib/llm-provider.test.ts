import assert from "node:assert/strict";
import test from "node:test";
import {
  createConfiguredLlmProvider,
  createOpenAICompatibleProvider,
  extractJsonObject,
} from "./llm-provider.ts";

test("extracts json from raw and fenced model output", () => {
  assert.deepEqual(extractJsonObject<{ ok: boolean }>('{"ok":true}'), { ok: true });
  assert.deepEqual(
    extractJsonObject<{ ok: boolean }>('```json\n{"ok":true}\n```'),
    { ok: true },
  );
});

test("returns null configured provider when api key is missing", () => {
  assert.equal(createConfiguredLlmProvider({}), null);
});

test("calls an OpenAI-compatible chat completions endpoint and parses json", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const provider = createOpenAICompatibleProvider({
    apiKey: "sk-test",
    baseUrl: "https://llm.example/v1",
    model: "deepseek-chat",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"message":"ok","score":88}',
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const result = await provider.generateJson<{ message: string; score: number }>({
    schemaName: "DefenseTurn",
    messages: [{ role: "user", content: "生成 JSON" }],
  });

  assert.deepEqual(result, { message: "ok", score: 88 });
  assert.equal(requests[0].url, "https://llm.example/v1/chat/completions");
  assert.equal(
    (requests[0].init.headers as Record<string, string>).Authorization,
    "Bearer sk-test",
  );
  assert.match(String(requests[0].init.body), /deepseek-chat/);
  assert.match(String(requests[0].init.body), /json_object/);
});
