export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmProvider = {
  generateJson<T>(params: {
    schemaName: string;
    messages: LlmMessage[];
  }): Promise<T>;
};

type OpenAICompatibleProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

type LlmEnv = Record<string, string | undefined>;

export function createConfiguredLlmProvider(env: LlmEnv = process.env) {
  const apiKey = env.LLM_API_KEY?.trim();
  if (!apiKey) return null;

  return createOpenAICompatibleProvider({
    apiKey,
    baseUrl: env.LLM_BASE_URL,
    model: env.LLM_MODEL,
  });
}

export function createOpenAICompatibleProvider({
  apiKey,
  baseUrl = "https://api.openai.com/v1",
  model = "gpt-4.1-mini",
  fetchImpl = fetch,
}: OpenAICompatibleProviderOptions): LlmProvider {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");

  return {
    async generateJson<T>({
      schemaName,
      messages,
    }: {
      schemaName: string;
      messages: LlmMessage[];
    }) {
      const response = await fetchImpl(`${normalizedBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: {
            type: "json_object",
          },
          metadata: {
            schemaName,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("LLM response did not include message content.");
      }

      return extractJsonObject<T>(content);
    },
  };
}

export function extractJsonObject<T>(content: string): T {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/u);
  const jsonText = fenced?.[1] ?? trimmed;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    const firstBrace = jsonText.indexOf("{");
    const lastBrace = jsonText.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(jsonText.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error("LLM response is not valid JSON.");
  }
}
