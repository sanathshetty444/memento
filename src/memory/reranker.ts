/**
 * Result reranker for Memento.
 * Applies multiplicative scoring factors on top of base vector similarity scores
 * to boost results by recency, source quality, tag relevance, access frequency, and priority.
 */

import type { MemoryResult, MemorySource, MemoryPriority, MemoryTag } from "./types.js";

/**
 * Compute a recency factor based on how many days since the entry was saved.
 * Newer memories get a higher boost (max 1.0 for today, decays exponentially).
 */
function recencyFactor(timestamp: string): number {
  const now = Date.now();
  const saved = new Date(timestamp).getTime();
  const daysSinceSave = Math.max(0, (now - saved) / (1000 * 60 * 60 * 24));
  return Math.exp(-daysSinceSave / 365);
}

/**
 * Source quality weight — explicit saves are most valuable,
 * hook:stop captures are moderately valuable, hook:post_tool_use least.
 */
function sourceQualityFactor(source: MemorySource): number {
  switch (source) {
    case "explicit":
      return 1.0;
    case "hook:stop":
      return 0.8;
    case "hook:post_tool_use":
      return 0.6;
    default:
      return 1.0;
  }
}

/**
 * Tag relevance — decision/architecture tags indicate high-value content,
 * error tags are moderately valuable, conversation tags are lower value.
 * Uses the highest applicable multiplier (not cumulative).
 */
function tagRelevanceFactor(tags: MemoryTag[]): number {
  let factor = 1.0;

  for (const tag of tags) {
    if (tag === "decision" || tag === "architecture") {
      factor = Math.max(factor, 1.2);
    } else if (tag === "error") {
      factor = Math.max(factor, 1.1);
    } else if (tag === "conversation") {
      factor = Math.min(factor, 0.8);
    }
  }

  return factor;
}

/**
 * Access frequency — frequently accessed memories get a logarithmic boost.
 */
function accessFrequencyFactor(accessCount?: number): number {
  return 1 + Math.log1p(accessCount ?? 0) * 0.1;
}

/**
 * Priority boost — high priority entries are strongly boosted, low priority demoted.
 */
function priorityFactor(priority?: MemoryPriority): number {
  switch (priority) {
    case "high":
      return 1.3;
    case "low":
      return 0.7;
    case "normal":
    default:
      return 1.0;
  }
}

/**
 * Rerank a set of memory results by applying multiplicative scoring factors
 * on top of the base similarity score. Returns a new array sorted descending
 * by reranked score.
 */
export function rerank(results: MemoryResult[], _query?: string): MemoryResult[] {
  const reranked = results.map((result) => {
    const { entry, score: baseScore } = result;
    const meta = entry.metadata;

    const rerankedScore =
      baseScore *
      recencyFactor(meta.timestamp) *
      sourceQualityFactor(meta.source) *
      tagRelevanceFactor(meta.tags) *
      accessFrequencyFactor(meta.accessCount) *
      priorityFactor(meta.priority);

    return { entry, score: rerankedScore };
  });

  reranked.sort((a, b) => b.score - a.score);

  return reranked;
}
