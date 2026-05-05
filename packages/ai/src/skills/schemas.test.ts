import assert from "node:assert/strict";
import test from "node:test";
import { getSkillSchema } from "./schemas.ts";

test("slide script schema accepts assistant action payload and rich output", () => {
  const input = getSkillSchema("SlideScriptInput").parse({
    action: "rewrite",
    slideId: "slide-2",
    slideTitle: "项目介绍",
    slideIndex: 2,
    fileId: "file-1",
    extractedText: "项目介绍正文",
    instruction: "改成 30 秒答辩开场",
    chunks: [],
  });

  assert.equal(input.action, "rewrite");
  assert.equal(input.slideIndex, 2);

  const output = getSkillSchema("SlideScriptOutput").parse({
    projectName: "MiniSheet",
    slideTitle: "项目介绍",
    task: "讲清本页任务。",
    normal: "完整稿",
    short: "30 秒稿",
    conversational: "口语化",
    contribution: "个人贡献",
    transition: "转场句",
    answerCard: "答辩卡",
    keywords: ["MiniSheet"],
    risks: ["风险"],
    basis: {
      topics: ["项目介绍"],
      materials: ["Slide 02"],
    },
    rewrite: "改写稿",
  });

  assert.equal(output.answerCard, "答辩卡");
  assert.deepEqual(output.basis.topics, ["项目介绍"]);
});
