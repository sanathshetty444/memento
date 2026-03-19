/**
 * Background queue worker that processes captured tool-use entries.
 *
 * Pipeline per entry: redact → tag → chunk → embed → dedup → store
 *
 * Can be run standalone:  node dist/hooks/queue-worker.js
 * Or imported and called: import { processQueue } from "./hooks/queue-worker.js"
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { redact } from "../memory/redactor.js";
import { autoTag } from "../memory/tagger.js";
import { chunkContent } from "../memory/chunker.js";
import { resolveNamespace } from "../memory/namespace.js";
import { contentHash, isDuplicate } from "../memory/dedup.js";
import { loadConfig } from "../config.js";
import { createStore } from "../storage/index.js";
import { createEmbeddingProvider } from "../embeddings/index.js";
import type { VectorStore } from "../storage/interface.js";
import type { EmbeddingProvider } from "../embeddings/interface.js";
import type { MemoryEntry, MemorySource } from "../memory/types.js";

interface QueueEntry {
  timestamp: string;
  toolName: string;
  content: string;
  sessionId: string;
}

const BATCH_SIZE = 20;

function getDataDir(): string {
  return join(homedir(), ".claude-memory");
}

function getQueuePath(): string {
  return join(getDataDir(), "capture-queue.jsonl");
}

function getLockPath(): string {
  return join(getDataDir(), ".processing");
}

/**
 * Acquire a lockfile to prevent concurrent processing.
 * Returns true if lock was acquired, false if another worker holds it.
 */
function acquireLock(): boolean {
  const lockPath = getLockPath();

  if (existsSync(lockPath)) {
    // Check if the lock is stale (older than 5 minutes)
    try {
      const lockContent = readFileSync(lockPath, "utf-8").trim();
      const lockTime = parseInt(lockContent, 10);
      const staleMs = 5 * 60 * 1000;
      if (Date.now() - lockTime < staleMs) {
        return false; // Lock is fresh — another worker is active
      }
      // Lock is stale — remove and take over
    } catch {
      // Corrupt lock file — remove it
    }
  }

  try {
    writeFileSync(lockPath, String(Date.now()), { flag: "wx" });
    return true;
  } catch {
    // wx flag fails if file was created between our check and write — that's fine
    // Overwrite stale lock
    try {
      writeFileSync(lockPath, String(Date.now()));
      return true;
    } catch {
      return false;
    }
  }
}

function releaseLock(): void {
  try {
    unlinkSync(getLockPath());
  } catch {
    // Ignore — lock may already be gone
  }
}

/**
 * Read all entries from the queue file, parse valid JSON lines.
 */
function readQueue(): QueueEntry[] {
  const queuePath = getQueuePath();
  if (!existsSync(queuePath)) {
    return [];
  }

  const raw = readFileSync(queuePath, "utf-8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);

  const entries: QueueEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as QueueEntry);
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

/**
 * Remove processed entries from the queue file.
 * Rewrites the file with only the remaining (unprocessed) lines.
 */
function removeProcessedEntries(processedCount: number): void {
  const queuePath = getQueuePath();
  if (!existsSync(queuePath)) return;

  const raw = readFileSync(queuePath, "utf-8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);

  const remaining = lines.slice(processedCount);
  if (remaining.length === 0) {
    unlinkSync(queuePath);
  } else {
    writeFileSync(queuePath, remaining.join("\n") + "\n");
  }
}

/**
 * Determine the memory source tag from the tool name.
 */
function sourceFromToolName(toolName: string): MemorySource {
  if (toolName === "__session_end__") {
    return "hook:stop";
  }
  return "hook:post_tool_use";
}

/**
 * Process a single queue entry through the full pipeline:
 *   redact → tag → chunk → embed → dedup → store
 */
async function processEntry(
  entry: QueueEntry,
  store: VectorStore,
  embedder: EmbeddingProvider,
  namespace: string,
): Promise<number> {
  // Step 1: Redact sensitive data
  const redacted = redact(entry.content);

  // Step 2: Auto-tag based on content
  const tags = autoTag(redacted);

  // Step 3: Chunk if content is long
  const config = loadConfig();
  const chunks = chunkContent(redacted, {
    maxWords: config.memory.chunkSize,
    overlapWords: config.memory.chunkOverlap,
  });

  let storedCount = 0;
  const parentId = randomUUID();

  for (const chunk of chunks) {
    // Step 4: Generate embedding
    const embedding = await embedder.embed(chunk.content);

    // Step 5: Dedup check — query store for similar entries
    const hash = contentHash(chunk.content);
    const similar = await store.search(embedding, {
      namespace,
      limit: 5,
    });

    const existingEntries = similar.map((r) => ({
      id: r.entry.id,
      contentHash: r.entry.contentHash,
      embedding: r.entry.embedding,
    }));

    const dupResult = isDuplicate(hash, embedding, existingEntries);

    if (dupResult.exact || dupResult.similar) {
      continue; // Skip duplicates
    }

    // Step 6: Store the memory entry
    const memoryEntry: MemoryEntry = {
      id: chunks.length > 1 ? `${parentId}_chunk${chunk.index}` : parentId,
      content: chunk.content,
      embedding,
      contentHash: hash,
      parentId: chunks.length > 1 ? parentId : undefined,
      metadata: {
        namespace,
        tags,
        timestamp: entry.timestamp,
        source: sourceFromToolName(entry.toolName),
        sessionId: entry.sessionId,
        summary:
          chunks.length > 1
            ? `Chunk ${chunk.index + 1}/${chunk.total}`
            : undefined,
      },
    };

    await store.upsert(memoryEntry);
    storedCount++;
  }

  return storedCount;
}

/**
 * Process all pending entries in the capture queue.
 *
 * Exported for use by the MCP server or any other caller.
 * Returns the number of entries successfully processed.
 */
export async function processQueue(): Promise<number> {
  const dataDir = getDataDir();
  mkdirSync(dataDir, { recursive: true });

  if (!acquireLock()) {
    return 0; // Another worker is processing
  }

  try {
    const entries = readQueue();
    if (entries.length === 0) {
      return 0;
    }

    // Initialize storage and embeddings from config
    const config = loadConfig();
    const store = await createStore({
      type: config.store.type,
      chromadb: { path: config.store.chromaPath },
    });
    const embedder = await createEmbeddingProvider({
      type: config.embeddings.provider,
      local: { modelPath: config.embeddings.model },
    });

    const namespace = resolveNamespace();
    const batch = entries.slice(0, BATCH_SIZE);
    let totalStored = 0;

    for (const entry of batch) {
      try {
        const stored = await processEntry(entry, store, embedder, namespace);
        totalStored += stored;
      } catch (err) {
        // Log but continue processing remaining entries
        console.error(
          `[queue-worker] Failed to process entry (${entry.toolName}):`,
          err,
        );
      }
    }

    // Remove processed entries from the queue
    removeProcessedEntries(batch.length);

    // Clean up
    await store.close();

    return totalStored;
  } finally {
    releaseLock();
  }
}

// Allow standalone execution: node dist/hooks/queue-worker.js
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("queue-worker.js") ||
    process.argv[1].endsWith("queue-worker.ts"));

if (isMain) {
  processQueue()
    .then((count) => {
      console.log(`[queue-worker] Processed and stored ${count} entries.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[queue-worker] Fatal error:", err);
      process.exit(1);
    });
}
