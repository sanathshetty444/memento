/**
 * Central orchestrator for the memory subsystem.
 * Coordinates: redaction → tagging → chunking → dedup → embedding → storage.
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
import { resolveNamespace } from "./namespace.js";
import { contentHash, isDuplicate } from "./dedup.js";

export interface MemoryManagerOptions {
  store: VectorStore;
  embeddings: EmbeddingProvider;
}

export class MemoryManager {
  private store: VectorStore;
  private embeddings: EmbeddingProvider;

  constructor({ store, embeddings }: MemoryManagerOptions) {
    this.store = store;
    this.embeddings = embeddings;
  }

  /**
   * Save content to memory with automatic redaction, tagging, chunking,
   * deduplication, and embedding.
   */
  async save(options: SaveOptions): Promise<MemoryEntry[]> {
    const namespace = options.global
      ? GLOBAL_NAMESPACE
      : (options.namespace ?? resolveNamespace());

    // Pipeline: redact → tag → chunk → dedup → embed → store
    const redactedContent = redact(options.content);

    const detectedTags = autoTag(redactedContent);
    const mergedTags = [
      ...new Set([...detectedTags, ...(options.tags ?? [])]),
    ];

    const summary =
      options.summary ?? generateSummary(redactedContent);

    const chunks = chunkContent(redactedContent);
    const savedEntries: MemoryEntry[] = [];
    let parentId: string | undefined;

    for (const chunk of chunks) {
      const hash = contentHash(chunk.content);
      const embedding = await this.embeddings.embed(chunk.content);

      // Check for duplicates among existing entries
      const candidates = await this.store.search(embedding, {
        namespace,
        limit: 5,
      });

      const dupResult = isDuplicate(
        hash,
        embedding,
        candidates.map((c) => ({
          id: c.entry.id,
          contentHash: c.entry.contentHash,
          embedding: c.entry.embedding,
        }))
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
        ...(chunks.length > 1 && parentId && entryId !== parentId
          ? { parentId }
          : {}),
        metadata: {
          namespace,
          tags: mergedTags,
          timestamp: new Date().toISOString(),
          source: options.source ?? "explicit",
          ...(options.files ? { files: options.files } : {}),
          ...(options.functions ? { functions: options.functions } : {}),
          ...(options.sessionId ? { sessionId: options.sessionId } : {}),
          summary:
            chunks.length > 1
              ? `${summary} [chunk ${chunk.index + 1}/${chunk.total}]`
              : summary,
          ...(relatedMemoryIds.length > 0 ? { relatedMemoryIds } : {}),
        },
      };

      await this.store.upsert(entry);
      savedEntries.push(entry);
    }

    return savedEntries;
  }

  /**
   * Recall memories relevant to a query within a namespace.
   */
  async recall(options: RecallOptions): Promise<MemoryResult[]> {
    const namespace = options.namespace ?? resolveNamespace();
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const queryEmbedding = await this.embeddings.embed(options.query);

    return this.store.search(queryEmbedding, {
      namespace,
      tags: options.tags,
      after: options.after,
      before: options.before,
      limit,
    });
  }

  /**
   * Search memories across all namespaces (cross-project).
   */
  async search(
    options: Omit<RecallOptions, "namespace">
  ): Promise<MemoryResult[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const queryEmbedding = await this.embeddings.embed(options.query);

    return this.store.search(queryEmbedding, {
      tags: options.tags,
      after: options.after,
      before: options.before,
      limit,
    });
  }

  /**
   * Delete a memory entry by ID.
   */
  async forget(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * List memory entries with optional filters.
   */
  async list(options: ListOptions): Promise<MemoryEntry[]> {
    const namespace = options.namespace ?? resolveNamespace();

    return this.store.list({
      namespace,
      tags: options.tags,
      limit: Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
      offset: options.offset ?? 0,
    });
  }

  /**
   * Count memory entries in a namespace.
   */
  async count(namespace?: string): Promise<number> {
    return this.store.count(namespace);
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
