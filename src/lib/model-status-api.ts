import type { ModelRuntimeStatus } from "./model-config";

export async function fetchModelStatus() {
  const response = await fetch("/api/model-status", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("模型状态读取失败");
  }

  return (await response.json()) as {
    modelStatus: ModelRuntimeStatus;
  };
}
