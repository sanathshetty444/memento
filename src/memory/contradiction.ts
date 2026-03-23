/**
 * Contradiction detection for memory entries.
 * Detects when new content contradicts (supersedes) existing memories
 * using negation patterns, temporal signals, and shared metadata.
 */

export interface ContradictionResult {
  contradictedId: string;
  confidence: number;
  reason: string;
}

interface ExistingEntry {
  id: string;
  content: string;
  tags: string[];
  files?: string[];
  score: number;
}

/** Negation patterns that signal the new content overrides something. */
const NEGATION_PATTERNS: RegExp[] = [
  /\bno longer\b/i,
  /\binstead\b/i,
  /\bremoved\b/i,
  /\breplaced\b/i,
  /\bdeprecated\b/i,
  /\bswitched from\b/i,
  /\bchanged from\b/i,
  /\bwe decided not to\b/i,
  /\bdon'?t use\b/i,
  /\bstopped using\b/i,
  /\bmigrated away\b/i,
  /\breverted\b/i,
];

/** Temporal signals that indicate an update or evolution. */
const TEMPORAL_PATTERNS: RegExp[] = [
  /\bwe changed\b/i,
  /\bwe now use\b/i,
  /\bupdated to\b/i,
  /\bmoved to\b/i,
];

function hasNegationPattern(text: string): boolean {
  return NEGATION_PATTERNS.some((p) => p.test(text));
}

function hasTemporalSignal(text: string): boolean {
  return TEMPORAL_PATTERNS.some((p) => p.test(text));
}

function sharedCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item)).length;
}

/**
 * Detect if newContent contradicts any of the existing entries.
 * Returns the highest-confidence contradiction (if confidence >= 0.5), or null.
 */
export function detectContradiction(
  newContent: string,
  existingEntries: ExistingEntry[],
): ContradictionResult | null {
  const negationFound = hasNegationPattern(newContent);
  const temporalFound = hasTemporalSignal(newContent);

  // Early exit: no contradiction signals at all
  if (!negationFound && !temporalFound) {
    return null;
  }

  let best: ContradictionResult | null = null;

  for (const entry of existingEntries) {
    // Only consider entries with high cosine similarity
    if (entry.score < 0.7) {
      continue;
    }

    let confidence = 0;
    const reasons: string[] = [];

    if (negationFound) {
      confidence += 0.5;
      reasons.push("negation pattern detected");
    }

    if (entry.tags.length > 0) {
      // We don't have the new entry's tags here yet, but we can check
      // if the existing entry has tags — shared tags boost comes from
      // comparing with the new content's tags passed externally.
      // For now, this is handled via the overload below.
    }

    if (temporalFound) {
      confidence += 0.1;
      reasons.push("temporal signal detected");
    }

    if (confidence >= 0.5 && (best === null || confidence > best.confidence)) {
      best = {
        contradictedId: entry.id,
        confidence,
        reason: reasons.join("; "),
      };
    }
  }

  return best;
}

/**
 * Enhanced contradiction detection that also considers shared tags and files.
 */
export function detectContradictionWithContext(
  newContent: string,
  newTags: string[],
  newFiles: string[] | undefined,
  existingEntries: ExistingEntry[],
): ContradictionResult | null {
  const negationFound = hasNegationPattern(newContent);
  const temporalFound = hasTemporalSignal(newContent);

  // Early exit: no contradiction signals at all
  if (!negationFound && !temporalFound) {
    return null;
  }

  let best: ContradictionResult | null = null;

  for (const entry of existingEntries) {
    if (entry.score < 0.7) {
      continue;
    }

    let confidence = 0;
    const reasons: string[] = [];

    if (negationFound) {
      confidence += 0.5;
      reasons.push("negation pattern detected");
    }

    if (newTags.length > 0 && entry.tags.length > 0 && sharedCount(newTags, entry.tags) > 0) {
      confidence += 0.2;
      reasons.push("shared tags");
    }

    if (
      newFiles &&
      newFiles.length > 0 &&
      entry.files &&
      entry.files.length > 0 &&
      sharedCount(newFiles, entry.files) > 0
    ) {
      confidence += 0.2;
      reasons.push("shared files");
    }

    if (temporalFound) {
      confidence += 0.1;
      reasons.push("temporal signal detected");
    }

    if (confidence >= 0.5 && (best === null || confidence > best.confidence)) {
      best = {
        contradictedId: entry.id,
        confidence,
        reason: reasons.join("; "),
      };
    }
  }

  return best;
}
