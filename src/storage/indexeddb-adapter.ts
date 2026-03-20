import { openDB, type IDBPDatabase } from "idb";
import type { MemoryEntry, MemoryResult, MemoryTag } from "../memory/types.js";
import type { VectorStore, SearchFilters, ListFilters } from "./interface.js";
import { cosineSimilarity } from "../memory/dedup.js";

const STORE_NAME = "memories";
const DB_VERSION = 1;

export interface IndexedDBVectorStoreOptions {
  dbName?: string;
}

export class IndexedDBVectorStore implements VectorStore {
  private readonly dbName: string;
  private db: IDBPDatabase | null = null;

  constructor(options: IndexedDBVectorStoreOptions = {}) {
    this.dbName = options.dbName ?? "memento-vectors";
  }

  async initialize(): Promise<void> {
    this.db = await openDB(this.dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("by-namespace", "metadata.namespace");
          store.createIndex("by-timestamp", "metadata.timestamp");
          store.createIndex("by-tags", "metadata.tags", { multiEntry: true });
        }
      },
    });
  }

  private getDB(): IDBPDatabase {
    if (!this.db) throw new Error("IndexedDBVectorStore not initialized. Call initialize() first.");
    return this.db;
  }

  async upsert(entry: MemoryEntry): Promise<void> {
    const db = this.getDB();
    try {
      await db.put(STORE_NAME, entry);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        console.warn("IndexedDB quota exceeded — entry not stored:", entry.id);
        return;
      }
      throw err;
    }
  }

  async search(queryEmbedding: number[], filters: SearchFilters): Promise<MemoryResult[]> {
    const entries = await this.getAllFiltered(filters.namespace);
    const scored: MemoryResult[] = [];

    for (const entry of entries) {
      if (!this.matchesSearchFilters(entry, filters)) continue;
      const score = entry.embedding ? cosineSimilarity(queryEmbedding, entry.embedding) : 0;
      scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, filters.limit);
  }

  async delete(id: string): Promise<boolean> {
    const db = this.getDB();
    const existing = await db.get(STORE_NAME, id);
    if (!existing) return false;
    await db.delete(STORE_NAME, id);
    return true;
  }

  async list(filters: ListFilters): Promise<MemoryEntry[]> {
    const entries = await this.getAllFiltered(filters.namespace);
    const filtered = entries.filter((e) => this.matchesListFilters(e, filters));

    filtered.sort(
      (a, b) => new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime(),
    );

    return filtered.slice(filters.offset, filters.offset + filters.limit);
  }

  async count(namespace?: string): Promise<number> {
    if (namespace) {
      const entries = await this.getAllFiltered(namespace);
      return entries.length;
    }
    const db = this.getDB();
    return db.count(STORE_NAME);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private async getAllFiltered(namespace?: string): Promise<MemoryEntry[]> {
    const db = this.getDB();
    if (namespace) {
      return db.getAllFromIndex(STORE_NAME, "by-namespace", namespace);
    }
    return db.getAll(STORE_NAME);
  }

  private matchesSearchFilters(entry: MemoryEntry, filters: SearchFilters): boolean {
    if (filters.tags && filters.tags.length > 0) {
      const hasTag = filters.tags.some((t) => entry.metadata.tags.includes(t as MemoryTag));
      if (!hasTag) return false;
    }
    if (filters.after && entry.metadata.timestamp < filters.after) return false;
    if (filters.before && entry.metadata.timestamp > filters.before) return false;
    return true;
  }

  private matchesListFilters(entry: MemoryEntry, filters: ListFilters): boolean {
    if (filters.tags && filters.tags.length > 0) {
      const hasTag = filters.tags.some((t) => entry.metadata.tags.includes(t as MemoryTag));
      if (!hasTag) return false;
    }
    return true;
  }
}
