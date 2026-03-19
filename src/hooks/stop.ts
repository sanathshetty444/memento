#!/usr/bin/env node
/**
 * Claude Code stop hook.
 * Runs when a Claude Code session ends.
 * Writes a session-summary entry to the capture queue for later processing.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface StopHookInput {
  session_id: string;
  [key: string]: unknown;
}

interface QueueEntry {
  timestamp: string;
  toolName: string;
  content: string;
  sessionId: string;
}

function main(): void {
  try {
    const raw = readFileSync(0, "utf-8").trim();
    if (!raw) {
      process.exit(0);
    }

    const input: StopHookInput = JSON.parse(raw);
    const sessionId = input.session_id ?? "unknown";

    const entry: QueueEntry = {
      timestamp: new Date().toISOString(),
      toolName: "__session_end__",
      content: `Session ${sessionId} ended at ${new Date().toISOString()}`,
      sessionId,
    };

    const dataDir = join(homedir(), ".claude-memory");
    mkdirSync(dataDir, { recursive: true });

    const queuePath = join(dataDir, "capture-queue.jsonl");
    appendFileSync(queuePath, JSON.stringify(entry) + "\n");
  } catch {
    // Never block Claude — swallow all errors
  }

  process.exit(0);
}

main();
