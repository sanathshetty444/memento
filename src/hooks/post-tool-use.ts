#!/usr/bin/env node
/**
 * Claude Code post-tool-use hook.
 * Runs after each tool invocation, capturing significant context to a queue
 * for later processing by the queue worker.
 *
 * Must be fast (<50ms) — no embedding computation, just file append.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface HookInput {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: string;
  session_id: string;
}

interface QueueEntry {
  timestamp: string;
  toolName: string;
  content: string;
  sessionId: string;
}

// Read-only / low-signal tools that should not be captured
const DENYLIST = new Set([
  "Read",
  "Glob",
  "Grep",
  "ls",
  "cat",
  "head",
  "tail",
]);

const MIN_OUTPUT_LENGTH = 50;
const MAX_OUTPUT_LENGTH = 10_000;

function main(): void {
  try {
    // Read stdin synchronously — hook data arrives as a single JSON blob on fd 0
    const raw = readFileSync(0, "utf-8").trim();
    if (!raw) {
      process.exit(0);
    }

    const input: HookInput = JSON.parse(raw);

    // Tier 0: Circular capture prevention — skip our own MCP tools
    if (input.tool_name.startsWith("memory_")) {
      process.exit(0);
    }

    // Tier 1: Tool denylist — skip read-only / low-signal tools
    if (DENYLIST.has(input.tool_name)) {
      process.exit(0);
    }

    // Tier 2: Content significance checks
    const output = input.tool_output ?? "";
    if (output.length < MIN_OUTPUT_LENGTH) {
      process.exit(0);
    }

    const trimmedOutput =
      output.length > MAX_OUTPUT_LENGTH
        ? output.slice(0, MAX_OUTPUT_LENGTH) + "\n...[truncated]"
        : output;

    // Tier 3: Build queue entry and append to capture queue
    const inputSummary = JSON.stringify(input.tool_input).slice(0, 500);
    const content = `[${input.tool_name}] Input: ${inputSummary}\nOutput: ${trimmedOutput}`;

    const entry: QueueEntry = {
      timestamp: new Date().toISOString(),
      toolName: input.tool_name,
      content,
      sessionId: input.session_id,
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
