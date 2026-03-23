/**
 * File watcher for Memento — auto-ingests files from an inbox directory.
 *
 * Watches ~/.claude-memory/inbox/ for new files and processes them into memory.
 * Supported formats: .md, .txt, .json, .jsonl, .csv
 * Processed files are moved to ~/.claude-memory/inbox/processed/
 */

import { existsSync, mkdirSync, readFileSync, renameSync, readdirSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join, extname, basename } from "node:path";
import type { MemoryManager } from "./memory/memory-manager.js";

const INBOX_DIR = join(homedir(), ".claude-memory", "inbox");
const PROCESSED_DIR = join(INBOX_DIR, "processed");

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".json", ".jsonl", ".csv"]);

const DEBOUNCE_MS = 500;

function log(msg: string): void {
  process.stderr.write(`[memento-watcher] ${msg}\n`);
}

/**
 * Auto-detect tags from content by scanning for built-in tag keywords.
 */
function autoDetectTags(content: string): string[] {
  const tags: string[] = [];
  const lower = content.toLowerCase();

  const tagKeywords: Record<string, string[]> = {
    decision: ["decision", "decided", "chose", "chosen"],
    architecture: ["architecture", "design", "pattern", "structure"],
    error: ["error", "bug", "fix", "issue", "crash"],
    config: ["config", "configuration", "setting", "environment"],
    dependency: ["dependency", "package", "library", "module", "import"],
    todo: ["todo", "fixme", "hack", "xxx"],
    code: ["function", "class", "interface", "implement"],
    conversation: ["discussed", "conversation", "meeting", "agreed"],
  };

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : ["conversation"];
}

/**
 * Process a single file and save its content as memory entries.
 */
async function processFile(filePath: string, manager: MemoryManager): Promise<number> {
  const ext = extname(filePath).toLowerCase();
  const raw = readFileSync(filePath, "utf-8");
  let saved = 0;

  switch (ext) {
    case ".md":
    case ".txt": {
      const tags = autoDetectTags(raw);
      await manager.save({
        content: raw,
        tags,
        source: "import",
        summary: `Ingested from inbox: ${basename(filePath)}`,
      });
      saved = 1;
      break;
    }

    case ".json": {
      try {
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          const content =
            typeof item === "string" ? item : item.content || item.text || JSON.stringify(item);
          const tags = item.tags ?? autoDetectTags(content);
          await manager.save({
            content,
            tags: Array.isArray(tags) ? tags : autoDetectTags(content),
            source: "import",
            summary: item.summary || `Ingested from inbox: ${basename(filePath)}`,
          });
          saved++;
        }
      } catch {
        log(`Failed to parse JSON: ${filePath}`);
      }
      break;
    }

    case ".jsonl": {
      const lines = raw.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const content =
            typeof parsed === "string"
              ? parsed
              : parsed.content || parsed.text || JSON.stringify(parsed);
          const tags = parsed.tags ?? autoDetectTags(content);
          await manager.save({
            content,
            tags: Array.isArray(tags) ? tags : autoDetectTags(content),
            source: "import",
            summary: parsed.summary || `Ingested from inbox: ${basename(filePath)}`,
          });
          saved++;
        } catch {
          log(`Skipping invalid JSONL line in ${basename(filePath)}`);
        }
      }
      break;
    }

    case ".csv": {
      const lines = raw.split("\n").filter((l) => l.trim());
      if (lines.length < 2) break;

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const contentIdx = header.indexOf("content");
      const colIdx = contentIdx >= 0 ? contentIdx : header.length - 1;
      const tagsIdx = header.indexOf("tags");

      for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(",");
        const content = (fields[colIdx] || "").trim();
        if (!content) continue;

        const tags =
          tagsIdx >= 0 && fields[tagsIdx]
            ? fields[tagsIdx]
                .split(";")
                .map((t) => t.trim())
                .filter(Boolean)
            : autoDetectTags(content);

        await manager.save({
          content,
          tags,
          source: "import",
          summary: `Ingested from inbox: ${basename(filePath)}`,
        });
        saved++;
      }
      break;
    }
  }

  return saved;
}

/**
 * Process a file: read, ingest, and move to processed directory.
 */
async function ingestFile(filePath: string, manager: MemoryManager): Promise<void> {
  const fileName = basename(filePath);
  const ext = extname(filePath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    log(`Skipping unsupported file type: ${fileName}`);
    return;
  }

  if (!existsSync(filePath)) return;

  try {
    const count = await processFile(filePath, manager);

    // Move to processed directory
    const destPath = join(PROCESSED_DIR, fileName);
    renameSync(filePath, destPath);

    log(
      `Processed ${fileName}: ${count} ${count === 1 ? "entry" : "entries"} saved, moved to processed/`,
    );
  } catch (err) {
    log(`Error processing ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Drain any existing files in the inbox directory on startup.
 */
async function drainExisting(manager: MemoryManager): Promise<void> {
  if (!existsSync(INBOX_DIR)) return;

  const files = readdirSync(INBOX_DIR).filter((f) => {
    const ext = extname(f).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  });

  if (files.length === 0) return;

  log(`Found ${files.length} existing file(s) in inbox, processing...`);

  for (const file of files) {
    await ingestFile(join(INBOX_DIR, file), manager);
  }
}

/**
 * Start watching the inbox directory for new files.
 * Returns an object with a `stop()` method to stop watching.
 */
export function startWatcher(manager: MemoryManager): { stop: () => void } {
  // Ensure directories exist
  mkdirSync(INBOX_DIR, { recursive: true });
  mkdirSync(PROCESSED_DIR, { recursive: true });

  // Drain existing files on startup
  drainExisting(manager).catch((err) => {
    log(`Error draining existing files: ${err instanceof Error ? err.message : String(err)}`);
  });

  // Track pending debounce timers per file
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  const watcher = watch(INBOX_DIR, (eventType, filename) => {
    if (!filename) return;

    const ext = extname(filename).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) return;

    // Debounce: wait for file to finish writing
    if (pending.has(filename)) {
      clearTimeout(pending.get(filename)!);
    }

    pending.set(
      filename,
      setTimeout(() => {
        pending.delete(filename);
        const filePath = join(INBOX_DIR, filename);
        if (!existsSync(filePath)) return;
        ingestFile(filePath, manager).catch((err) => {
          log(`Error ingesting ${filename}: ${err instanceof Error ? err.message : String(err)}`);
        });
      }, DEBOUNCE_MS),
    );
  });

  return {
    stop: () => {
      watcher.close();
      // Clear any pending timers
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
      log("Watcher stopped.");
    },
  };
}
