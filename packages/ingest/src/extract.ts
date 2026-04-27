import type { DefenseFileRecord } from "../../../src/lib/project-workspace.ts";

export type ExtractedIngestContent = {
  content: string;
  synthetic: boolean;
  contentType: "text" | "binary-fallback";
};

export function extractIngestContent(file: DefenseFileRecord, buffer: Buffer): ExtractedIngestContent {
  const text = decodeUtf8(buffer).trim();
  const binaryLike = looksBinary(buffer);

  if (!binaryLike && text.length > 0) {
    return {
      content: normalizeTextContent(file, text),
      synthetic: false,
      contentType: "text",
    };
  }

  return {
    content: buildFallbackContent(file),
    synthetic: true,
    contentType: "binary-fallback",
  };
}

function decodeUtf8(buffer: Buffer) {
  return buffer.toString("utf8").replace(/\u0000/g, "");
}

function looksBinary(buffer: Buffer) {
  if (buffer.length === 0) return false;

  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  let suspicious = 0;

  for (const byte of sample) {
    if (byte === 0) return true;
    if ((byte < 7 || (byte > 14 && byte < 32)) && byte !== 9 && byte !== 10 && byte !== 13) {
      suspicious += 1;
    }
  }

  return suspicious / sample.length > 0.18;
}

function normalizeTextContent(file: DefenseFileRecord, content: string) {
  if (file.kind === "dataset" && file.name.toLowerCase().endsWith(".json")) {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }

  return content;
}

function buildFallbackContent(file: DefenseFileRecord) {
  const baseName = file.name.replace(/\.[^.]+$/u, "") || file.name;

  switch (file.kind) {
    case "presentation":
      return [
        `# Slide 1 ${baseName} 项目概览`,
        "说明项目服务对象、业务场景和一句话价值。",
        "",
        "# Slide 2 系统架构",
        "解释模块拆分、数据流向、核心接口和你负责的实现部分。",
        "",
        "# Slide 3 答辩重点",
        "提前准备高危追问、性能取舍、数据库设计和个人分工说明。",
      ].join("\n");
    case "code":
      return [
        `# 代码仓库概览`,
        `${file.name} 已作为代码资料入库。`,
        "重点解释目录结构、核心服务、接口流程和你个人负责的模块。",
        "",
        "# 可能被追问",
        "- 订单状态流转怎么设计",
        "- 权限校验放在哪一层",
        "- 这个模块是不是你负责的",
      ].join("\n");
    case "database":
      return [
        "# 数据库结构",
        `${file.name} 已作为数据库资料入库。`,
        "重点准备表关系、索引策略、冗余字段和事务边界的说明。",
      ].join("\n");
    case "dataset":
      return [
        "# 数据来源",
        `${file.name} 已作为数据资料入库。`,
        "重点解释字段含义、采集来源、清洗规则和指标口径。",
      ].join("\n");
    default:
      return [
        "# 项目资料",
        `${file.name} 已入库。`,
        "请围绕项目背景、实现路径、证据链和你的负责范围组织讲解。",
      ].join("\n");
  }
}
