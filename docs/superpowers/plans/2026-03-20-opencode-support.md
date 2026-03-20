# OpenCode Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect OpenCode and configure MCP server + capture plugin alongside Claude Code during `memento setup`.

**Architecture:** Add OpenCode-specific setup/teardown/status logic to `src/cli.ts`. Create a plugin generator (`src/hooks/opencode-plugin.ts`) that produces a standalone ESM JS file for OpenCode's plugin system. Detection is simple: if `~/.config/opencode/` exists, configure OpenCode.

**Tech Stack:** TypeScript, Node.js fs APIs, Vitest

**Spec:** `docs/superpowers/specs/2026-03-20-opencode-support-design.md`

---

### Task 1: OpenCode Plugin Generator

**Files:**
- Create: `src/hooks/opencode-plugin.ts`
- Create: `tests/hooks/opencode-plugin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/hooks/opencode-plugin.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generatePluginSource } from "../../src/hooks/opencode-plugin.js";

describe("generatePluginSource", () => {
  it("returns valid JS string with worker path substituted", () => {
    const source = generatePluginSource("/path/to/queue-worker.js");
    expect(source).toContain("/path/to/queue-worker.js");
    expect(source).not.toContain("__WORKER_PATH__");
    expect(source).toContain("export default function MementoCapture");
  });

  it("includes tool.execute.after hook", () => {
    const source = generatePluginSource("/worker.js");
    expect(source).toContain("tool.execute.after");
  });

  it("includes session.idle hook with flush guard", () => {
    const source = generatePluginSource("/worker.js");
    expect(source).toContain("session.idle");
    expect(source).toContain("flushing");
  });

  it("includes denylist filtering", () => {
    const source = generatePluginSource("/worker.js");
    expect(source).toContain("DENYLIST");
    expect(source).toContain("memory_");
  });

  it("targets ~/.claude-memory/ data directory", () => {
    const source = generatePluginSource("/worker.js");
    expect(source).toContain(".claude-memory");
    expect(source).toContain("capture-queue.jsonl");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/opencode-plugin.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `src/hooks/opencode-plugin.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/hooks/opencode-plugin.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/opencode-plugin.ts tests/hooks/opencode-plugin.test.ts
git commit -m "feat: add OpenCode plugin generator"
```

---

### Task 2: CLI — OpenCode Setup

**Files:**
- Modify: `src/cli.ts`

**Context:** The existing `setup()` function (lines 88-201) configures Claude Code. We add OpenCode detection and configuration after the Claude Code setup, before the final success message. We also need to add OpenCode path constants at the top of the file.

- [ ] **Step 1: Add OpenCode path constants**

After line 33 (`const PACKAGE_DIR = ...`), add:

```typescript
// ── OpenCode paths ────────────────────────────────────────────────
const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");
const OPENCODE_CONFIG_PATH = join(OPENCODE_CONFIG_DIR, "opencode.json");
const OPENCODE_PLUGINS_DIR = join(OPENCODE_CONFIG_DIR, "plugins");
const OPENCODE_PLUGIN_PATH = join(OPENCODE_PLUGINS_DIR, "memento-capture.js");
```

- [ ] **Step 2: Add the import for generatePluginSource**

At line 14 (after `fileURLToPath` import), add:

```typescript
import { generatePluginSource } from "./hooks/opencode-plugin.js";
```

- [ ] **Step 3: Add `setupOpenCode()` function**

Add this function after the existing `setup()` function (after line 201):

```typescript
function setupOpenCode(): void {
  // Auto-detect: only configure if OpenCode config dir exists
  if (!existsSync(OPENCODE_CONFIG_DIR)) {
    info("OpenCode not detected (skipped)");
    return;
  }

  // 1. Configure MCP server in ~/.config/opencode/opencode.json
  const config = readJSON(OPENCODE_CONFIG_PATH) as { mcp?: Record<string, unknown> };
  if (!config.mcp) config.mcp = {};

  (config.mcp as Record<string, unknown>)["memory"] = {
    type: "local",
    command: ["node", MCP_SERVER_PATH],
  };

  writeJSON(OPENCODE_CONFIG_PATH, config);
  success("OpenCode MCP: ~/.config/opencode/opencode.json");

  // 2. Install capture plugin
  const workerPath = join(DIST_DIR, "hooks", "queue-worker.js");
  const pluginSource = generatePluginSource(workerPath);
  mkdirSync(OPENCODE_PLUGINS_DIR, { recursive: true });
  writeFileSync(OPENCODE_PLUGIN_PATH, pluginSource);
  success("OpenCode plugin: ~/.config/opencode/plugins/memento-capture.js");
}
```

- [ ] **Step 4: Call `setupOpenCode()` from `setup()`**

In the `setup()` function, right before the final `console.log` block (line 188), add:

```typescript
  // 5. Configure OpenCode (if detected)
  setupOpenCode();
