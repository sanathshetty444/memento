#!/usr/bin/env node
/**
 * Memento CLI — setup and teardown for Claude Code & OpenCode integration.
 *
 * Usage:
 *   memento setup     — Configure hooks, MCP server, and instructions
 *   memento teardown   — Remove all Memento config (keeps stored memories)
 *   memento status     — Show current installation status
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
  }

  // 2. Remove capture plugin
  if (existsSync(OPENCODE_PLUGIN_PATH)) {
    unlinkSync(OPENCODE_PLUGIN_PATH);
    success("Removed OpenCode capture plugin");
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

  console.log("");
}

// ── Main ───────────────────────────────────────────────────────────
const command = process.argv[2];

switch (command) {
  case "setup":
  case undefined:
    // Default: running `npx memento-memory` with no args triggers setup
    setup();
    break;
  case "teardown":
  case "uninstall":
    teardown();
    break;
  case "status":
    status();
    break;
  case "help":
  case "--help":
  case "-h":
    console.log(`
  Memento — Persistent memory for Claude Code & OpenCode

  Usage:
    npx memento-memory              Set up (default)
    npx memento-memory setup        Set up hooks, MCP server, and instructions
    npx memento-memory status       Check installation status
    npx memento-memory teardown     Remove all config (keeps stored memories)
`);
    break;
  default:
    console.log(`  Unknown command: ${command}\n  Run 'npx memento-memory --help' for usage.`);
    process.exit(1);
}
