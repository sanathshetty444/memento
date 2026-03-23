/**
 * Local file-based vector store.
 * Zero-config, zero-dependency — stores entries as JSON files with brute-force
 * cosine similarity search. Works offline, no server required.
 *
 * Storage layout:
 *   <dataDir>/
 *     <namespace>/
 *       <id>.json   — one MemoryEntry per file
 */

import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MemoryEntry, MemoryResult, MemoryTag } from "../memory/types.js";
import type { VectorStore, SearchFilters, ListFilters } from "./interface.js";
import { cosineSimilarity } from "../memory/dedup.js";
import { HNSWIndex } from "./hnsw.js";

/* ── BM25 helpers ────────────────────────────────────────────────── */

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const HYBRID_ALPHA = 0.7; // weight for cosine in hybrid mode

/** Lowercase tokenizer: split on non-alphanumeric, drop tokens ≤ 1 char. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/**
 * Compute BM25 score for a single document against a query.
 *
 * @param queryTokens  – pre-tokenized query
 * @param docTokens    – pre-tokenized document
 * @param avgDl        – average document length across the corpus
 * @param N            – total number of documents in the corpus
 * @param df           – document-frequency map (term → number of docs containing it)
 */
function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDl: number,
  N: number,
  df: Map<string, number>,
): number {
  const dl = docTokens.length;
  // Build term-frequency map for this document
  const tf = new Map<string, number>();
  for (const t of docTokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }

  let score = 0;
  for (const term of queryTokens) {
    const termFreq = tf.get(term) ?? 0;
    if (termFreq === 0) continue;

    const docFreq = df.get(term) ?? 0;
    // IDF with smoothing to avoid negative values
    const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);
    const numerator = termFreq * (BM25_K1 + 1);
    const denominator = termFreq + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avgDl));
    score += idf * (numerator / denominator);
  }

  return score;
}

/* ── End BM25 helpers ────────────────────────────────────────────── */

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

const HNSW_INDEX_FILE = "_hnsw.bin";
const HNSW_PERSIST_INTERVAL = 100; // persist every N inserts

export class LocalFileAdapter implements VectorStore {
  private readonly dataDir: string;
  private hnswIndex: HNSWIndex | null = null;
  private hnswDirty = 0; // count of mutations since last persist

  constructor(config: { path: string }) {
    this.dataDir = config.path.replace(/^~/, homedir());
  }

  async initialize(): Promise<void> {
    mkdirSync(this.dataDir, { recursive: true });

    // Try to load existing HNSW index
    const indexPath = join(this.dataDir, HNSW_INDEX_FILE);
    if (existsSync(indexPath)) {
      try {
        const data = readFileSync(indexPath);
        this.hnswIndex = HNSWIndex.deserialize(data);
      } catch {
        // Corrupted index — will be rebuilt on demand
        this.hnswIndex = null;
      }
    }
  }

  private namespacePath(namespace: string): string {
    return join(this.dataDir, sanitizeName(namespace));
  }

  private entryPath(namespace: string, id: string): string {
    return join(this.namespacePath(namespace), `${id}.json`);
  }

  private ensureNamespaceDir(namespace: string): void {
    mkdirSync(this.namespacePath(namespace), { recursive: true });
  }

  private readEntry(filePath: string): MemoryEntry | null {
    try {
      return JSON.parse(readFileSync(filePath, "utf-8")) as MemoryEntry;
    } catch {
      return null;
    }
  }

