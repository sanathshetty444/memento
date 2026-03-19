import { describe, it, expect, beforeEach } from "vitest";
import { MemoryManager } from "../src/memory/memory-manager.js";
import type { VectorStore, SearchFilters, ListFilters } from "../src/storage/interface.js";
import type { EmbeddingProvider } from "../src/embeddings/interface.js";
import type { MemoryEntry, MemoryResult } from "../src/memory/types.js";

class MockVectorStore implements VectorStore {
  entries: MemoryEntry[] = [];

  async initialize(): Promise<void> {}

  async upsert(entry: MemoryEntry): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      this.entries[idx] = entry;
    } else {
      this.entries.push(entry);
    }
  }

  async search(
    queryEmbedding: number[],
    filters: SearchFilters
  ): Promise<MemoryResult[]> {
    let results = this.entries;

    if (filters.namespace) {
      results = results.filter(
        (e) => e.metadata.namespace === filters.namespace
      );
    }
    if (filters.tags) {
      results = results.filter((e) =>
        filters.tags!.some((t) => e.metadata.tags.includes(t as any))
      );
    }

    return results.slice(0, filters.limit).map((entry) => ({
      entry,
      score: 0.95,
    }));
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      return true;
    }
    return false;
  }

  async list(filters: ListFilters): Promise<MemoryEntry[]> {
    let results = this.entries;

    if (filters.namespace) {
      results = results.filter(
        (e) => e.metadata.namespace === filters.namespace
      );
    }
    if (filters.tags) {
      results = results.filter((e) =>
        filters.tags!.some((t) => e.metadata.tags.includes(t as any))
      );
    }

    return results.slice(filters.offset, filters.offset + filters.limit);
  }

  async count(namespace?: string): Promise<number> {
    if (namespace) {
      return this.entries.filter((e) => e.metadata.namespace === namespace)
        .length;
    }
    return this.entries.length;
  }

  async close(): Promise<void> {}
}

class MockEmbeddingProvider implements EmbeddingProvider {
  dimensions = 384;
  modelName = "mock";

  async embed(text: string): Promise<number[]> {
    return new Array(384).fill(0).map((_, i) => Math.sin(i + text.length));
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

describe("MemoryManager", () => {
  let store: MockVectorStore;
  let embeddings: MockEmbeddingProvider;
  let manager: MemoryManager;

  beforeEach(() => {
    store = new MockVectorStore();
    embeddings = new MockEmbeddingProvider();
    manager = new MemoryManager({ store, embeddings });
  });

  it("save() stores a memory entry", async () => {
    const entries = await manager.save({
      content: "Remember this fact.",
      namespace: "test-project",
    });
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(store.entries.length).toBeGreaterThanOrEqual(1);
    expect(store.entries[0].content).toBe("Remember this fact.");
  });

  it("save() redacts sensitive content", async () => {
    const entries = await manager.save({
      content: "Use key AKIAIOSFODNN7EXAMPLE for access",
      namespace: "test-project",
    });
    expect(entries[0].content).toContain("[REDACTED:AWS_KEY]");
    expect(entries[0].content).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("save() auto-tags content", async () => {
    const entries = await manager.save({
      content: "We decided to use React because of its ecosystem",
      namespace: "test-project",
    });
    expect(entries[0].metadata.tags).toContain("decision");
  });

  it("save() chunks long content", async () => {
    const longContent = Array.from({ length: 1500 }, (_, i) => `word${i}`).join(
      " "
    );
    const entries = await manager.save({
      content: longContent,
      namespace: "test-project",
    });
    expect(entries.length).toBeGreaterThan(1);
  });

  it("save() skips exact duplicates", async () => {
    await manager.save({
      content: "Unique content here.",
      namespace: "test-project",
    });
    const countBefore = store.entries.length;

    await manager.save({
      content: "Unique content here.",
      namespace: "test-project",
    });
    expect(store.entries.length).toBe(countBefore);
  });

  it("recall() returns relevant results", async () => {
    await manager.save({
      content: "TypeScript is great for type safety",
      namespace: "test-project",
    });

    const results = await manager.recall({
      query: "TypeScript types",
      namespace: "test-project",
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("forget() deletes an entry", async () => {
    const entries = await manager.save({
      content: "Delete me later.",
      namespace: "test-project",
    });
    const id = entries[0].id;

    const result = await manager.forget(id);
    expect(result).toBe(true);
    expect(store.entries.find((e) => e.id === id)).toBeUndefined();
  });

  it("list() returns entries with filters", async () => {
    await manager.save({
      content: "We decided to use Vitest because it is fast",
      namespace: "test-project",
      tags: ["decision"],
    });
    await manager.save({
      content: "A random conversation about the weather",
      namespace: "test-project",
    });

    const results = await manager.list({
      namespace: "test-project",
      tags: ["decision"],
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const entry of results) {
      expect(entry.metadata.tags).toContain("decision");
    }
  });
});
