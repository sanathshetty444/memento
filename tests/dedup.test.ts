import { describe, it, expect } from "vitest";
import { contentHash, cosineSimilarity, isDuplicate } from "../src/memory/dedup.js";

describe("contentHash", () => {
  it("produces consistent hashes for the same content", async () => {
    const hash1 = await contentHash("hello world");
    const hash2 = await contentHash("hello world");
    expect(hash1).toBe(hash2);
  });

  it("normalizes whitespace and case", async () => {
    const hash1 = await contentHash("Hello   World");
    const hash2 = await contentHash("hello world");
    expect(hash1).toBe(hash2);
  });

  it("contentHash returns consistent SHA-256 hex for same content", async () => {
    const hash1 = await contentHash("hello world");
    const hash2 = await contentHash("hello world");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("contentHash normalizes whitespace before hashing", async () => {
    const hash1 = await contentHash("  hello   world  ");
    const hash2 = await contentHash("hello world");
    expect(hash1).toBe(hash2);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it("handles zero vectors by returning 0", () => {
    const zero = [0, 0, 0];
    const v = [1, 2, 3];
    expect(cosineSimilarity(zero, v)).toBe(0);
    expect(cosineSimilarity(v, zero)).toBe(0);
    expect(cosineSimilarity(zero, zero)).toBe(0);
  });
});

describe("isDuplicate", () => {
  it("detects exact hash matches", async () => {
    const hash = await contentHash("test content");
    const result = isDuplicate(hash, [], [{ contentHash: hash, id: "entry-1" }]);
    expect(result.exact).toBe(true);
    expect(result.similar).toBe(false);
  });

  it("detects similar embeddings with cosine >= 0.92", () => {
    const embedding = [1, 2, 3, 4, 5];
    // Slightly perturbed vector that should still be very similar
    const similarEmbedding = [1.01, 2.01, 3.01, 4.01, 5.01];

    const result = isDuplicate("different-hash", embedding, [
      {
        contentHash: "other-hash",
        embedding: similarEmbedding,
        id: "entry-2",
      },
    ]);
    expect(result.similar).toBe(true);
    expect(result.similarId).toBe("entry-2");
  });

  it("returns false for different content", () => {
    const embedding = [1, 0, 0, 0, 0];
    const differentEmbedding = [0, 0, 0, 0, 1];

    const result = isDuplicate("unique-hash", embedding, [
      {
        contentHash: "other-hash",
        embedding: differentEmbedding,
        id: "entry-3",
      },
    ]);
    expect(result.exact).toBe(false);
    expect(result.similar).toBe(false);
  });
});