```

- [ ] **Step 5: Update the setup banner message**

Replace the setup banner (lines 88-89):
```typescript
  console.log("\n  Memento — Setting up persistent memory for Claude Code\n");
```
with:
```typescript
  console.log("\n  Memento — Setting up persistent memory\n");
```

And update the final success message (lines 188-201) to be tool-agnostic:
```typescript
  console.log(`
  ──────────────────────────────────────────
  Done! Memento is ready.

  Start a new session and it will:
    • Auto-capture context from tool calls
    • Process and store memories when sessions end
    • Recall relevant context in future sessions

  Commands:
    memento status     — Check installation
    memento teardown   — Remove (keeps memories)
  ──────────────────────────────────────────
`);
```

- [ ] **Step 6: Verify build and existing tests pass**

```bash
npx tsc --noEmit && npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add OpenCode setup with MCP config and capture plugin"
```

---

### Task 3: CLI — OpenCode Teardown

**Files:**
- Modify: `src/cli.ts`

**Context:** The existing `teardown()` function (lines 204-269) removes Claude Code config. Add OpenCode teardown after it.

- [ ] **Step 1: Add `teardownOpenCode()` function**

Add after the existing `teardown()` function:

```typescript
function teardownOpenCode(): void {
  if (!existsSync(OPENCODE_CONFIG_DIR)) return;

  // 1. Remove MCP entry from opencode.json (preserve other config)
  const config = readJSON(OPENCODE_CONFIG_PATH) as { mcp?: Record<string, unknown> };
  if (config.mcp && "memory" in config.mcp) {
    delete config.mcp.memory;
    if (Object.keys(config.mcp).length === 0) delete config.mcp;
    writeJSON(OPENCODE_CONFIG_PATH, config);
    success("Removed MCP server from opencode.json");
  }

  // 2. Remove capture plugin
  if (existsSync(OPENCODE_PLUGIN_PATH)) {
    unlinkSync(OPENCODE_PLUGIN_PATH);
    success("Removed OpenCode capture plugin");
  }
}
```

- [ ] **Step 2: Add `unlinkSync` to the fs import**

Update the fs import at line 11 to include `unlinkSync`:

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
```

- [ ] **Step 3: Call `teardownOpenCode()` from `teardown()`**

In the `teardown()` function, right before the final `console.log` block, add:

```typescript
  // 4. Remove OpenCode config (if present)
  teardownOpenCode();
```

- [ ] **Step 4: Update teardown banner**

Replace:
```typescript
  console.log("\n  Memento — Removing Claude Code integration\n");
```
with:
```typescript
  console.log("\n  Memento — Removing integration\n");
```

- [ ] **Step 5: Verify build passes**

```bash
npx tsc --noEmit && npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add OpenCode teardown"
```

---

### Task 4: CLI — OpenCode Status

**Files:**
- Modify: `src/cli.ts`

**Context:** The existing `status()` function (lines 272-333) reports Claude Code status. Add OpenCode status after it.

- [ ] **Step 1: Add OpenCode status checks**

In the `status()` function, right before the final `console.log("")` (line 332), add:

