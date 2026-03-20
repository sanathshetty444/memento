import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GeminiFetchEmbeddingProvider } from "../../src/embeddings/gemini-fetch-adapter.js";

const MOCK_EMBEDDING = Array.from({ length: 768 }, (_, i) => Math.sin(i));

describe("GeminiFetchEmbeddingProvider", () => {
  let provider: GeminiFetchEmbeddingProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new GeminiFetchEmbeddingProvider({ apiKey: "test-key" });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("embed() returns 768-dimensional vector", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          embedding: { values: MOCK_EMBEDDING },
        }),
    });

    const result = await provider.embed("test text");
    expect(result).toHaveLength(768);
    expect(result).toEqual(MOCK_EMBEDDING);
  });

  it("embed() sends correct request", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          embedding: { values: MOCK_EMBEDDING },
        }),
    });

    await provider.embed("hello world");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("text-embedding-004:embedContent"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": "test-key" },
        body: expect.stringContaining("hello world"),
      }),
    );
  });

  it("embed() throws on HTTP error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: () => Promise.resolve("Rate limited"),
    });

    await expect(provider.embed("test")).rejects.toThrow("429");
  });

  it("embed() throws on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    await expect(provider.embed("test")).rejects.toThrow("Network failure");
  });

  it("embedBatch() returns array of vectors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          embeddings: [{ values: MOCK_EMBEDDING }, { values: MOCK_EMBEDDING }],
        }),
    });

    const results = await provider.embedBatch(["text1", "text2"]);
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(768);
  });

  it("has correct dimensions and modelName", () => {
    expect(provider.dimensions).toBe(768);
    expect(provider.modelName).toBe("text-embedding-004");
  });
});