  private listNamespaces(): string[] {
    if (!existsSync(this.dataDir)) return [];
    return readdirSync(this.dataDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  private readAllEntries(namespace: string): MemoryEntry[] {
    const dir = this.namespacePath(namespace);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    const entries: MemoryEntry[] = [];
    for (const file of files) {
      const entry = this.readEntry(join(dir, file));
      if (entry?.metadata) entries.push(entry);
    }
    return entries;
  }

  async upsert(entry: MemoryEntry): Promise<void> {
    this.ensureNamespaceDir(entry.metadata.namespace);
    const path = this.entryPath(entry.metadata.namespace, entry.id);
    writeFileSync(path, JSON.stringify(entry, null, 2), "utf-8");

    // Update HNSW index if available and entry has an embedding
    if (this.hnswIndex && entry.embedding && entry.embedding.length > 0) {
      try {
        this.hnswIndex.insert(entry.id, entry.embedding);
        this.hnswDirty++;
        if (this.hnswDirty >= HNSW_PERSIST_INTERVAL) {
          this.persistHnswIndex();
        }
      } catch {
        // Non-fatal: index will be rebuilt if corrupted
      }
    }
  }

  async search(queryEmbedding: number[], filters: SearchFilters): Promise<MemoryResult[]> {
    const namespaces = filters.namespace
      ? [sanitizeName(filters.namespace)]
      : this.listNamespaces();

    const mode = filters.searchMode ?? "vector";

    // Collect all matching entries first (needed for BM25 corpus stats)
    const matchedEntries: MemoryEntry[] = [];
    for (const ns of namespaces) {
      const entries = this.readAllEntries(ns);
      for (const entry of entries) {
        if (!this.matchesFilters(entry, filters)) continue;
        matchedEntries.push(entry);
      }
    }

    // Pure vector mode — use HNSW if available, otherwise brute force
    if (mode === "vector") {
      // Try HNSW fast path: only when no tag/date filters and namespace is not restricting
      // (HNSW is a global index across all entries)
      const hasMetadataFilters =
        (filters.tags && filters.tags.length > 0) || filters.after || filters.before;
      if (this.hnswIndex && this.hnswIndex.size() > 0 && !hasMetadataFilters) {
        try {
          // Retrieve more candidates than needed to account for namespace filtering
          const overFetch = filters.namespace ? filters.limit * 3 : filters.limit;
          const hnswResults = this.hnswIndex.search(queryEmbedding, overFetch);

          // Build a set of valid IDs from matchedEntries for fast lookup
          const validIds = new Set(matchedEntries.map((e) => e.id));
          const entryMap = new Map(matchedEntries.map((e) => [e.id, e]));

          const scored: MemoryResult[] = [];
          for (const r of hnswResults) {
            if (!validIds.has(r.id)) continue;
            const entry = entryMap.get(r.id)!;
            scored.push({ entry, score: r.score });
            if (scored.length >= filters.limit) break;
          }

          // If HNSW returned enough results, use them
          if (scored.length >= filters.limit || scored.length >= matchedEntries.length) {
            return scored;
          }
          // Otherwise fall through to brute force
        } catch {
          // HNSW corrupted — fall through to brute force
        }
      }

      const scored: MemoryResult[] = [];
      for (const entry of matchedEntries) {
        const score = entry.embedding ? cosineSimilarity(queryEmbedding, entry.embedding) : 0;
        scored.push({ entry, score });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, filters.limit);
    }

    // keyword / hybrid modes require query text for BM25
    const queryText = filters.query ?? "";
    const queryTokens = tokenize(queryText);

    // If no query text available, fall back to vector-only
    if (queryTokens.length === 0) {
      const scored: MemoryResult[] = [];
      for (const entry of matchedEntries) {
        const score = entry.embedding ? cosineSimilarity(queryEmbedding, entry.embedding) : 0;
        scored.push({ entry, score });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, filters.limit);
    }

    // Pre-tokenize all documents and compute corpus-level stats for BM25
    const N = matchedEntries.length;
    const docTokensList: string[][] = matchedEntries.map((e) => tokenize(e.content));
    const avgDl = N > 0 ? docTokensList.reduce((sum, t) => sum + t.length, 0) / N : 1;

    // Document frequency: how many documents contain each query term
    const df = new Map<string, number>();
    for (const term of new Set(queryTokens)) {
      let count = 0;
      for (const docTokens of docTokensList) {
        if (docTokens.includes(term)) count++;
      }
      df.set(term, count);
    }

    // Compute BM25 scores and optionally cosine scores
    const bm25Scores: number[] = matchedEntries.map((_, i) =>
      bm25Score(queryTokens, docTokensList[i], avgDl, N, df),
    );

    // Normalize BM25 scores to [0, 1]
    const maxBm25 = Math.max(...bm25Scores, 1e-9);
    const normBm25 = bm25Scores.map((s) => s / maxBm25);

    const scored: MemoryResult[] = [];

    for (let i = 0; i < matchedEntries.length; i++) {
      const entry = matchedEntries[i];

      if (mode === "keyword") {
        scored.push({ entry, score: normBm25[i] });
      } else {
        // hybrid: weighted combination
        const cosine = entry.embedding ? cosineSimilarity(queryEmbedding, entry.embedding) : 0;
        const finalScore = HYBRID_ALPHA * cosine + (1 - HYBRID_ALPHA) * normBm25[i];
        scored.push({ entry, score: finalScore });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, filters.limit);
  }

  async delete(id: string): Promise<boolean> {
    for (const ns of this.listNamespaces()) {
      const path = join(this.namespacePath(ns), `${id}.json`);
      if (existsSync(path)) {
        unlinkSync(path);

        // Remove from HNSW index
        if (this.hnswIndex) {
          try {
            this.hnswIndex.remove(id);
            this.hnswDirty++;
            if (this.hnswDirty >= HNSW_PERSIST_INTERVAL) {
              this.persistHnswIndex();
            }
          } catch {
            // Non-fatal
          }
        }

        return true;
      }
    }
    return false;
  }

  async list(filters: ListFilters): Promise<MemoryEntry[]> {
    const namespaces = filters.namespace
      ? [sanitizeName(filters.namespace)]
      : this.listNamespaces();

    const all: MemoryEntry[] = [];
    for (const ns of namespaces) {
      const entries = this.readAllEntries(ns);
      for (const entry of entries) {
        if (this.matchesListFilters(entry, filters)) {
          all.push(entry);
        }
      }
    }

    all.sort((a, b) => {
      const ta = a.metadata?.timestamp ? new Date(a.metadata.timestamp).getTime() : 0;
      const tb = b.metadata?.timestamp ? new Date(b.metadata.timestamp).getTime() : 0;
      return tb - ta;
    });
    return all.slice(filters.offset, filters.offset + filters.limit);
  }

  async count(namespace?: string): Promise<number> {
    const namespaces = namespace ? [sanitizeName(namespace)] : this.listNamespaces();

    let total = 0;
    for (const ns of namespaces) {
      const dir = this.namespacePath(ns);
      if (existsSync(dir)) {
        total += readdirSync(dir).filter((f) => f.endsWith(".json")).length;
      }
    }
    return total;
  }

  async close(): Promise<void> {
    // Persist HNSW index if dirty before closing
    if (this.hnswIndex && this.hnswDirty > 0) {
      this.persistHnswIndex();
    }
  }

  /**
   * Rebuild the HNSW index from all entries across all namespaces.
   * Call this after bulk imports or if the index is corrupted.
   */
  async rebuildIndex(): Promise<void> {
    const entries: Array<{ id: string; vector: number[] }> = [];
    for (const ns of this.listNamespaces()) {
      for (const entry of this.readAllEntries(ns)) {
        if (entry.embedding && entry.embedding.length > 0) {
          entries.push({ id: entry.id, vector: entry.embedding });
        }
      }
    }

    this.hnswIndex = HNSWIndex.fromEntries(entries);
    this.persistHnswIndex();
  }

  private persistHnswIndex(): void {
    if (!this.hnswIndex) return;
    try {
      const indexPath = join(this.dataDir, HNSW_INDEX_FILE);
      writeFileSync(indexPath, this.hnswIndex.serialize());
      this.hnswDirty = 0;
    } catch {
      // Non-fatal: index can be rebuilt
    }
  }

  private matchesFilters(entry: MemoryEntry, filters: SearchFilters): boolean {
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
