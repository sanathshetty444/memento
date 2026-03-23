#!/usr/bin/env node
/**
 * Memento CLI — setup and teardown for Claude Code, OpenCode, Cursor & Windsurf integration.
 *
 * Usage:
 *   memento setup                     — Configure for Claude Code (default)
 *   memento setup --target cursor     — Configure for Cursor IDE
 *   memento setup --target windsurf   — Configure for Windsurf IDE
 *   memento setup --target opencode   — Configure for OpenCode
 *   memento teardown                  — Remove all Memento config (keeps stored memories)
 *   memento status                    — Show current installation status
 *   memento serve [--port N]          — Start local HTTP API server
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePluginSource } from "./hooks/opencode-plugin.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Paths ──────────────────────────────────────────────────────────
const CLAUDE_DIR = join(homedir(), ".claude");
const SETTINGS_PATH = join(CLAUDE_DIR, "settings.json");
const MCP_CONFIG_PATH = join(homedir(), ".claude.json"); // Claude Code CLI reads MCP from here
const CLAUDE_MD_PATH = join(CLAUDE_DIR, "CLAUDE.md");
const DATA_DIR = join(homedir(), ".claude-memory");

// Resolve paths relative to this file.
// In compiled form, cli.js lives in dist/ alongside index.js and hooks/.
// In source form (ts-node/tsx), cli.ts lives in src/ and dist/ is a sibling.
const DIST_DIR = __dirname.endsWith("src") ? join(__dirname, "..", "dist") : __dirname; // cli.js is already in dist/

const MCP_SERVER_PATH = join(DIST_DIR, "index.js");
const POST_TOOL_HOOK_PATH = join(DIST_DIR, "hooks", "post-tool-use.js");
const STOP_HOOK_PATH = join(DIST_DIR, "hooks", "stop.js");
const PACKAGE_DIR = join(DIST_DIR, "..");

// ── OpenCode paths ────────────────────────────────────────────────
const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");
const OPENCODE_CONFIG_PATH = join(OPENCODE_CONFIG_DIR, "opencode.json");
const OPENCODE_PLUGINS_DIR = join(OPENCODE_CONFIG_DIR, "plugins");
const OPENCODE_PLUGIN_PATH = join(OPENCODE_PLUGINS_DIR, "memento-capture.js");

// ── Cursor paths ─────────────────────────────────────────────────
const CURSOR_DIR = join(homedir(), ".cursor");
const CURSOR_MCP_CONFIG_PATH = join(CURSOR_DIR, "mcp.json");

// ── Windsurf paths ───────────────────────────────────────────────
const WINDSURF_DIR = join(homedir(), ".windsurf");
const WINDSURF_ALT_DIR = join(homedir(), ".codeium", "windsurf");
const WINDSURF_MCP_CONFIG_FILENAME = "mcp.json";

// ── IDE rules file content ───────────────────────────────────────
const IDE_RULES_CONTENT = `# Memento Memory System

This project uses Memento for persistent semantic memory.

## Available MCP Tools
- memory_save: Save important context, decisions, or knowledge
- memory_recall: Search for relevant memories using semantic search
- memory_session_start: Call at the start of each session to restore context
- memory_search: Search across all projects
- memory_list: List memories with filtering
- memory_forget: Remove a memory by ID
- memory_stats: View memory statistics
- memory_compact: Clean up old/duplicate memories
- memory_related: Find related memories via the knowledge graph
- memory_session_summary: Summarize a session's memories

## Best Practices
- Call memory_session_start at the beginning of each conversation
- Use memory_save to persist important decisions, architecture choices, and bug fixes
- Use memory_recall to search for relevant context before making changes
`;

// ── Shared MCP config for Cursor/Windsurf ────────────────────────
const IDE_MCP_SERVER_CONFIG = {
  command: "npx",
  args: ["-y", "memento-memory"],
};

// ── CLAUDE.md block ────────────────────────────────────────────────
const MEMENTO_MD_START = "<!-- memento:start -->";
const MEMENTO_MD_END = "<!-- memento:end -->";
const MEMENTO_MD_BLOCK = `${MEMENTO_MD_START}
## Memento (Persistent Memory)

A semantic memory system runs via MCP. Context is auto-captured in the background via hooks.

**On every session start**: ALWAYS use \`memory_recall\` with a query relevant to the user's request to restore context. Do this unconditionally — do not skip even if the request seems unrelated to prior work. This ensures continuity across sessions and compensates for context lost during compaction.

**During conversation**: When the user makes an important decision, discovers a critical bug, or establishes an architecture pattern, use \`memory_save\` with appropriate tags to persist it.

**Available tags**: \`conversation\`, \`decision\`, \`code\`, \`error\`, \`architecture\`, \`config\`, \`dependency\`, \`todo\`
${MEMENTO_MD_END}`;

// ── Helpers ────────────────────────────────────────────────────────
function readJSON(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

function writeJSON(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function readText(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function success(msg: string): void {
  console.log(`  ✓ ${msg}`);
}

function info(msg: string): void {
  console.log(`  ○ ${msg}`);
}

function warn(msg: string): void {
  console.log(`  ! ${msg}`);
}

// ── Setup ──────────────────────────────────────────────────────────
function setup(): void {
  console.log("\n  Memento — Setting up persistent memory\n");

  // Validate dist exists
  if (!existsSync(MCP_SERVER_PATH)) {
    console.error(`  ✗ Built files not found at ${DIST_DIR}`);
    console.error(`    Run 'npm run build' in the memento directory first.`);
    process.exit(1);
  }

  // 1. Create data directory
  mkdirSync(DATA_DIR, { recursive: true });
  success("Data directory: ~/.claude-memory/");

  // 2. Configure MCP server in ~/.claude.json (Claude Code CLI reads from here)
  const config = readJSON(MCP_CONFIG_PATH) as { mcpServers?: Record<string, unknown> };
  if (!config.mcpServers) config.mcpServers = {};

  (config.mcpServers as Record<string, unknown>)["memory"] = {
    command: "node",
    args: [MCP_SERVER_PATH],
    cwd: PACKAGE_DIR,
  };

  writeJSON(MCP_CONFIG_PATH, config);
  success("MCP server: ~/.claude.json");

  // 3. Configure hooks in ~/.claude/settings.json
  const settings = readJSON(SETTINGS_PATH) as {
    hooks?: Record<string, unknown[]>;
  };
  if (!settings.hooks) settings.hooks = {};

  const hooks = settings.hooks as Record<string, unknown[]>;

  // PostToolUse hook
  const postToolHook = {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: `node ${POST_TOOL_HOOK_PATH}`,
        timeout: 5,
      },
    ],
  };

  // Stop hook
  const stopHook = {
    matcher: "",
    hooks: [
      {
        type: "command",
        command: `node ${STOP_HOOK_PATH}`,
        timeout: 10,
      },
    ],
  };

  // Remove existing memento hooks, then add fresh ones
  hooks["PostToolUse"] = (hooks["PostToolUse"] ?? []).filter(
    (h: unknown) =>
      !(h as { hooks?: Array<{ command?: string }> })?.hooks?.some((hh) =>
        hh.command?.includes("memento"),
      ),
  );
  hooks["Stop"] = (hooks["Stop"] ?? []).filter(
    (h: unknown) =>
      !(h as { hooks?: Array<{ command?: string }> })?.hooks?.some((hh) =>
        hh.command?.includes("memento"),
      ),
  );

  hooks["PostToolUse"].push(postToolHook);
  hooks["Stop"].push(stopHook);

  writeJSON(SETTINGS_PATH, settings);
  success("Hooks: ~/.claude/settings.json");

  // 4. Add instructions to CLAUDE.md
  let md = readText(CLAUDE_MD_PATH);

  // Remove existing memento block if present
  const startIdx = md.indexOf(MEMENTO_MD_START);
  const endIdx = md.indexOf(MEMENTO_MD_END);
  if (startIdx !== -1 && endIdx !== -1) {
    md =
      md.slice(0, startIdx).trimEnd() +
      "\n\n" +
      md.slice(endIdx + MEMENTO_MD_END.length).trimStart();
  }

  // Also remove any old-style memento section (without markers)
  md = md.replace(/## Memento \(Persistent Memory\)[\s\S]*?(?=\n## |\n$|$)/, "");

  // Append memento block
  md = md.trimEnd() + "\n\n" + MEMENTO_MD_BLOCK + "\n";
  writeText(CLAUDE_MD_PATH, md);
  success("Instructions: ~/.claude/CLAUDE.md");

  // 5. Configure OpenCode (if detected)
  setupOpenCode();

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
}

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

// ── Cursor Setup ────────────────────────────────────────────────────
function setupCursor(): void {
  console.log("\n  Memento — Setting up for Cursor IDE\n");

  if (!existsSync(CURSOR_DIR)) {
    console.error(`  ✗ Cursor directory not found at ${CURSOR_DIR}`);
    console.error(`    Is Cursor installed?`);
    process.exit(1);
  }

  // 1. Create data directory
  mkdirSync(DATA_DIR, { recursive: true });
  success("Data directory: ~/.claude-memory/");

  // 2. Configure MCP server in ~/.cursor/mcp.json
  const config = readJSON(CURSOR_MCP_CONFIG_PATH) as { mcpServers?: Record<string, unknown> };
  if (!config.mcpServers) config.mcpServers = {};

  (config.mcpServers as Record<string, unknown>)["memory"] = IDE_MCP_SERVER_CONFIG;

  writeJSON(CURSOR_MCP_CONFIG_PATH, config);
  success("MCP server: ~/.cursor/mcp.json");

  // 3. Write .cursorrules in current working directory
  const rulesPath = join(process.cwd(), ".cursorrules");
  writeText(rulesPath, IDE_RULES_CONTENT);
  success(`Rules file: ${rulesPath}`);

  console.log(`
  ──────────────────────────────────────────
  Done! Memento is ready for Cursor.

  Start a new Cursor session and use the MCP tools:
    • memory_save — persist decisions, bugs, architecture
    • memory_recall — search for relevant context
    • memory_session_start — restore context at session start

  Commands:
    memento status     — Check installation
    memento teardown   — Remove (keeps memories)
  ──────────────────────────────────────────
`);
}

// ── Windsurf Setup ──────────────────────────────────────────────────
function getWindsurfDir(): string | null {
  if (existsSync(WINDSURF_DIR)) return WINDSURF_DIR;
  if (existsSync(WINDSURF_ALT_DIR)) return WINDSURF_ALT_DIR;
  return null;
}

function setupWindsurf(): void {
  console.log("\n  Memento — Setting up for Windsurf IDE\n");

  const wsDir = getWindsurfDir();
  if (!wsDir) {
    console.error(`  ✗ Windsurf directory not found at ${WINDSURF_DIR} or ${WINDSURF_ALT_DIR}`);
    console.error(`    Is Windsurf installed?`);
    process.exit(1);
  }

  const mcpConfigPath = join(wsDir, WINDSURF_MCP_CONFIG_FILENAME);

  // 1. Create data directory
  mkdirSync(DATA_DIR, { recursive: true });
  success("Data directory: ~/.claude-memory/");

  // 2. Configure MCP server
  const config = readJSON(mcpConfigPath) as { mcpServers?: Record<string, unknown> };
  if (!config.mcpServers) config.mcpServers = {};

  (config.mcpServers as Record<string, unknown>)["memory"] = IDE_MCP_SERVER_CONFIG;

  writeJSON(mcpConfigPath, config);
  success(`MCP server: ${mcpConfigPath.replace(homedir(), "~")}`);

  // 3. Write .windsurfrules in current working directory
  const rulesPath = join(process.cwd(), ".windsurfrules");
  writeText(rulesPath, IDE_RULES_CONTENT);
  success(`Rules file: ${rulesPath}`);

  console.log(`
  ──────────────────────────────────────────
  Done! Memento is ready for Windsurf.

  Start a new Windsurf session and use the MCP tools:
    • memory_save — persist decisions, bugs, architecture
    • memory_recall — search for relevant context
    • memory_session_start — restore context at session start

  Commands:
    memento status     — Check installation
    memento teardown   — Remove (keeps memories)
  ──────────────────────────────────────────
`);
}

// ── Cursor Teardown ─────────────────────────────────────────────────
function teardownCursor(): void {
  if (!existsSync(CURSOR_DIR)) return;

  // Remove MCP entry from ~/.cursor/mcp.json
  const config = readJSON(CURSOR_MCP_CONFIG_PATH) as { mcpServers?: Record<string, unknown> };
  if (config.mcpServers && "memory" in config.mcpServers) {
    delete config.mcpServers.memory;
    if (Object.keys(config.mcpServers).length === 0) delete config.mcpServers;
    writeJSON(CURSOR_MCP_CONFIG_PATH, config);
    success("Removed MCP server from ~/.cursor/mcp.json");
  } else {
    info("Cursor MCP not configured (skipped)");
  }

  // Note: we don't remove .cursorrules since the user may have customized it
  const rulesPath = join(process.cwd(), ".cursorrules");
  if (existsSync(rulesPath)) {
    const content = readText(rulesPath);
    if (content.includes("Memento Memory System")) {
      unlinkSync(rulesPath);
      success("Removed .cursorrules");
    }
  }
}

// ── Windsurf Teardown ───────────────────────────────────────────────
function teardownWindsurf(): void {
  const wsDir = getWindsurfDir();
  if (!wsDir) return;

  const mcpConfigPath = join(wsDir, WINDSURF_MCP_CONFIG_FILENAME);

  // Remove MCP entry
  const config = readJSON(mcpConfigPath) as { mcpServers?: Record<string, unknown> };
  if (config.mcpServers && "memory" in config.mcpServers) {
    delete config.mcpServers.memory;
    if (Object.keys(config.mcpServers).length === 0) delete config.mcpServers;
    writeJSON(mcpConfigPath, config);
    success(`Removed MCP server from ${mcpConfigPath.replace(homedir(), "~")}`);
  } else {
    info("Windsurf MCP not configured (skipped)");
  }

  // Remove .windsurfrules if it's our content
  const rulesPath = join(process.cwd(), ".windsurfrules");
  if (existsSync(rulesPath)) {
    const content = readText(rulesPath);
    if (content.includes("Memento Memory System")) {
      unlinkSync(rulesPath);
      success("Removed .windsurfrules");
    }
  }
}

// ── Teardown ───────────────────────────────────────────────────────
function teardown(): void {
  console.log("\n  Memento — Removing integration\n");

  // 1. Remove MCP server from ~/.claude.json
  const config = readJSON(MCP_CONFIG_PATH) as { mcpServers?: Record<string, unknown> };
  if (config.mcpServers && "memory" in config.mcpServers) {
    delete config.mcpServers.memory;
    if (Object.keys(config.mcpServers).length === 0) delete config.mcpServers;
    writeJSON(MCP_CONFIG_PATH, config);
    success("Removed MCP server from ~/.claude.json");
  } else {
    info("MCP server not configured (skipped)");
  }

  // 2. Remove hooks
  const settings = readJSON(SETTINGS_PATH) as {
    hooks?: Record<string, unknown[]>;
  };
  if (settings.hooks) {
    let changed = false;

    for (const event of ["PostToolUse", "Stop"]) {
      const before = (settings.hooks[event] ?? []).length;
      settings.hooks[event] = (settings.hooks[event] ?? []).filter(
        (h: unknown) =>
          !(h as { hooks?: Array<{ command?: string }> })?.hooks?.some((hh) =>
            hh.command?.includes("memento"),
          ),
      );
      if ((settings.hooks[event]?.length ?? 0) !== before) changed = true;
      if (settings.hooks[event]?.length === 0) delete settings.hooks[event];
    }

    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

    if (changed) {
      writeJSON(SETTINGS_PATH, settings);
      success("Removed hooks from ~/.claude/settings.json");
    } else {
      info("Hooks not configured (skipped)");
    }
  }

  // 3. Remove CLAUDE.md block
  let md = readText(CLAUDE_MD_PATH);
  const startIdx = md.indexOf(MEMENTO_MD_START);
  const endIdx = md.indexOf(MEMENTO_MD_END);
  if (startIdx !== -1 && endIdx !== -1) {
    md =
      md.slice(0, startIdx).trimEnd() + "\n" + md.slice(endIdx + MEMENTO_MD_END.length).trimStart();
    writeText(CLAUDE_MD_PATH, md);
    success("Removed instructions from ~/.claude/CLAUDE.md");
  } else {
    info("CLAUDE.md instructions not found (skipped)");
  }

  // 4. Remove OpenCode config (if present)
  teardownOpenCode();

  // 5. Remove Cursor config (if present)
  teardownCursor();

  // 6. Remove Windsurf config (if present)
  teardownWindsurf();

  console.log(`
  ──────────────────────────────────────────
  Done! Memento integration removed.

  Your stored memories at ~/.claude-memory/ are preserved.
  To delete them: rm -rf ~/.claude-memory/
  ──────────────────────────────────────────
`);
}

function teardownOpenCode(): void {
  if (!existsSync(OPENCODE_CONFIG_DIR)) return;

  // 1. Remove MCP entry from opencode.json (preserve other config)
  const config = readJSON(OPENCODE_CONFIG_PATH) as { mcp?: Record<string, unknown> };
  if (config.mcp && "memory" in config.mcp) {
    delete config.mcp.memory;
    if (Object.keys(config.mcp).length === 0) delete config.mcp;
    writeJSON(OPENCODE_CONFIG_PATH, config);
    success("Removed MCP server from opencode.json");
  } else {
    info("OpenCode MCP not configured (skipped)");
  }

  // 2. Remove capture plugin
  if (existsSync(OPENCODE_PLUGIN_PATH)) {
    unlinkSync(OPENCODE_PLUGIN_PATH);
    success("Removed OpenCode capture plugin");
  } else {
    info("OpenCode plugin not found (skipped)");
  }
}

// ── Status ─────────────────────────────────────────────────────────
function status(): void {
  console.log("\n  Memento — Installation Status\n");

  // Check MCP server
  const config = readJSON(MCP_CONFIG_PATH) as { mcpServers?: Record<string, unknown> };
  if (config.mcpServers && "memory" in config.mcpServers) {
    success("MCP server configured");
  } else {
    warn("MCP server not configured");
  }

  // Check hooks
  const settings = readJSON(SETTINGS_PATH) as {
    hooks?: Record<string, unknown[]>;
  };
  const hasPostTool = (settings.hooks?.PostToolUse ?? []).some((h: unknown) =>
    (h as { hooks?: Array<{ command?: string }> })?.hooks?.some((hh) =>
      hh.command?.includes("memento"),
    ),
  );
  const hasStop = (settings.hooks?.Stop ?? []).some((h: unknown) =>
    (h as { hooks?: Array<{ command?: string }> })?.hooks?.some((hh) =>
      hh.command?.includes("memento"),
    ),
  );

  if (hasPostTool && hasStop) {
    success("Hooks configured (PostToolUse + Stop)");
  } else if (hasPostTool || hasStop) {
    warn(`Partial hooks (PostToolUse: ${hasPostTool}, Stop: ${hasStop})`);
  } else {
    warn("Hooks not configured");
  }

  // Check CLAUDE.md
  const md = readText(CLAUDE_MD_PATH);
  if (md.includes(MEMENTO_MD_START)) {
    success("CLAUDE.md instructions present");
  } else {
    warn("CLAUDE.md instructions missing");
  }

  // Check data directory
  if (existsSync(DATA_DIR)) {
    if (existsSync(join(DATA_DIR, "store"))) {
      success("Data directory exists with stored memories");
    } else {
      success("Data directory exists (no memories yet)");
    }
  } else {
    warn("Data directory not created");
  }

  // Check dist files
  if (existsSync(MCP_SERVER_PATH)) {
    success("Built files present");
  } else {
    warn("Built files missing — run 'npm run build'");
  }

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

  // Cursor status
  if (existsSync(CURSOR_DIR)) {
    console.log("");
    console.log("  Cursor:");

    const cursorConfig = readJSON(CURSOR_MCP_CONFIG_PATH) as {
      mcpServers?: Record<string, unknown>;
    };
    if (cursorConfig.mcpServers && "memory" in cursorConfig.mcpServers) {
      success("MCP server configured");
    } else {
      warn("MCP server not configured");
    }
  }

  // Windsurf status
  const wsDir = getWindsurfDir();
  if (wsDir) {
    console.log("");
    console.log("  Windsurf:");

    const wsMcpPath = join(wsDir, WINDSURF_MCP_CONFIG_FILENAME);
    const wsConfig = readJSON(wsMcpPath) as { mcpServers?: Record<string, unknown> };
    if (wsConfig.mcpServers && "memory" in wsConfig.mcpServers) {
      success("MCP server configured");
    } else {
      warn("MCP server not configured");
    }
  }

  console.log("");
}

// ── Export / Import ──────────────────────────────────────────────
async function createMemoryManager() {
  const { loadConfig } = await import("./config.js");
  const { createStore } = await import("./storage/index.js");
  const { createEmbeddingProvider } = await import("./embeddings/index.js");
  const { MemoryManager } = await import("./memory/memory-manager.js");

  const config = loadConfig();
  const store = await createStore({
    type: config.store.type,
    local: { path: config.store.localPath },
    chromadb: { path: config.store.chromaPath },
  });
  const embeddings = await createEmbeddingProvider({
    type: config.embeddings.provider,
    local: { modelPath: config.dataDir ? `${config.dataDir}/models` : undefined },
  });
  return new MemoryManager({
    store,
    embeddings,
    config: {
      deduplicationThreshold: config.memory.deduplicationThreshold,
      chunkSize: config.memory.chunkSize,
      chunkOverlap: config.memory.chunkOverlap,
    },
  });
}

async function cliExport(): Promise<void> {
  const formatArg = process.argv[3] || "jsonl";
  const validFormats = ["jsonl", "json", "markdown", "csv"];
  if (!validFormats.includes(formatArg)) {
    console.error(`  ✗ Unknown format: ${formatArg}`);
    console.error(`    Valid formats: ${validFormats.join(", ")}`);
    process.exit(1);
  }

  const nsIdx = process.argv.indexOf("--namespace");
  const namespace = nsIdx !== -1 ? process.argv[nsIdx + 1] : undefined;

  console.log(`\n  Memento — Exporting memories (format: ${formatArg})\n`);

  const manager = await createMemoryManager();
  const { MAX_LIMIT } = await import("./memory/types.js");

  interface ExportEntry {
    id: string;
    content: string;
    contentHash: string;
    parentId?: string;
    metadata: {
      namespace: string;
      tags: string[];
      timestamp: string;
      source: string;
      summary?: string;
    };
  }

  const allEntries: ExportEntry[] = [];
  let offset = 0;
  while (true) {
    const batch = await manager.list({ namespace, limit: MAX_LIMIT, offset });
    if (batch.length === 0) break;
    // Strip embeddings
    const stripped = batch.map((entry) => {
      const { embedding: _, ...rest } = entry;
      return rest as ExportEntry;
    });
    allEntries.push(...stripped);
    offset += batch.length;
    if (batch.length < MAX_LIMIT) break;
  }

  let output: string;
  const csvEsc = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;

  switch (formatArg) {
    case "jsonl":
      output = allEntries.map((e) => JSON.stringify(e)).join("\n");
      break;
    case "json":
      output = JSON.stringify(allEntries, null, 2);
      break;
    case "markdown":
      output = allEntries
        .map((e) => {
          const heading = e.metadata.summary || e.id;
          const meta = [
            "| Field | Value |",
            "| --- | --- |",
            `| ID | ${e.id} |`,
            `| Timestamp | ${e.metadata.timestamp || ""} |`,
            `| Tags | ${(e.metadata.tags ?? []).join(", ")} |`,
            `| Source | ${e.metadata.source || ""} |`,
          ].join("\n");
          return `## ${heading}\n\n${meta}\n\n${e.content}`;
        })
        .join("\n\n---\n\n");
      break;
    case "csv": {
      const header = "id,timestamp,tags,source,summary,content";
      const rows = allEntries.map((e) =>
        [
          csvEsc(e.id),
          csvEsc(e.metadata.timestamp || ""),
          csvEsc((e.metadata.tags ?? []).join(";")),
          csvEsc(e.metadata.source || ""),
          csvEsc(e.metadata.summary || ""),
          csvEsc(e.content.slice(0, 200)),
        ].join(","),
      );
      output = [header, ...rows].join("\n");
      break;
    }
    default:
      output = "";
  }

  console.log(output);
  console.error(
    `\n  Exported ${allEntries.length} ${allEntries.length === 1 ? "entry" : "entries"}`,
  );
  process.exit(0);
}

async function cliWatch(): Promise<void> {
  const { startWatcher } = await import("./watcher.js");

  console.log("\n  Memento — File Watcher\n");

  const manager = await createMemoryManager();
  const { stop } = startWatcher(manager);

  console.log("  Watching ~/.claude-memory/inbox/ for new files...");
  console.log("  Supported: .md, .txt, .json, .jsonl, .csv");
  console.log("  Press Ctrl+C to stop.\n");

  const shutdown = () => {
    stop();
    console.log("\n  Watcher stopped.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function cliDoctor(): Promise<void> {
  console.log("\n  Memento — Doctor (diagnostics)\n");
  let issues = 0;

  // 1. Check data directory
  if (existsSync(DATA_DIR)) {
    success("Data directory exists: ~/.claude-memory/");
  } else {
    warn("Data directory missing: ~/.claude-memory/ — run 'memento setup' first");
    issues++;
  }

  // 2. Check store directory
  const storeDir = join(DATA_DIR, "store");
  if (existsSync(storeDir)) {
    success("Store directory exists");
  } else {
    warn("Store directory missing — no memories saved yet");
  }

  // 3. Check MCP config
  if (existsSync(MCP_CONFIG_PATH)) {
    try {
      const config = JSON.parse(readFileSync(MCP_CONFIG_PATH, "utf-8"));
      if (config?.mcpServers?.memory) {
        success("MCP server configured in ~/.claude.json");
      } else {
        warn("~/.claude.json exists but no 'memory' MCP server — run 'memento setup'");
        issues++;
      }
    } catch {
      warn("~/.claude.json is not valid JSON");
      issues++;
    }
  } else {
    warn("~/.claude.json not found — MCP not configured");
    issues++;
  }

  // 4. Check hooks
  if (existsSync(SETTINGS_PATH)) {
    try {
      const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
      const hooks = settings?.hooks;
      if (hooks?.PostToolUse || hooks?.Stop) {
        success("Claude Code hooks configured");
      } else {
        warn("Hooks not configured — auto-capture disabled. Run 'memento setup'");
        issues++;
      }
    } catch {
      warn("settings.json is not valid JSON");
      issues++;
    }
  } else {
    info("No hooks configured (optional — only needed for auto-capture)");
  }

  // 5. Check queue
  const queuePath = join(DATA_DIR, "capture-queue.jsonl");
  if (existsSync(queuePath)) {
    const raw = readFileSync(queuePath, "utf-8");
    const lineCount = raw.split("\n").filter((l) => l.trim().length > 0).length;
    if (lineCount > 100) {
      warn(`Capture queue has ${lineCount} pending entries — may need processing`);
      issues++;
    } else if (lineCount > 0) {
      info(`Capture queue: ${lineCount} pending entries`);
    } else {
      success("Capture queue is empty");
    }
  } else {
    success("No pending capture queue");
  }

  // 6. Check lock file
  const lockPath = join(DATA_DIR, ".processing");
  if (existsSync(lockPath)) {
    try {
      const lockTime = parseInt(readFileSync(lockPath, "utf-8").trim(), 10);
      const age = Date.now() - lockTime;
      if (age > 5 * 60 * 1000) {
        warn("Stale lock file detected (.processing) — older than 5 minutes");
        info("  You can safely delete it: rm ~/.claude-memory/.processing");
        issues++;
      } else {
        info("Queue worker currently processing");
      }
    } catch {
      warn("Corrupt lock file detected");
      issues++;
    }
  }

  // 7. Check HNSW index
  if (existsSync(storeDir)) {
    try {
      const { readdirSync } = await import("node:fs");
      const namespaces = readdirSync(storeDir, { withFileTypes: true });
      let hnswCount = 0;
      for (const ns of namespaces) {
        if (ns.isDirectory() && existsSync(join(storeDir, ns.name, "_hnsw.bin"))) {
          hnswCount++;
        }
      }
      if (hnswCount > 0) {
        success(`HNSW index found in ${hnswCount} namespace(s)`);
      } else {
        info("No HNSW index — brute-force search will be used (fine for < 1000 entries)");
      }
    } catch {
      info("Could not check HNSW index");
    }
  }

  // 8. Check inbox directory
  const inboxDir = join(DATA_DIR, "inbox");
  if (existsSync(inboxDir)) {
    success("Inbox directory exists for file watcher");
  }

  // Summary
  console.log("");
  if (issues === 0) {
    success("No issues found! Memento is healthy.");
  } else {
    warn(`Found ${issues} issue${issues > 1 ? "s" : ""} — see above for details.`);
  }
  console.log("");
}

async function cliImport(): Promise<void> {
  const formatArg = process.argv[3];
  const validFormats = ["jsonl", "json", "markdown", "text", "csv"];
  if (!formatArg || !validFormats.includes(formatArg)) {
    console.error(`  ✗ Usage: memento import <format> <file>`);
    console.error(`    Formats: ${validFormats.join(", ")}`);
    process.exit(1);
  }

  const filePath = process.argv[4];
  if (!filePath || !existsSync(filePath)) {
    console.error(`  ✗ File not found: ${filePath ?? "(none)"}`);
    process.exit(1);
  }

  const nsIdx = process.argv.indexOf("--namespace");
  const namespace = nsIdx !== -1 ? process.argv[nsIdx + 1] : undefined;

  const tagsIdx = process.argv.indexOf("--tags");
  const tags =
    tagsIdx !== -1 && process.argv[tagsIdx + 1] ? process.argv[tagsIdx + 1].split(",") : undefined;

  const raw = readFileSync(filePath, "utf-8");
  console.log(`\n  Memento — Importing from ${filePath} (format: ${formatArg})\n`);

  const manager = await createMemoryManager();
  const entries: string[] = [];

  switch (formatArg) {
    case "jsonl":
      for (const line of raw.split("\n").filter((l) => l.trim())) {
        try {
          const parsed = JSON.parse(line);
          entries.push(parsed.content || parsed.text || JSON.stringify(parsed));
        } catch {
          /* skip */
        }
      }
      break;
    case "json":
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of arr) {
          entries.push(item.content || item.text || JSON.stringify(item));
        }
      } catch {
        console.error("  ✗ Failed to parse JSON");
        process.exit(1);
      }
      break;
    case "markdown":
      for (const section of raw.split(/^(?=#{1,2} )/m)) {
        const trimmed = section.trim();
        if (trimmed) entries.push(trimmed);
      }
      break;
    case "text":
      for (const para of raw.split(/\n\n+/)) {
        const trimmed = para.trim();
        if (trimmed) entries.push(trimmed);
      }
      break;
    case "csv": {
      const lines = raw.split("\n").filter((l) => l.trim());
      if (lines.length >= 2) {
        const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const contentIdx = header.indexOf("content");
        const colIdx = contentIdx >= 0 ? contentIdx : header.length - 1;
        for (let i = 1; i < lines.length; i++) {
          // Simple CSV split (does not handle all edge cases for CLI — MCP tool handles quoted fields)
          const fields = lines[i].split(",");
          const text = (fields[colIdx] || "").trim();
          if (text) entries.push(text);
        }
      }
      break;
    }
  }

  let imported = 0;
  for (const text of entries) {
    try {
      await manager.save({ content: text, namespace, tags, source: "import" });
      imported++;
    } catch {
      /* skip */
    }
  }

  console.log(`  ✓ Imported ${imported} of ${entries.length} entries`);
  process.exit(0);
}