```typescript
  // OpenCode status
  if (existsSync(OPENCODE_CONFIG_DIR)) {
    console.log("");
    console.log("  OpenCode:");

    const ocConfig = readJSON(OPENCODE_CONFIG_PATH) as { mcp?: Record<string, unknown> };
    if (ocConfig.mcp && "memory" in ocConfig.mcp) {
      success("MCP server configured");
    } else {
      warn("MCP server not configured");
    }

    if (existsSync(OPENCODE_PLUGIN_PATH)) {
      success("Capture plugin installed");
    } else {
      warn("Capture plugin not installed");
    }
  }
```

- [ ] **Step 2: Update help text**

Update the help text (around line 354-362) to mention OpenCode:

```typescript
    console.log(`
  Memento — Persistent memory for Claude Code & OpenCode

  Usage:
    npx memento-memory              Set up (default)
    npx memento-memory setup        Set up hooks, MCP server, and instructions
    npx memento-memory status       Check installation status
    npx memento-memory teardown     Remove all config (keeps stored memories)
`);
```

- [ ] **Step 3: Also update the file header comment**

Update lines 1-9 (the module docstring):

```typescript
#!/usr/bin/env node
/**
 * Memento CLI — setup and teardown for Claude Code & OpenCode integration.
 *
 * Usage:
 *   memento setup     — Configure hooks, MCP server, and instructions
 *   memento teardown   — Remove all Memento config (keeps stored memories)
 *   memento status     — Show current installation status
 */
```

- [ ] **Step 4: Verify build and tests pass**

```bash
npx tsc --noEmit && npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add OpenCode status and update help text"
```

---

### Task 5: README + CHANGELOG Update

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README Quick Start**

The Quick Start section currently says:

```markdown
> Requires Node.js >= 20

```bash
# One command — that's it
npx memento-memory setup
```

Update to mention OpenCode:

```markdown
> Requires Node.js >= 20. Works with **Claude Code** and **OpenCode**.

```bash
# One command — that's it
npx memento-memory setup
```

- [ ] **Step 2: Update README "What memento setup configures" table**

Add an OpenCode row after the existing table:

```markdown
### What `memento setup` configures

**Claude Code:**

| File | What |
|------|------|
| `~/.claude.json` | MCP server — gives Claude `memory_save`, `memory_recall`, etc. |
| `~/.claude/settings.json` | PostToolUse + Stop hooks — auto-captures context silently |
| `~/.claude/CLAUDE.md` | Instructions for Claude to auto-recall on session start |
| `~/.claude-memory/` | Data directory for stored memories |

**OpenCode** (auto-detected):

| File | What |
|------|------|
| `~/.config/opencode/opencode.json` | MCP server config |
| `~/.config/opencode/plugins/memento-capture.js` | Auto-capture plugin (tool.execute.after + session.idle) |
| `~/.claude/CLAUDE.md` | Shared instructions (OpenCode falls back to CLAUDE.md) |
```

- [ ] **Step 3: Update Architecture tree**

Add OpenCode plugin entry in the Architecture section under Hooks:

```
  ├── Hooks (auto-capture)
  │   ├── PostToolUse → capture queue (Claude Code)
  │   ├── Stop → session summary + queue processing (Claude Code)
  │   └── OpenCode plugin → capture + flush (OpenCode)
```

- [ ] **Step 4: Update CHANGELOG.md**

Add under the `## [Unreleased]` section (or create one if it doesn't exist, above `## [0.3.0]`):

```markdown
## [Unreleased]

### Added
- OpenCode support: auto-detects OpenCode and configures MCP server + capture plugin during `memento setup`
- OpenCode capture plugin with `tool.execute.after` and `session.idle` hooks
```

- [ ] **Step 5: Verify full pipeline**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: add OpenCode support to README and CHANGELOG"
```

---

### Post-Implementation Notes

After all tasks are merged:
1. Bump version in `package.json` to `0.4.0` (new feature)
2. Tag `v0.4.0` and push to trigger release
3. Manual verification: install OpenCode, run `memento setup`, verify MCP tools show up and auto-capture works
