export type ModelRuntimeState = "configured" | "unconfigured";

export type ModelRuntimeStatus = {
  state: ModelRuntimeState;
  label: string;
  message: string;
  model?: string;
  baseUrl?: string;
};

type ModelEnv = Record<string, string | undefined>;

export function getModelRuntimeStatus(env: ModelEnv = process.env): ModelRuntimeStatus {
  const apiKey = env.LLM_API_KEY?.trim();

  if (!apiKey) {
    return {
      state: "unconfigured",
      label: "模型未配置",
      message: "未检测到 LLM_API_KEY，当前 Skills 使用本地规则兜底，不会调用真实大模型。",
    };
  }

  return {
    state: "configured",
    label: "模型已配置",
    message: "已检测到模型 API Key，后续可切换到真实 LLM/Agent Graph 执行。",
    model: env.LLM_MODEL?.trim() || "未指定模型",
    baseUrl: env.LLM_BASE_URL?.trim() || "OpenAI-compatible default",
  };
}
