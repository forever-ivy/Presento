import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTextEmbedding,
  formatEmbeddingForPgvector,
  textEmbeddingDimensions,
} from "./text-embedding.ts";

test("creates a deterministic normalized local text embedding", () => {
  const first = createTextEmbedding("订单状态 数据库 orders");
  const second = createTextEmbedding("订单状态 数据库 orders");

  assert.equal(first.length, textEmbeddingDimensions);
  assert.deepEqual(first, second);
  assert.ok(first.some((value) => value !== 0));
  assert.ok(first.every((value) => value >= -1 && value <= 1));
});

test("formats embedding as pgvector literal", () => {
  const literal = formatEmbeddingForPgvector([0.1, -0.2, 0]);

  assert.equal(literal, "[0.100000,-0.200000,0.000000]");
});
