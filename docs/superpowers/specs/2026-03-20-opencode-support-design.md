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

A standalone JS file installed to `~/.config/opencode/plugins/memento-capture.js`. Not compiled by our build — written as a self-contained file by `memento setup` (or shipped as a template).

The plugin:
1. Hooks `tool.execute.after` — filters with same logic as `post-tool-use.ts` (denylist, min output length, skip `memory_*`), appends to `~/.claude-memory/capture-queue.jsonl`
2. Hooks `session.idle` — spawns detached queue worker process (`node dist/hooks/queue-worker.js`), fire-and-forget

```js
export default function MementoCapture(context) {
  const DATA_DIR = path.join(os.homedir(), ".claude-memory");
  const QUEUE_PATH = path.join(DATA_DIR, "capture-queue.jsonl");
  const DENYLIST = new Set(["Read", "Glob", "Grep", "ls", "cat", "head", "tail"]);

  return {
    hooks: {
      "tool.execute.after": async (payload) => {
        // Same filtering as post-tool-use.ts
        // Append to capture-queue.jsonl
      },
      "session.idle": async () => {
        // Spawn detached queue worker
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
  2. If OpenCode config exists → remove MCP entry + delete plugin file

status():
  1. Report Claude Code status (existing)
  2. Report OpenCode status (MCP config, plugin installed)
```

## Files

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/cli.ts` | Add OpenCode setup/teardown/status logic |
| Create | `src/hooks/opencode-plugin.ts` | Plugin template (exported as string or compiled to standalone JS) |
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
