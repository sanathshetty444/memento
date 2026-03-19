import { describe, it, expect, beforeEach } from "vitest";
import { MemoryManager } from "../../src/memory/memory-manager.js";
import { compactMemories } from "../../src/memory/compactor.js";
import type {
  VectorStore,
  SearchFilters,
  ListFilters,
} from "../../src/storage/interface.js";
import type { EmbeddingProvider } from "../../src/embeddings/interface.js";
import type { MemoryEntry, MemoryResult } from "../../src/memory/types.js";

// ---------------------------------------------------------------------------
// Mock implementations (same pattern as memory-manager.test.ts)
// ---------------------------------------------------------------------------

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
    filters: SearchFilters,
  ): Promise<MemoryResult[]> {
    let results = this.entries;

    if (filters.namespace) {
      results = results.filter(
        (e) => e.metadata.namespace === filters.namespace,
      );
    }
    if (filters.tags) {
      results = results.filter((e) =>
        filters.tags!.some((t) => e.metadata.tags.includes(t as any)),
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
        (e) => e.metadata.namespace === filters.namespace,
      );
    }
    if (filters.tags) {
      results = results.filter((e) =>
        filters.tags!.some((t) => e.metadata.tags.includes(t as any)),
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

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("Full Pipeline Integration", () => {
  let store: MockVectorStore;
  let embeddings: MockEmbeddingProvider;
  let manager: MemoryManager;

  beforeEach(() => {
    store = new MockVectorStore();
    embeddings = new MockEmbeddingProvider();
    manager = new MemoryManager({
      store,
      embeddings,
      enableResilience: false,
    });
  });

  // -----------------------------------------------------------------------
  // save -> recall cycle
  // -----------------------------------------------------------------------
  describe("save → recall cycle", () => {
    it("saves and recalls a memory by semantic query", async () => {
      await manager.save({
        content: "We decided to use JWT for auth",
        namespace: "test-project",
      });

      const results = await manager.recall({
        query: "authentication approach",
        namespace: "test-project",
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(
        results.some((r) => r.entry.content.includes("JWT")),
      ).toBe(true);
    });

    it("saves and recalls across multiple entries", async () => {
      await manager.save({
        content: "We decided to use JWT for authentication tokens",
        namespace: "test-project",
      });
      await manager.save({
        content: "PostgreSQL was chosen as the primary database",
        namespace: "test-project",
      });
      await manager.save({
        content: "REST with JSON:API pattern for all public endpoints",
        namespace: "test-project",
      });

      const authResults = await manager.recall({
        query: "auth tokens",
        namespace: "test-project",
      });
      expect(authResults.length).toBe(3);

      const dbResults = await manager.recall({
        query: "database choice",
        namespace: "test-project",
      });
      expect(dbResults.length).toBe(3);

      const apiResults = await manager.recall({
        query: "api pattern",
        namespace: "test-project",
      });
      expect(apiResults.length).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // deduplication
  // -----------------------------------------------------------------------
  describe("deduplication", () => {
    it("skips exact duplicate content", async () => {
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
  });

  // -----------------------------------------------------------------------
  // cross-project search
  // -----------------------------------------------------------------------
  describe("cross-project search", () => {
    it("finds memories across namespaces", async () => {
      await manager.save({
        content: "Project A uses React for the frontend",
        namespace: "project-a",
      });
      await manager.save({
        content: "Project B uses Vue for the frontend",
        namespace: "project-b",
      });

      // search() has no namespace filter — should find entries from both
      const results = await manager.search({
        query: "frontend framework",
      });

      expect(results.length).toBe(2);

      const namespaces = results.map((r) => r.entry.metadata.namespace);
      expect(namespaces).toContain("project-a");
      expect(namespaces).toContain("project-b");
    });
  });

  // -----------------------------------------------------------------------
  // redaction
  // -----------------------------------------------------------------------
  describe("redaction", () => {
    it("strips sensitive data before storage", async () => {
      const entries = await manager.save({
        content:
          "Use this API key: sk-abc123def456ghi789jkl012 to access the service",
        namespace: "test-project",
      });

      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].content).toContain("[REDACTED:API_KEY]");
      expect(entries[0].content).not.toContain(
        "sk-abc123def456ghi789jkl012",
      );

      // Also verify via recall
      const results = await manager.recall({
        query: "API key",
        namespace: "test-project",
      });
      expect(results[0].entry.content).not.toContain(
        "sk-abc123def456ghi789jkl012",
      );
    });
  });

  // -----------------------------------------------------------------------
  // auto-tagging
  // -----------------------------------------------------------------------
  describe("auto-tagging", () => {
    it("applies correct tags based on content", async () => {
      // Error content
      const errorEntries = await manager.save({
        content:
          "Got an error: TypeError — cannot read property of undefined in handler.ts",
        namespace: "test-project",
      });
      expect(errorEntries[0].metadata.tags).toContain("error");

      // Decision content
      const decisionEntries = await manager.save({
        content: "We decided to use Vitest over Jest for its speed",
        namespace: "test-project",
      });
      expect(decisionEntries[0].metadata.tags).toContain("decision");
    });
  });

  // -----------------------------------------------------------------------
  // chunking
  // -----------------------------------------------------------------------
  describe("chunking", () => {
    it("chunks long content into multiple entries", async () => {
      const longContent = Array.from(
        { length: 1500 },
        (_, i) => `word${i}`,
      ).join(" ");

      const entries = await manager.save({
        content: longContent,
        namespace: "test-project",
      });

      expect(entries.length).toBeGreaterThan(1);

      // First entry is the parent; subsequent entries reference it
      const parentId = entries[0].id;
      for (const entry of entries.slice(1)) {
        expect(entry.parentId).toBe(parentId);
      }
    });
  });

  // -----------------------------------------------------------------------
  // forget
  // -----------------------------------------------------------------------
  describe("forget", () => {
    it("deletes a memory and it no longer appears in recall", async () => {
      const entries = await manager.save({
        content: "Temporary note to forget later",
        namespace: "test-project",
      });
      const id = entries[0].id;

      // Verify it exists first
      const beforeResults = await manager.recall({
        query: "temporary note",
        namespace: "test-project",
      });
      expect(beforeResults.some((r) => r.entry.id === id)).toBe(true);

      // Forget it
      const deleted = await manager.forget(id);
      expect(deleted).toBe(true);

      // Verify it is gone
      const afterResults = await manager.recall({
        query: "temporary note",
        namespace: "test-project",
      });
      expect(afterResults.some((r) => r.entry.id === id)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // compaction
  // -----------------------------------------------------------------------
  describe("compaction", () => {
    it("removes expired entries", async () => {
      // Insert entries with old timestamps directly into the store
      const oldDate = new Date(
        Date.now() - 200 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 200 days ago

      store.entries.push({
        id: "old-1",
        content: "Very old entry",
        contentHash: "hash-old-1",
        embedding: new Array(384).fill(0),
        metadata: {
          namespace: "test-project",
          tags: [],
          timestamp: oldDate,
          source: "explicit",
          summary: "old entry",
        },
      });

      // A fresh entry
      await manager.save({
        content: "Fresh entry that should survive compaction",
        namespace: "test-project",
      });

      const totalBefore = store.entries.length;
      expect(totalBefore).toBe(2);

      const result = await compactMemories(store, embeddings, {
        namespace: "test-project",
        ttlDays: 180, // 200-day-old entry exceeds this
      });

      expect(result.expired).toBe(1);
      expect(store.entries.find((e) => e.id === "old-1")).toBeUndefined();
      expect(result.remaining).toBe(1);
    });

    it("evicts oldest when over max entries", async () => {
      // Insert 5 entries with varying timestamps
      for (let i = 0; i < 5; i++) {
        store.entries.push({
          id: `entry-${i}`,
          content: `Entry number ${i}`,
          contentHash: `hash-${i}`,
          embedding: new Array(384).fill(0).map((_, j) => Math.sin(j * (i + 1) * 100)), // distinct embeddings to avoid merge
          metadata: {
            namespace: "test-project",
            tags: [],
            timestamp: new Date(
              Date.now() - (5 - i) * 60 * 60 * 1000,
            ).toISOString(), // older first
            source: "explicit",
            summary: `entry ${i}`,
          },
        });
      }

      expect(store.entries.length).toBe(5);

      const result = await compactMemories(store, embeddings, {
        namespace: "test-project",
        maxEntries: 3,
      });

      expect(result.evicted).toBe(2);
      expect(result.remaining).toBe(3);
      // Oldest entries (entry-0, entry-1) should be gone
      expect(store.entries.find((e) => e.id === "entry-0")).toBeUndefined();
      expect(store.entries.find((e) => e.id === "entry-1")).toBeUndefined();
      // Newest entries should survive
      expect(store.entries.find((e) => e.id === "entry-4")).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // list and pagination
  // -----------------------------------------------------------------------
  describe("list and pagination", () => {
    it("lists entries with offset and limit", async () => {
      // Save 5 distinct entries
      for (let i = 0; i < 5; i++) {
        await manager.save({
          content: `Paginated entry number ${i} with enough unique words to avoid dedup`,
          namespace: "test-project",
        });
      }

      expect(store.entries.length).toBe(5);

      const page1 = await manager.list({
        namespace: "test-project",
        limit: 2,
        offset: 0,
      });
      expect(page1.length).toBe(2);

      const page2 = await manager.list({
        namespace: "test-project",
        limit: 2,
        offset: 2,
      });
      expect(page2.length).toBe(2);

      // Pages should contain different entries
      const page1Ids = page1.map((e) => e.id);
      const page2Ids = page2.map((e) => e.id);
      for (const id of page1Ids) {
        expect(page2Ids).not.toContain(id);
      }
    });
  });
});
