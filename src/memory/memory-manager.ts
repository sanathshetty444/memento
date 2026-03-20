/**
 * Central orchestrator for the memory subsystem.
 * Coordinates: redaction → tagging → chunking → dedup → embedding → storage.
 * Optionally wraps operations with circuit breaker, WAL, and LRU cache for resilience.
 */

import { v4 as uuidv4 } from "uuid";
import type { VectorStore } from "../storage/interface.js";
import type { EmbeddingProvider } from "../embeddings/interface.js";
import {
  MemoryEntry,
  MemoryResult,
  SaveOptions,
  RecallOptions,
  ListOptions,
  GLOBAL_NAMESPACE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "./types.js";
import { redact } from "./redactor.js";
import { autoTag } from "./tagger.js";
import { chunkContent } from "./chunker.js";
import { contentHash, isDuplicate } from "./dedup.js";
import { LRUCache } from "../resilience/cache.js";

export interface MemoryManagerConfig {
  deduplicationThreshold?: number; // Default: 0.92
  chunkSize?: number; // Default: 500 (words)
  chunkOverlap?: number; // Default: 100 (words)
  redactSecrets?: boolean; // Default: true
  autoTag?: boolean; // Default: true
}

export interface MemoryManagerOptions {
  store: VectorStore;
  embeddings: EmbeddingProvider;
  enableResilience?: boolean; // default true
  config?: MemoryManagerConfig;
}

interface CircuitBreakerLike {
  execute<T>(fn: () => Promise<T>): Promise<T>;
}

interface WALLike {
  append(operation: "upsert" | "delete", data: unknown): string;
  markCommitted(id: string): void;
  getPending(): Array<{ id: string; operation: string; data: unknown }>;
}

export class MemoryManager {
  private store: VectorStore;
  private embeddings: EmbeddingProvider;
  private circuitBreaker: CircuitBreakerLike | null;
  private wal: WALLike | null;
  private cache: LRUCache<string, MemoryEntry> | null;
  private resilienceEnabled: boolean;
  private initPromise: Promise<void> | null;
  private config: Required<MemoryManagerConfig>;

  constructor({ store, embeddings, enableResilience, config }: MemoryManagerOptions) {
    this.store = store;
    this.embeddings = embeddings;
    this.config = {
      deduplicationThreshold: 0.92,
      chunkSize: 500,
      chunkOverlap: 100,
      redactSecrets: true,
      autoTag: true,
      ...config,
    };
    this.resilienceEnabled = enableResilience ?? true;
    this.cache = this.resilienceEnabled ? new LRUCache<string, MemoryEntry>(100) : null;
    this.circuitBreaker = null;
    this.wal = null;
    this.initPromise = this.resilienceEnabled ? this.initResilience() : null;
  }

  /** Await this before any operation to ensure resilience is ready. */
  private async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Dynamically import and initialize resilience modules (Node.js only).
   * In browser environments, these modules won't load and resilience is silently disabled.
   */
  private async initResilience(): Promise<void> {
    try {
      const [{ CircuitBreaker }, { WriteAheadLog }] = await Promise.all([
        import("../resilience/circuit-breaker.js"),
        import("../resilience/wal.js"),
      ]);
      this.circuitBreaker = new CircuitBreaker();
      this.wal = new WriteAheadLog();
      this.replayWAL();
    } catch {
      // In browser environment, resilience modules won't load — that's fine
    }
  }

  /**
   * Dynamically resolve the namespace (Node.js only).
   * Throws in browser if no explicit namespace is provided.
   */
  private async getNamespace(): Promise<string> {
    if (typeof process === "undefined" || typeof process.cwd !== "function") {
      throw new Error("namespace is required in browser environments — pass it explicitly");
    }
    const { resolveNamespace } = await import("./namespace.js");
    return resolveNamespace();
  }

  /**
   * Save content to memory with automatic redaction, tagging, chunking,
   * deduplication, and embedding.
   */
  async save(options: SaveOptions): Promise<MemoryEntry[]> {
    await this.ensureReady();
    const namespace = options.global
      ? GLOBAL_NAMESPACE
      : (options.namespace ?? (await this.getNamespace()));

    // Pipeline: redact → tag → chunk → dedup → embed → store
    const redactedContent = this.config.redactSecrets ? redact(options.content) : options.content;

    const detectedTags = this.config.autoTag ? autoTag(redactedContent) : [];
    const mergedTags = [...new Set([...detectedTags, ...(options.tags ?? [])])];

    const summary = options.summary ?? generateSummary(redactedContent);

    const chunks = chunkContent(redactedContent, {
      maxWords: this.config.chunkSize,
      overlapWords: this.config.chunkOverlap,
    });
    const savedEntries: MemoryEntry[] = [];
    let parentId: string | undefined;

    for (const chunk of chunks) {
      const hash = await contentHash(chunk.content);
      const embedding = await this.embeddings.embed(chunk.content);

      // Check for duplicates among existing entries
      const searchFn = () =>
        this.store.search(embedding, {
          namespace,
          limit: 5,
        });
      const candidates = this.circuitBreaker
        ? await this.circuitBreaker.execute(searchFn)
        : await searchFn();

      const dupResult = isDuplicate(
        hash,
        embedding,
        candidates.map((c: MemoryResult) => ({
          id: c.entry.id,
          contentHash: c.entry.contentHash,
          embedding: c.entry.embedding,
        })),
        this.config.deduplicationThreshold,
      );

      // Exact duplicate: skip entirely
      if (dupResult.exact) {
        continue;
      }

      const entryId = uuidv4();

      // First chunk becomes the parent for subsequent chunks
      if (chunks.length > 1 && parentId === undefined) {
        parentId = entryId;
      }

      const relatedMemoryIds: string[] = [];
      if (dupResult.similar && dupResult.similarId) {
        relatedMemoryIds.push(dupResult.similarId);
      }

      const entry: MemoryEntry = {
        id: entryId,
        content: chunk.content,
        embedding,
        contentHash: hash,
        ...(chunks.length > 1 && parentId && entryId !== parentId ? { parentId } : {}),
        metadata: {
          namespace,
          tags: mergedTags,
          timestamp: new Date().toISOString(),
          source: options.source ?? "explicit",
          ...(options.files ? { files: options.files } : {}),
          ...(options.functions ? { functions: options.functions } : {}),
          ...(options.sessionId ? { sessionId: options.sessionId } : {}),
          summary:
            chunks.length > 1 ? `${summary} [chunk ${chunk.index + 1}/${chunk.total}]` : summary,
          ...(relatedMemoryIds.length > 0 ? { relatedMemoryIds } : {}),
        },
      };

      // WAL: append before upsert
      let walId: string | undefined;
      if (this.wal) {
        walId = this.wal.append("upsert", entry);
      }

      // Circuit breaker wraps the upsert
      if (this.circuitBreaker) {
        await this.circuitBreaker.execute(() => this.store.upsert(entry));
      } else {
        await this.store.upsert(entry);
      }

      // WAL: mark committed after successful upsert
      if (this.wal && walId) {
        this.wal.markCommitted(walId);
      }

      // Cache: store entry after successful save
      if (this.cache) {
        this.cache.set(entry.id, entry);
      }

      savedEntries.push(entry);
    }

    return savedEntries;
  }

  /**
   * Recall memories relevant to a query within a namespace.
   */
  async recall(options: RecallOptions): Promise<MemoryResult[]> {
    await this.ensureReady();
    const namespace = options.namespace ?? (await this.getNamespace());
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const queryEmbedding = await this.embeddings.embed(options.query);

    try {
      const searchFn = () =>
        this.store.search(queryEmbedding, {
          namespace,
          tags: options.tags,
          after: options.after,
          before: options.before,
          limit,
        });

      const results = this.circuitBreaker
        ? await this.circuitBreaker.execute(searchFn)
        : await searchFn();

      // Populate cache from results
      if (this.cache) {
        for (const result of results) {
          this.cache.set(result.entry.id, result.entry);
        }
      }

      return results;
    } catch (error) {
      // Fallback to cache if circuit breaker is open
      if (this.cache && this.cache.size > 0) {
        const cachedResults: MemoryResult[] = [];
        for (const [, entry] of this.cache.entries()) {
          if (entry.metadata.namespace === namespace) {
            cachedResults.push({ entry, score: 0 });
          }
          if (cachedResults.length >= limit) break;
        }
        if (cachedResults.length > 0) return cachedResults;
      }
      throw error;
    }
  }

  /**
   * Search memories across all namespaces (cross-project).
   */
  async search(options: Omit<RecallOptions, "namespace">): Promise<MemoryResult[]> {
    await this.ensureReady();
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const queryEmbedding = await this.embeddings.embed(options.query);

    try {
      const searchFn = () =>
        this.store.search(queryEmbedding, {
          tags: options.tags,
          after: options.after,
          before: options.before,
          limit,
        });

      const results = this.circuitBreaker
        ? await this.circuitBreaker.execute(searchFn)
        : await searchFn();

      // Populate cache from results
      if (this.cache) {
        for (const result of results) {
          this.cache.set(result.entry.id, result.entry);
        }
      }

      return results;
    } catch (error) {
      // Fallback to cache if circuit breaker is open
      if (this.cache && this.cache.size > 0) {
        const cachedResults: MemoryResult[] = [];
        for (const [, entry] of this.cache.entries()) {
          cachedResults.push({ entry, score: 0 });
          if (cachedResults.length >= limit) break;
        }
        if (cachedResults.length > 0) return cachedResults;
      }
      throw error;
    }
  }

  /**
   * Delete a memory entry by ID.
   */
  async forget(id: string): Promise<boolean> {
    await this.ensureReady();
    const result = this.circuitBreaker
      ? await this.circuitBreaker.execute(() => this.store.delete(id))
      : await this.store.delete(id);

    // Remove from cache
    if (this.cache) {
      this.cache.delete(id);
    }

    return result;
  }

  /**
   * List memory entries with optional filters.
   */
  async list(options: ListOptions): Promise<MemoryEntry[]> {
    await this.ensureReady();
    const namespace = options.namespace ?? (await this.getNamespace());

    const listFn = () =>
      this.store.list({
        namespace,
        tags: options.tags,
        limit: Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
        offset: options.offset ?? 0,
      });

    return this.circuitBreaker ? this.circuitBreaker.execute(listFn) : listFn();
  }

  /**
   * Count memory entries in a namespace.
   */
  async count(namespace?: string): Promise<number> {
    await this.ensureReady();
    const countFn = () => this.store.count(namespace);

    return this.circuitBreaker ? this.circuitBreaker.execute(countFn) : countFn();
  }

  /**
   * Replay any pending WAL entries that were not committed (e.g., after a crash).
   */
  private replayWAL(): void {
    if (!this.wal) return;

    const pending = this.wal.getPending();
    for (const walEntry of pending) {
      if (walEntry.operation === "upsert" && walEntry.data) {
        const entry = walEntry.data as MemoryEntry;
        // Fire-and-forget: replay in background, mark committed on success
        this.store
          .upsert(entry)
          .then(() => {
            this.wal!.markCommitted(walEntry.id);
            if (this.cache) {
              this.cache.set(entry.id, entry);
            }
          })
          .catch(() => {
            // Will be retried on next startup
          });
      }
    }
  }
}

/**
 * Generate a summary from content: first 100 characters, trimmed at the
 * nearest word boundary.
 */
function generateSummary(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 100) {
    return trimmed;
  }

  const truncated = trimmed.slice(0, 100);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}
