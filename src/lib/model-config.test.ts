import assert from "node:assert/strict";
import test from "node:test";
import { getModelRuntimeStatus } from "./model-config.ts";

test("reports unconfigured when no model api key is present", () => {
  const status = getModelRuntimeStatus({});

  assert.equal(status.state, "unconfigured");
  assert.equal(status.label, "模型未配置");
  assert.match(status.message, /LLM_API_KEY/);
});

test("reports configured when model api key is present", () => {
  const status = getModelRuntimeStatus({
    LLM_API_KEY: "sk-test",
    LLM_MODEL: "deepseek-chat",
    LLM_BASE_URL: "https://api.deepseek.com/v1",
  });

  assert.equal(status.state, "configured");
  assert.equal(status.label, "模型已配置");
  assert.equal(status.model, "deepseek-chat");
  assert.equal(status.baseUrl, "https://api.deepseek.com/v1");
});
