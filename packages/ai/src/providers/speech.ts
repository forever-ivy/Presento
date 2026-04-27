import type { SpeechProvider } from "@shared/domain";

type SpeechEnv = Record<string, string | undefined>;

type MiniMaxSpeechProviderOptions = {
  apiKey: string;
  groupId: string;
  voiceId?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export function createConfiguredSpeechProvider(env: SpeechEnv = process.env) {
  const apiKey = env.MINIMAX_API_KEY?.trim();
  const groupId = env.MINIMAX_GROUP_ID?.trim();

  if (!apiKey || !groupId) return null;

  return createMiniMaxSpeechProvider({
    apiKey,
    groupId,
    voiceId: env.MINIMAX_TTS_VOICE_ID?.trim(),
    model: env.MINIMAX_TTS_MODEL?.trim(),
  });
}

export function createMiniMaxSpeechProvider({
  apiKey,
  groupId,
  voiceId = "male-qn-qingse",
  model = "speech-02-turbo",
  baseUrl = "https://api.minimax.chat/v1",
  fetchImpl = fetch,
}: MiniMaxSpeechProviderOptions): SpeechProvider {
  return {
    async synthesize({ text, voiceId: overrideVoiceId, speed }) {
      const response = await fetchImpl(`${baseUrl}/t2a_v2?GroupId=${encodeURIComponent(groupId)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          text,
          voice_setting: {
            voice_id: overrideVoiceId ?? voiceId,
            speed: speed ?? 1,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`MiniMax TTS failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as {
        trace_id?: string;
        data?: {
          audio?: string;
          audio_base64?: string;
          audio_url?: string;
        };
      };

      const audioUrl = payload.data?.audio_url;
      if (audioUrl) {
        return { audioUrl, traceId: payload.trace_id };
      }

      const audioBase64 = payload.data?.audio ?? payload.data?.audio_base64;
      if (!audioBase64) {
        throw new Error("MiniMax TTS response did not include audio.");
      }

      return {
        audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
        traceId: payload.trace_id,
      };
    },
  };
}
