#!/usr/bin/env node
/**
 * Claude Code stop hook.
 * Runs when a Claude Code session ends.
 * Writes a session-summary entry to the capture queue for later processing.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

interface StopHookInput {
  session_id: string;
  last_assistant_message: string;
  cwd: string;
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

    // Capture the last assistant message as session context
    const lastMsg = input.last_assistant_message ?? "";
    const summary = lastMsg.length > 2000 ? lastMsg.slice(0, 2000) + "\n...[truncated]" : lastMsg;

    const entry: QueueEntry = {
      timestamp: new Date().toISOString(),
      toolName: "__session_end__",
      content: summary
        ? `Session ${sessionId} ended. Last context:\n${summary}`
        : `Session ${sessionId} ended at ${new Date().toISOString()}`,
      sessionId,
    };

    const dataDir = join(homedir(), ".claude-memory");
    mkdirSync(dataDir, { recursive: true });

    const queuePath = join(dataDir, "capture-queue.jsonl");
    appendFileSync(queuePath, JSON.stringify(entry) + "\n");

    // Fire-and-forget: trigger queue worker to process captured entries.
    // Must detach so process.exit(0) below does not kill the worker.
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const workerPath = join(__dirname, "queue-worker.js");
    const child = spawn("node", [workerPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    // Never block Claude — swallow all errors
  }

  process.exit(0);
}

main();
