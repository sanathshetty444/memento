import { describe, it, expect } from "vitest";
import { chunkContent } from "../src/memory/chunker.js";

function makeWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
}

describe("chunkContent", () => {
  it("returns single chunk for short content under threshold", () => {
    const result = chunkContent("This is short content.");
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("This is short content.");
    expect(result[0].index).toBe(0);
    expect(result[0].total).toBe(1);
  });

  it("chunks long content into multiple pieces", () => {
    const longContent = makeWords(1500);
    const result = chunkContent(longContent);
    expect(result.length).toBeGreaterThan(1);
  });

  it("respects maxWords option", () => {
    const content = makeWords(200);
    const result = chunkContent(content, {
      maxWords: 50,
      threshold: 100,
      overlapWords: 10,
    });
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      const wordCount = chunk.content.split(/\s+/).filter(Boolean).length;
      // Each chunk should be roughly within maxWords (plus overlap)
      expect(wordCount).toBeLessThanOrEqual(70); // maxWords + overlap margin
    }
  });

  it("chunks have correct index and total fields", () => {
    const longContent = makeWords(1500);
    const result = chunkContent(longContent);
    const total = result.length;
    for (let i = 0; i < result.length; i++) {
      expect(result[i].index).toBe(i);
      expect(result[i].total).toBe(total);
    }
  });

  it("overlap is present between consecutive chunks", () => {
    const longContent = makeWords(1500);
    const result = chunkContent(longContent, {
      maxWords: 500,
      overlapWords: 100,
      threshold: 1000,
    });
    expect(result.length).toBeGreaterThan(1);

    // Check that the end of chunk N appears at the start of chunk N+1
    for (let i = 0; i < result.length - 1; i++) {
      const currentWords = result[i].content.split(/\s+/).filter(Boolean);
      const nextWords = result[i + 1].content.split(/\s+/).filter(Boolean);

      // The last few words of the current chunk should appear at the beginning of the next
      const tail = currentWords.slice(-50);
      const head = nextWords.slice(0, 150);
      const headStr = head.join(" ");

      const overlap = tail.some((word) => headStr.includes(word));
      expect(overlap).toBe(true);
    }
  });
});