// ── Serve ───────────────────────────────────────────────────────
async function cliServe(): Promise<void> {
  const portIdx = process.argv.indexOf("--port");
  if (portIdx !== -1 && process.argv[portIdx + 1]) {
    process.env.MEMENTO_PORT = process.argv[portIdx + 1];
  }

  const port = process.env.MEMENTO_PORT ?? "21476";

  const manager = await createMemoryManager();
  const { startServer } = await import("./server.js");
  await startServer(manager);

  console.log(`\n  Memento HTTP API listening on http://127.0.0.1:${port}\n`);
}

// ── Argument parsing ────────────────────────────────────────────
function parseTarget(): string {
  const targetIdx = process.argv.indexOf("--target");
  if (targetIdx === -1) return "claude";
  const value = process.argv[targetIdx + 1];
  if (!value || value.startsWith("-")) {
    console.error("  ✗ --target requires a value: claude, cursor, windsurf, opencode");
    process.exit(1);
  }
  const valid = ["claude", "cursor", "windsurf", "opencode"];
  if (!valid.includes(value)) {
    console.error(`  ✗ Unknown target: ${value}`);
    console.error(`    Valid targets: ${valid.join(", ")}`);
    process.exit(1);
  }
  return value;
}

// ── Main ───────────────────────────────────────────────────────────
const command = process.argv[2];

