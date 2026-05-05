import WebSocket from "ws";
import { loadPresentoEnv } from "../../../workers/shared/src/load-env.ts";
import { ensureLangfuseNodeSdkStarted } from "@ai/langfuse";
import { createRealtimeSessionRepository } from "@db/repositories/realtime-sessions";
import { finalizeRealtimeTurnAndAnalyze, hashRealtimeSessionToken } from "@/lib/realtime-training";
import { createDefenseRealtimeServer } from "./server.ts";

loadPresentoEnv();

const port = Number(process.env.DEFENSE_REALTIME_PORT ?? 3021);
const providerUrl = process.env.GLM_REALTIME_WS_URL ?? "wss://open.bigmodel.cn/api/paas/v4/realtime";
const apiKey = process.env.GLM_API_KEY ?? "";

async function main() {
  await ensureLangfuseNodeSdkStarted("presento-defense-realtime");
  const server = await createDefenseRealtimeServer({
    port,
    providerFactory: () => new WebSocket(providerUrl, {
      headers: apiKey
        ? {
          Authorization: `Bearer ${apiKey}`,
        }
        : undefined,
    }),
    realtimeRepository: createRealtimeSessionRepository(),
    hashToken: hashRealtimeSessionToken,
    finalizeTurn: async (turnDraft) => {
      const result = await finalizeRealtimeTurnAndAnalyze(turnDraft);
      return {
        ...result.turn,
        sessionPatch: result.sessionPatch,
        skillInvocation: result.skillInvocation,
        retrievedSources: result.retrievedSources,
      };
    },
  });

  process.stdout.write(`[defense-realtime] listening on ${port}\n`);

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  process.stderr.write(`[defense-realtime] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
