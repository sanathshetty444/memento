import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { IndexedDBVectorStore } from "../../src/storage/indexeddb-adapter.js";
import type { MemoryEntry } from "../../src/memory/types.js";

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    content: overrides.content ?? "test content",
    embedding: overrides.embedding ?? [0.1, 0.2, 0.3],
    contentHash: overrides.contentHash ?? "abc123",
    metadata: {
      namespace: "test-ns",
      tags: ["code"],
      timestamp: new Date().toISOString(),
      source: "explicit",
      ...overrides.metadata,
    },
  } as MemoryEntry;
}

describe("IndexedDBVectorStore", () => {
  let store: IndexedDBVectorStore;

  beforeEach(async () => {
    store = new IndexedDBVectorStore({ dbName: "test-memento" });
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    indexedDB.deleteDatabase("test-memento");
  });

  it("upsert and retrieve by search", async () => {
    const entry = makeEntry({ embedding: [1, 0, 0] });
    await store.upsert(entry);

    const results = await store.search([1, 0, 0], {
      namespace: "test-ns",
      limit: 5,
    });
    expect(results.length).toBe(1);
    expect(results[0].entry.id).toBe(entry.id);
    expect(results[0].score).toBeCloseTo(1.0);
  });

  it("search filters by namespace", async () => {
    const e1 = makeEntry({
      metadata: { namespace: "ns-a", tags: [], timestamp: new Date().toISOString(), source: "explicit" },
    });
    const e2 = makeEntry({
      metadata: { namespace: "ns-b", tags: [], timestamp: new Date().toISOString(), source: "explicit" },
    });
    await store.upsert(e1);
    await store.upsert(e2);

    const results = await store.search([0.1, 0.2, 0.3], {
      namespace: "ns-a",
      limit: 10,
    });
    expect(results.length).toBe(1);
    expect(results[0].entry.metadata.namespace).toBe("ns-a");
  });

  it("search filters by tags", async () => {
    const e1 = makeEntry({
      metadata: { namespace: "ns", tags: ["code"], timestamp: new Date().toISOString(), source: "explicit" },
    });
    const e2 = makeEntry({
      metadata: { namespace: "ns", tags: ["decision"], timestamp: new Date().toISOString(), source: "explicit" },
    });
    await store.upsert(e1);
    await store.upsert(e2);

    const results = await store.search([0.1, 0.2, 0.3], {
      namespace: "ns",
      tags: ["code"],
      limit: 10,
    });
    expect(results.length).toBe(1);
    expect(results[0].entry.metadata.tags).toContain("code");
  });

  it("search filters by time range", async () => {
    const old = makeEntry({
      metadata: { namespace: "ns", tags: [], timestamp: "2025-01-01T00:00:00Z", source: "explicit" },
    });
    const recent = makeEntry({
      metadata: { namespace: "ns", tags: [], timestamp: "2026-03-19T00:00:00Z", source: "explicit" },
    });
    await store.upsert(old);
    await store.upsert(recent);

    const results = await store.search([0.1, 0.2, 0.3], {
      namespace: "ns",
      after: "2026-01-01T00:00:00Z",
      limit: 10,
    });
    expect(results.length).toBe(1);
    expect(results[0].entry.id).toBe(recent.id);
  });

  it("delete removes an entry", async () => {
    const entry = makeEntry();
    await store.upsert(entry);

    const deleted = await store.delete(entry.id);
    expect(deleted).toBe(true);

    const results = await store.search([0.1, 0.2, 0.3], { limit: 10 });
    expect(results.length).toBe(0);
  });

  it("delete returns false for non-existent entry", async () => {
    const deleted = await store.delete("non-existent-id");
    expect(deleted).toBe(false);
  });

  it("list returns entries with pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await store.upsert(makeEntry());
    }

    const page1 = await store.list({ namespace: "test-ns", limit: 2, offset: 0 });
    expect(page1.length).toBe(2);

    const page2 = await store.list({ namespace: "test-ns", limit: 2, offset: 2 });
    expect(page2.length).toBe(2);
  });

  it("list filters by tags", async () => {
    await store.upsert(makeEntry({
      metadata: { namespace: "ns", tags: ["code"], timestamp: new Date().toISOString(), source: "explicit" },
    }));
    await store.upsert(makeEntry({
      metadata: { namespace: "ns", tags: ["error"], timestamp: new Date().toISOString(), source: "explicit" },
    }));

    const results = await store.list({ namespace: "ns", tags: ["code"], limit: 10, offset: 0 });
    expect(results.length).toBe(1);
  });

  it("count returns total entries", async () => {
    await store.upsert(makeEntry({ metadata: { namespace: "a", tags: [], timestamp: new Date().toISOString(), source: "explicit" } }));
    await store.upsert(makeEntry({ metadata: { namespace: "b", tags: [], timestamp: new Date().toISOString(), source: "explicit" } }));

    expect(await store.count()).toBe(2);
    expect(await store.count("a")).toBe(1);
  });

  it("upsert updates existing entry with same id", async () => {
    const entry = makeEntry({ content: "original" });
    await store.upsert(entry);

    const updated = { ...entry, content: "updated" };
    await store.upsert(updated);

    const results = await store.list({ namespace: "test-ns", limit: 10, offset: 0 });
    expect(results.length).toBe(1);
    expect(results[0].content).toBe("updated");
  });
});
