# OpenCode Support for Memento — Design Spec

## Goal

Extend Memento to auto-detect and configure OpenCode alongside Claude Code, giving OpenCode users the same zero-config persistent memory experience.

## Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Detection strategy | Auto-detect both clients | Zero-config philosophy; harmless if one isn't installed |
| Auto-capture mechanism | OpenCode plugin (`tool.execute.after`) | Native hook system; equivalent to Claude Code's PostToolUse shell hook |
| Instructions file | Reuse `CLAUDE.md` (OpenCode falls back to it) | Single source of truth, no extra file |
| Queue flush trigger | `session.idle` plugin event | Closest equivalent to Claude Code's Stop hook |
| MCP config location | Global `~/.config/opencode/opencode.json` | Mirrors Claude Code's global `~/.claude.json` approach |

## Architecture

### Integration Points

```
OpenCode                          Claude Code
────────                          ──────────
~/.config/opencode/opencode.json  ~/.claude.json          ← MCP server config
~/.config/opencode/plugins/       ~/.claude/settings.json  ← auto-capture hooks
  memento-capture.js                (PostToolUse + Stop)
~/.claude/CLAUDE.md (fallback)    ~/.claude/CLAUDE.md      ← instructions
~/.claude-memory/                 ~/.claude-memory/         ← shared data dir
```

Both tools share:
- The same MCP server (`dist/index.js`)
- The same data directory (`~/.claude-memory/`)
- The same capture queue format (`capture-queue.jsonl`)
- The same queue worker (`dist/hooks/queue-worker.js`)
- The same instructions in `CLAUDE.md`

### OpenCode MCP Config Format

Written to `~/.config/opencode/opencode.json` under the `mcp` key, merged with existing config:

```json
{
  "mcp": {
    "memory": {
      "type": "local",
      "command": ["node", "/absolute/path/to/dist/index.js"]
    }
  }
}
```

### OpenCode Capture Plugin

A standalone ESM JS file installed to `~/.config/opencode/plugins/memento-capture.js`. OpenCode loads plugins as ES modules. The file is **not compiled** by our TypeScript build — instead, `src/hooks/opencode-plugin.ts` exports a `generatePluginSource(workerPath: string): string` function that returns the complete JS source. `cli.ts` calls this function and writes the result to disk during setup.

**OpenCode `tool.execute.after` payload shape** (per OpenCode plugin docs):
```ts
interface ToolExecuteAfterPayload {
  tool: {
    name: string;        // e.g. "Read", "Edit", "Bash"
    input: unknown;      // tool-specific input object
  };
  result: {
    content: string;     // tool output
  };
  metadata?: {
    sessionId?: string;
  };
}
```

> **Note:** This payload shape must be verified against the actual OpenCode plugin SDK during implementation. If field names differ, the plugin filtering logic must be adapted accordingly. The filtering logic itself (denylist, min output length, skip `memory_*`) is the same as `post-tool-use.ts`.

**`session.idle` semantics:** OpenCode fires `session.idle` when no tool calls or user input have occurred for a configurable idle period. This may fire multiple times per session. The plugin must guard against spawning multiple queue workers — use a simple boolean flag or check for the queue worker lock file before spawning.

The plugin:
1. Hooks `tool.execute.after` — filters (denylist, min output length, skip `memory_*`), appends to `~/.claude-memory/capture-queue.jsonl`
2. Hooks `session.idle` — spawns detached queue worker process (guarded against duplicate spawns)

```js
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

export default function MementoCapture(context) {
  const DATA_DIR = join(homedir(), ".claude-memory");
  const QUEUE_PATH = join(DATA_DIR, "capture-queue.jsonl");
  const DENYLIST = new Set(["Read", "Glob", "Grep", "ls", "cat", "head", "tail"]);
  const WORKER_PATH = "__WORKER_PATH__"; // replaced by cli.ts at install time
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
            ? output.slice(0, 10000) + "\n...[truncated]"
            : output;
          const inputSummary = JSON.stringify(payload?.tool?.input ?? {}).slice(0, 500);
          const entry = {
            timestamp: new Date().toISOString(),
            toolName,
            content: `[${toolName}] Input: ${inputSummary}\nOutput: ${trimmed}`,
            sessionId: payload?.metadata?.sessionId ?? "unknown",
          };

          mkdirSync(DATA_DIR, { recursive: true });
          appendFileSync(QUEUE_PATH, JSON.stringify(entry) + "\n");
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
```

### Detection Logic

```
setup():
  1. Always configure Claude Code (existing behavior)
  2. If ~/.config/opencode/ exists → configure OpenCode
     a. Write MCP config to ~/.config/opencode/opencode.json
     b. Write plugin to ~/.config/opencode/plugins/memento-capture.js

teardown():
  1. Always teardown Claude Code (existing behavior)
  2. If OpenCode config exists:
     a. Remove only the "memory" key from mcp in opencode.json (preserve other config)
     b. Delete ~/.config/opencode/plugins/memento-capture.js

status():
  1. Report Claude Code status (existing)
  2. Report OpenCode status (MCP config, plugin installed)
```

## Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/cli.ts` | Add OpenCode setup/teardown/status logic |
| Create | `src/hooks/opencode-plugin.ts` | Exports `generatePluginSource(workerPath)` — returns standalone ESM JS string for the plugin file |
| Modify | `README.md` | Document OpenCode support in Quick Start and Architecture |
| Modify | `CHANGELOG.md` | Add entry under next version |

## What Doesn't Change

- `CLAUDE.md` instructions — OpenCode reads them via fallback
- Queue format, data directory, queue worker — all shared
- MCP server (`src/index.ts`) — same server for both tools
- Existing Claude Code setup — completely untouched
- Browser support — unrelated

## Testing

- Unit test for OpenCode config generation (JSON format)
- Unit test for plugin file content generation
- Unit test for auto-detection logic (mock `existsSync`)
- Integration: `setup` → verify OpenCode config written → `teardown` → verify removed
- Manual: install OpenCode, run `memento setup`, verify MCP tools available
