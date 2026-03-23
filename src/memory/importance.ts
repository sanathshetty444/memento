/**
 * Importance scoring and decay for memory entries.
 *
 * - `calculateImportance` produces a 0–1 score at save time based on
 *   source, tags, and priority.
 * - `effectiveImportance` applies exponential decay so older memories
 *   naturally lose weight over time (half-life ≈ 347 days).
 */

import type { MemorySource, MemoryTag, MemoryPriority } from "./types.js";

// ── Weight tables ────────────────────────────────────────────────────

const SOURCE_WEIGHTS: Record<MemorySource, number> = {
  explicit: 1.0,
  "hook:stop": 0.7,
  "hook:post_tool_use": 0.5,
  import: 0.8,
};

const TAG_WEIGHTS: Record<string, number> = {
  decision: 1.0,
  architecture: 1.0,
  error: 0.9,
  config: 0.8,
  dependency: 0.7,
  code: 0.7,
  todo: 0.6,
  conversation: 0.4,
};

const PRIORITY_WEIGHTS: Record<MemoryPriority, number> = {
  high: 1.0,
  normal: 0.7,
  low: 0.4,
};

// Default weight for tags not in TAG_WEIGHTS
const DEFAULT_TAG_WEIGHT = 0.5;

// ── Public API ───────────────────────────────────────────────────────

/**
 * Calculate a 0–1 importance score for a memory entry at save time.
 *
 * `importance = sourceWeight × max(tagWeights) × priorityWeight`, clamped to [0, 1].
 */
export function calculateImportance(
  source: MemorySource,
  tags: MemoryTag[],
  priority?: MemoryPriority,
): number {
  const sourceWeight = SOURCE_WEIGHTS[source] ?? 0.5;

  const tagWeight =
    tags.length > 0
      ? Math.max(...tags.map((t) => TAG_WEIGHTS[t] ?? DEFAULT_TAG_WEIGHT))
      : DEFAULT_TAG_WEIGHT;

  const priorityWeight = PRIORITY_WEIGHTS[priority ?? "normal"];

  return Math.min(1, Math.max(0, sourceWeight * tagWeight * priorityWeight));
}

/**
 * Apply exponential decay to an importance score.
 *
 * Uses a daily decay factor of 0.998 which gives a half-life of
 * ~347 days (`ln(2) / ln(1/0.998) ≈ 346.2`).
 */
export function effectiveImportance(importance: number, timestamp: string): number {
  const daysSinceSave = (Date.now() - Date.parse(timestamp)) / (1000 * 60 * 60 * 24);
  return importance * Math.pow(0.998, Math.max(0, daysSinceSave));
}
