/**
 * Generates a standalone ESM JavaScript plugin for OpenCode.
 * The generated file is written to ~/.config/opencode/plugins/memento-capture.js
 * by the CLI during `memento setup`.
 *
 * The plugin hooks into tool.execute.after (auto-capture) and session.idle (queue flush).
 */

export function generatePluginSource(workerPath: string): string {
  return `import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

export default function MementoCapture(context) {
  const DATA_DIR = join(homedir(), ".claude-memory");
  const QUEUE_PATH = join(DATA_DIR, "capture-queue.jsonl");
  const DENYLIST = new Set(["Read", "Glob", "Grep", "ls", "cat", "head", "tail"]);
  const WORKER_PATH = ${JSON.stringify(workerPath)};
  let flushing = false;

  return {
    hooks: {
      "tool.execute.after": async (payload) => {
        try {
          const toolName = payload?.tool?.name ?? "";
          if (toolName.startsWith("memory_")) return;
          if (DENYLIST.has(toolName)) return;
          const output = String(payload?.result?.content ?? "");
          if (output.length < 50) return;

          const trimmed = output.length > 10000
            ? output.slice(0, 10000) + "\\n...[truncated]"
            : output;
          const inputSummary = JSON.stringify(payload?.tool?.input ?? {}).slice(0, 500);
          const entry = {
            timestamp: new Date().toISOString(),
            toolName,
            content: \`[\${toolName}] Input: \${inputSummary}\\nOutput: \${trimmed}\`,
            sessionId: payload?.metadata?.sessionId ?? "unknown",
          };

          mkdirSync(DATA_DIR, { recursive: true });
          appendFileSync(QUEUE_PATH, JSON.stringify(entry) + "\\n");
        } catch {}
      },
      "session.idle": async () => {
        if (flushing) return;
        flushing = true;
        try {
          const child = spawn("node", [WORKER_PATH], {
            detached: true,
            stdio: "ignore",
          });
          child.unref();
        } catch {}
        setTimeout(() => { flushing = false; }, 30000);
      }
    }
  };
}
`;
}
