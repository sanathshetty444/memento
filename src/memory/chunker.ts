/**
 * Content chunking for long text.
 * Splits content into overlapping chunks at natural boundaries.
 */

export interface ChunkOptions {
  /** Maximum words per chunk (default 500) */
  maxWords?: number;
  /** Overlap words from previous chunk's end (default 100) */
  overlapWords?: number;
  /** Word count threshold below which no chunking occurs (default 1000) */
  threshold?: number;
}

export interface ChunkResult {
  content: string;
  index: number;
  total: number;
}

const DEFAULT_MAX_WORDS = 500;
const DEFAULT_OVERLAP_WORDS = 100;
const DEFAULT_THRESHOLD = 1000;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function getWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Split text into segments at paragraph boundaries (double newlines).
 */
function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).filter((s) => s.trim().length > 0);
}

/**
 * Split text into segments at sentence boundaries.
 */
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

/**
 * Build chunks from an array of segments, respecting maxWords and overlapWords.
 * Returns the chunk strings (overlap is prepended from the previous chunk).
 */
function buildChunks(
  segments: string[],
  maxWords: number,
  overlapWords: number
): string[] {
  const chunks: string[] = [];
  let currentSegments: string[] = [];
  let currentWordCount = 0;

  for (const segment of segments) {
    const segWords = countWords(segment);

    if (currentWordCount + segWords > maxWords && currentSegments.length > 0) {
      // Flush current chunk
      chunks.push(currentSegments.join("\n\n"));

      // Compute overlap from the tail of the current chunk
      const allWords = getWords(currentSegments.join(" "));
      const overlapText =
        overlapWords > 0
          ? allWords.slice(-overlapWords).join(" ")
          : "";

      currentSegments = overlapText ? [overlapText] : [];
      currentWordCount = overlapText ? countWords(overlapText) : 0;
    }

    currentSegments.push(segment);
    currentWordCount += segWords;
  }

  // Flush remaining
  if (currentSegments.length > 0) {
    chunks.push(currentSegments.join("\n\n"));
  }

  return chunks;
}

/**
 * Chunk content into overlapping segments for storage.
 *
 * Strategy:
 * 1. If content is under the word threshold, return it as a single chunk.
 * 2. Split on paragraph boundaries first.
 * 3. If any paragraph exceeds maxWords, split it on sentence boundaries.
 * 4. If any sentence still exceeds maxWords, split on word boundaries.
 * 5. Assemble chunks with overlap from the previous chunk's tail.
 */
export function chunkContent(
  content: string,
  options?: ChunkOptions
): ChunkResult[] {
  const maxWords = options?.maxWords ?? DEFAULT_MAX_WORDS;
  const overlapWords = options?.overlapWords ?? DEFAULT_OVERLAP_WORDS;
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;

  // Short-circuit: content is small enough to be a single chunk
  if (countWords(content) <= threshold) {
    return [{ content, index: 0, total: 1 }];
  }

  // Step 1: paragraph-level segments
  let segments = splitParagraphs(content);

  // Step 2: break oversized paragraphs into sentences
  segments = segments.flatMap((seg) => {
    if (countWords(seg) > maxWords) {
      return splitSentences(seg);
    }
    return [seg];
  });

  // Step 3: break oversized sentences into word-level spans
  segments = segments.flatMap((seg) => {
    if (countWords(seg) > maxWords) {
      const words = getWords(seg);
      const spans: string[] = [];
      for (let i = 0; i < words.length; i += maxWords) {
        spans.push(words.slice(i, i + maxWords).join(" "));
      }
      return spans;
    }
    return [seg];
  });

  const rawChunks = buildChunks(segments, maxWords, overlapWords);

  return rawChunks.map((c, i) => ({
    content: c,
    index: i,
    total: rawChunks.length,
  }));
}
