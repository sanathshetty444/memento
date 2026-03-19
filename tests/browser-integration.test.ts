import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { MemoryManager } from "../src/memory/memory-manager.js";
import { IndexedDBVectorStore } from "../src/storage/indexeddb-adapter.js";
import type { EmbeddingProvider } from "../src/embeddings/interface.js";

class MockEmbeddings implements EmbeddingProvider {
  dimensions = 768;
  modelName = "mock-768";

  async embed(text: string): Promise<number[]> {
    const vec = new Array(768).fill(0);
    for (let i = 0; i < text.length && i < 768; i++) {
      vec[i] = text.charCodeAt(i) / 256;
    }
    return vec;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

describe("Browser Integration: MemoryManager + IndexedDB", () => {
  let store: IndexedDBVectorStore;
  let manager: MemoryManager;

  beforeEach(async () => {
    store = new IndexedDBVectorStore({ dbName: "integration-test" });
    await store.initialize();
    manager = new MemoryManager({
      store,
      embeddings: new MockEmbeddings(),
      enableResilience: false,
    });
  });

  afterEach(async () => {
    await store.close();
    indexedDB.deleteDatabase("integration-test");
  });

  it("save() then recall() returns the saved memory", async () => {
    await manager.save({
      content: "The login page uses OAuth2 with Google as the provider",
      namespace: "webwhisper",
      tags: ["architecture"],
    });

    const results = await manager.recall({
      query: "login authentication",
      namespace: "webwhisper",
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].entry.content).toContain("OAuth2");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("save() then forget() removes the memory", async () => {
    const entries = await manager.save({
      content: "Temporary workflow pattern for testing",
      namespace: "webwhisper",
    });

    const deleted = await manager.forget(entries[0].id);
    expect(deleted).toBe(true);

    const count = await store.count("webwhisper");
    expect(count).toBe(0);
  });

  it("save() with tags then list() with tag filter", async () => {
    await manager.save({
      content: "Navigation step: click Settings in sidebar",
      namespace: "webwhisper",
      tags: ["code"],
    });
    await manager.save({
      content: "Decided to use breadth-first for link discovery",
      namespace: "webwhisper",
      tags: ["decision"],
    });

    const codeEntries = await manager.list({
      namespace: "webwhisper",
      tags: ["code"],
    });
    expect(codeEntries.length).toBeGreaterThanOrEqual(1);
    expect(codeEntries[0].metadata.tags).toContain("code");
  });

  it("count() reflects stored entries", async () => {
    expect(await store.count("webwhisper")).toBe(0);

    await manager.save({ content: "Memory one", namespace: "webwhisper" });
    await manager.save({ content: "Memory two", namespace: "webwhisper" });

    expect(await store.count("webwhisper")).toBe(2);
  });
});
