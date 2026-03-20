/**
 * Memory compaction module.
 * Handles TTL expiry, near-duplicate merging, and max-size eviction
 * to keep namespaces lean and relevant.
 */

import type { VectorStore } from "../storage/interface.js";
import type { MemoryEntry } from "./types.js";
import { cosineSimilarity } from "./dedup.js";

const PAGE_SIZE = 100;
const MERGE_BATCH_LIMIT = 500;
const DEFAULT_TTL_DAYS = 180;
const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_SIMILARITY_THRESHOLD = 0.92;

export interface CompactionOptions {
  namespace: string;
  ttlDays?: number;
  maxEntries?: number;
  similarityThreshold?: number;
  dryRun?: boolean;
}

export interface CompactionResult {
  expired: number;
  merged: number;
  evicted: number;
  total: number;
  remaining: number;
}

/**
 * Paginate through all entries in a namespace.
 * Fetches PAGE_SIZE entries at a time to avoid loading everything at once.
 */
async function listAll(store: VectorStore, namespace: string): Promise<MemoryEntry[]> {
  const entries: MemoryEntry[] = [];
  let offset = 0;

  while (true) {
    const page = await store.list({ namespace, limit: PAGE_SIZE, offset });
    entries.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return entries;
}

/**
 * Parse a timestamp string into epoch ms.
 * Returns 0 for unparseable values so they sort as oldest.
 */
function toEpoch(timestamp: string): number {
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Run compaction on a single namespace.
 *
 * Phases run in order:
 *   1. TTL expiry — remove stale entries
 *   2. Near-duplicate merge — collapse similar entries, keeping the newest
 *   3. Max-size eviction — trim to maxEntries, oldest first
 */
export async function compactMemories(
  store: VectorStore,
  options: CompactionOptions,
): Promise<CompactionResult> {
  const {
    namespace,
    ttlDays = DEFAULT_TTL_DAYS,
    maxEntries = DEFAULT_MAX_ENTRIES,
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    dryRun = false,
  } = options;

  const result: CompactionResult = {
    expired: 0,
    merged: 0,
    evicted: 0,
    total: 0,
    remaining: 0,
  };

  // Load every entry in the namespace (paginated)
  const allEntries = await listAll(store, namespace);
  result.total = allEntries.length;

  if (allEntries.length === 0) {
    return result;
  }

  // ------------------------------------------------------------------
  // Phase 1 — TTL expiry
  // ------------------------------------------------------------------
  const cutoffMs = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
  const expiredIds = new Set<string>();

  for (const entry of allEntries) {
    if (toEpoch(entry.metadata.timestamp) < cutoffMs) {
      expiredIds.add(entry.id);
    }
  }

  if (!dryRun) {
    for (const id of expiredIds) {
      await store.delete(id);
    }
  }
  result.expired = expiredIds.size;

  // Build the surviving set after TTL
  let surviving = allEntries.filter((e) => !expiredIds.has(e.id));

  // ------------------------------------------------------------------
  // Phase 2 — Near-duplicate merge
  // ------------------------------------------------------------------
  // To stay practical we only compare the most recent MERGE_BATCH_LIMIT
  // entries pairwise. Entries are sorted newest-first so that when a
  // duplicate pair is found we naturally keep the newer one.
  // ------------------------------------------------------------------

  // Sort newest first
  surviving.sort((a, b) => toEpoch(b.metadata.timestamp) - toEpoch(a.metadata.timestamp));

  const candidates = surviving.slice(0, MERGE_BATCH_LIMIT);
  const mergedIds = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    const newer = candidates[i];
    if (mergedIds.has(newer.id)) continue;
    if (!newer.embedding || newer.embedding.length === 0) continue;

    for (let j = i + 1; j < candidates.length; j++) {
      const older = candidates[j];
      if (mergedIds.has(older.id)) continue;
      if (!older.embedding || older.embedding.length === 0) continue;

      const sim = cosineSimilarity(newer.embedding, older.embedding);
      if (sim >= similarityThreshold) {
        // Mark the older entry for deletion
        mergedIds.add(older.id);

        // Link the deleted entry's id into the kept entry's relatedMemoryIds
        if (!dryRun) {
          const related = newer.metadata.relatedMemoryIds ?? [];
          if (!related.includes(older.id)) {
            related.push(older.id);
          }
          newer.metadata.relatedMemoryIds = related;
          await store.upsert(newer);
        }
      }
    }
  }

  // Delete merged entries
  if (!dryRun) {
    for (const id of mergedIds) {
      await store.delete(id);
    }
  }
  result.merged = mergedIds.size;

  // Rebuild surviving list
  surviving = surviving.filter((e) => !mergedIds.has(e.id));

  // ------------------------------------------------------------------
  // Phase 3 — Max-size eviction
  // ------------------------------------------------------------------
  if (surviving.length > maxEntries) {
    // Sort oldest first so we can pop from the front
    surviving.sort((a, b) => toEpoch(a.metadata.timestamp) - toEpoch(b.metadata.timestamp));

    const excess = surviving.length - maxEntries;
    const toEvict = surviving.slice(0, excess);

    if (!dryRun) {
      for (const entry of toEvict) {
        await store.delete(entry.id);
      }
    }
    result.evicted = toEvict.length;
    surviving = surviving.slice(excess);
  }

  result.remaining = surviving.length;
  return result;
}
