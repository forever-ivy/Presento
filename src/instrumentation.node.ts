import { ensureLangfuseNodeSdkStarted } from "@ai/langfuse";

export async function registerNodeInstrumentation() {
  await ensureLangfuseNodeSdkStarted("presento-next");
}