switch (command) {
  case "setup":
  case undefined: {
    // Default: running `npx memento-memory` with no args triggers setup
    const target = parseTarget();
    switch (target) {
      case "claude":
        setup();
        break;
      case "cursor":
        setupCursor();
        break;
      case "windsurf":
        setupWindsurf();
        break;
      case "opencode":
        console.log("\n  Memento — Setting up for OpenCode\n");
        mkdirSync(DATA_DIR, { recursive: true });
        success("Data directory: ~/.claude-memory/");
        setupOpenCode();
        console.log(`
  ──────────────────────────────────────────
  Done! Memento is ready for OpenCode.
  ──────────────────────────────────────────
`);
        break;
    }
    break;
  }
  case "teardown":
  case "uninstall":
    teardown();
    break;
  case "status":
    status();
    break;
  case "export":
    cliExport();
    break;
  case "import":
    cliImport();
    break;
  case "serve":
    cliServe();
    break;
  case "watch":
    cliWatch();
    break;
  case "doctor":
    cliDoctor();
    break;
  case "help":
  case "--help":
  case "-h":
    console.log(`
  Memento v1.0.0 — Persistent memory for Claude Code, Cursor, Windsurf & OpenCode

  Usage:
    npx memento-memory                          Set up for Claude Code (default)
    npx memento-memory setup                    Set up for Claude Code (default)
    npx memento-memory setup --target cursor    Set up for Cursor IDE
    npx memento-memory setup --target windsurf  Set up for Windsurf IDE
    npx memento-memory setup --target opencode  Set up for OpenCode
    npx memento-memory status                   Check installation status
    npx memento-memory teardown                 Remove all config (keeps stored memories)
    npx memento-memory export [format]          Export memories (jsonl|json|markdown|csv)
    npx memento-memory import <format> <file>   Import memories (jsonl|json|markdown|text|csv)
      Options: --namespace <ns> --tags tag1,tag2
    npx memento-memory watch                    Watch inbox for files to auto-ingest
    npx memento-memory serve [--port N]         Start local HTTP API server
    npx memento-memory doctor                   Diagnose common issues
`);
    break;
  default:
    console.log(`  Unknown command: ${command}\n  Run 'npx memento-memory --help' for usage.`);
    process.exit(1);
}
