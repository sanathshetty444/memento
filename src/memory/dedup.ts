/**
 * Deduplication utilities for memory entries.
 * Provides content hashing, cosine similarity, and duplicate detection.
 */

const SIMILARITY_THRESHOLD = 0.92;

/**
 * Compute a SHA-256 hash of normalized content.
 * Normalization: trim, lowercase, collapse whitespace.
 * Uses Web Crypto API as primary, Node.js crypto as fallback.
 */
export async function contentHash(content: string): Promise<string> {
  const normalized = content.trim().toLowerCase().replace(/\s+/g, " ");
  const data = new TextEncoder().encode(normalized);

  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;

  return dot / magnitude;
}

interface ExistingEntry {
  contentHash: string;
  embedding?: number[];
}

interface DuplicateResult {
  exact: boolean;
  similar: boolean;
  similarId?: string;
}

/**
 * Check whether content is a duplicate of any existing entry.
 *
 * 1. Exact match: the content hash matches an existing entry's hash.
 * 2. Similar match: cosine similarity of embeddings >= 0.92.
 *
 * Returns which kind of duplicate was found (if any) and the ID of the
 * similar entry when applicable.
 */
export function isDuplicate(
  hash: string,
  embedding: number[],
  existingEntries: Array<ExistingEntry & { id?: string }>,
  threshold: number = SIMILARITY_THRESHOLD,
): DuplicateResult {
  // Check exact hash match
  for (const entry of existingEntries) {
    if (entry.contentHash === hash) {
      return { exact: true, similar: false };
    }
  }

  // Check cosine similarity
  if (embedding.length > 0) {
    for (const entry of existingEntries) {
      if (entry.embedding && entry.embedding.length > 0) {
        const similarity = cosineSimilarity(embedding, entry.embedding);
        if (similarity >= threshold) {
          return {
            exact: false,
            similar: true,
            similarId: entry.id,
          };
        }
      }
    }
  }

  return { exact: false, similar: false };
}
