import assert from "node:assert/strict";
import test from "node:test";
import { invokeBuiltInSkillWithInvocation } from "./executor.ts";

const originalFetch = globalThis.fetch;
const originalEnv = {
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_MODEL: process.env.LLM_MODEL,
};

function restoreRuntime() {
  globalThis.fetch = originalFetch;
  process.env.LLM_API_KEY = originalEnv.LLM_API_KEY;
  process.env.LLM_BASE_URL = originalEnv.LLM_BASE_URL;
  process.env.LLM_MODEL = originalEnv.LLM_MODEL;
}

test.afterEach(restoreRuntime);

test("slide_script invokes configured model and records success", async () => {
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://llm.example/v1";
  process.env.LLM_MODEL = "test-model";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          projectName: "MiniSheet",
          slideTitle: "项目介绍",
          task: "模型生成任务",
          normal: "模型完整稿",
          short: "模型 30 秒稿",
          conversational: "模型口语化",
          contribution: "模型个人贡献",
          transition: "模型转场",
          answerCard: "模型答辩卡",
          keywords: ["MiniSheet", "Excel"],
          risks: ["模型风险"],
          basis: {
            topics: ["项目介绍"],
            materials: ["Slide 02"],
          },
          rewrite: "模型改写稿",
        }),
      },
    }],
  }), { status: 200 })) as typeof fetch;

  const { output, invocation } = await invokeBuiltInSkillWithInvocation({
    projectId: "project-1",
    projectName: "MiniSheet",
    skillId: "slide_script",
    trigger: "slide-assistant",
    payload: {
      action: "rewrite",
      slideId: "slide-2",
      slideTitle: "项目介绍",
      slideIndex: 2,
      instruction: "压缩成 30 秒",
      chunks: [{
        content: "项目介绍正文",
        source: "slides.pdf",
        metadata: { lineStart: 1, lineEnd: 2 },
      }],
    },
  });

  assert.equal(invocation.status, "success");
  assert.equal(invocation.usedFallback, false);
  assert.equal((output as { short: string }).short, "模型 30 秒稿");
});

test("slide_script falls back when model is not configured", async () => {
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;

  const { output, invocation } = await invokeBuiltInSkillWithInvocation({
    projectId: "project-1",
    projectName: "MiniSheet",
    skillId: "slide_script",
    trigger: "slide-assistant",
    payload: {
      action: "short",
      slideTitle: "项目介绍",
      slideIndex: 2,
      chunks: [{
        content: "项目目标：介绍 MiniSheet 与 Excel 的关系。",
        source: "slides.pdf",
        metadata: { lineStart: 1, lineEnd: 2 },
      }],
    },
  });

  assert.equal(invocation.status, "fallback");
  assert.equal(invocation.usedFallback, true);
  assert.match((output as { short: string }).short, /项目介绍/u);
});
