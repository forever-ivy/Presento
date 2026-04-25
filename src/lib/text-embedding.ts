export const textEmbeddingDimensions = 1536;

export function createTextEmbedding(text: string, dimensions = textEmbeddingDimensions) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = tokenize(text);

  tokens.forEach((token) => {
    const hash = hashToken(token);
    const index = Math.abs(hash) % dimensions;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  });

  return normalizeVector(vector);
}

export function formatEmbeddingForPgvector(vector: number[]) {
  return `[${vector.map((value) => value.toFixed(6)).join(",")}]`;
}

function tokenize(text: string) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
  const chars = Array.from(text.replace(/\s+/g, ""));
  return [...words, ...chars];
}

function hashToken(token: string) {
  let hash = 5381;
  for (const char of token) {
    hash = (hash * 33) ^ char.codePointAt(0)!;
  }
  return hash | 0;
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + value ** 2, 0));
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
}
