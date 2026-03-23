# Multi-IDE Setup Guide

Memento works across multiple IDEs and editors, sharing a single memory store. This guide explains how to configure Memento for Claude Code, OpenCode, Cursor, and Windsurf, and how to ensure they all access the same memories.

## Why Multi-IDE Support Matters

When you use multiple AI-assisted editors, you want:
1. **Shared memory** — A memory captured in Claude Code should be available in Cursor
2. **Unified context** — All editors draw from the same knowledge base
3. **No duplication** — Don't maintain separate memory stores per tool
4. **Flexibility** — Switch between editors while building projects

Memento solves this by:
- Storing all memories in one location: `~/.claude-memory/`
- Registering as an MCP server accessible to multiple IDEs
- Supporting a single configuration file used by all editors

## Installation Overview

Before IDE-specific setup, install Memento globally:

```bash
npm install -g memento-memory
```

Verify installation:

```bash
memento status
```

Output:
```
Memento Memory System
═══════════════════════════════════════════════════════════════
Status:        ✓ Ready
Config:        ~/.claude-memory/config.json
Store:         ~/.claude-memory/
Embeddings:    @xenova/transformers (local, offline)
Storage:       JSON (local file-based)
MCP Server:    Ready on stdio

Tools registered: 17
  ✓ memory_save, memory_recall, memory_search
  ✓ memory_list, memory_forget, memory_health
  ✓ memory_export, memory_import, memory_index
  ✓ memory_ingest, memory_compact, memory_stats
  ✓ memory_related, memory_profile, memory_session_*

Store size: 1.2 MB (347 memories)
```

## Claude Code Setup (Default)

Claude Code includes MCP integration by default. Memento works automatically once installed.

### What Happens Automatically

When you install `memento-memory`, Claude Code:
1. Scans for MCP server registrations
2. Finds Memento in `~/.claude-memory/mcp.json`
3. Registers the 17 MCP tools
4. Makes them available in your Claude Code sessions

### Configuration File Location

Claude Code uses:
```
~/.claude-memory/config.json
```

### Verifying Claude Code Connection

Inside a Claude Code session, ask:

```
Can you list my recent memories?
```

Claude Code should respond with a `memory_list` call showing your memories.

### Hook Configuration for Claude Code

Claude Code automatically hooks into:

```json
{
  "hooks": {
    "PostToolUse": {
      "enabled": true,
      "tools": ["Write", "Edit", "Bash"]
    },
    "Stop": {
      "enabled": true
    }
  }
}
```

This captures outputs from Write, Edit, and Bash tools automatically. No additional setup needed.

## OpenCode Setup

[OpenCode](https://github.com/open-vsx/open-vsx) is an open-source code editor. Setup requires manually pointing OpenCode to Memento's MCP server.

### Step 1: Find Your OpenCode Config Directory

```bash
# macOS
ls -la ~/.config/OpenCode/

# Linux
ls -la ~/.config/OpenCode/

# Windows
dir %APPDATA%\OpenCode\
```

If the directory doesn't exist, create it:

```bash
mkdir -p ~/.config/OpenCode/
```

### Step 2: Create or Edit mcp-servers.json

Create/edit:
```
~/.config/OpenCode/mcp-servers.json
```

Add Memento:

```json
{
  "mcpServers": {
    "memento": {
      "command": "memento",
      "args": ["server", "--stdio"],
      "env": {
        "MEMENTO_CONFIG": "~/.claude-memory/config.json"
      }
    }
  }
}
```

### Step 3: Enable Auto-Capture for OpenCode

Edit `~/.claude-memory/config.json`:

```json
{
  "ide": "opencode",
  "capture": {
    "enabled": true,
    "sourceTag": "opencode"
  }
}
```

The `sourceTag` helps you identify memories captured from OpenCode vs other editors.

### Step 4: Verify Connection

Restart OpenCode. In a chat, use:

```
@memento memory_health
```

Expected output:
```
{
  "status": "healthy",
  "memoryStore": "ready",
  "workerStatus": "running",
  "queriesProcessed": 42
}
```

## Cursor Setup

[Cursor](https://cursor.com) is a popular AI-enhanced editor. Memento integrates via Cursor's MCP support with the `--target cursor` flag.

### Step 1: Initialize Cursor Target

```bash
memento init --target cursor
```

This creates:
```
~/.cursorrules
```

With content:
```
# Memento Memory Integration
You have access to persistent semantic memory via the Memento MCP server.

Available tools:
- memory_save: Save important decisions, patterns, and context
- memory_recall: Retrieve relevant memories for the current task
- memory_search: Search across your memory with vector/keyword/hybrid modes
- memory_list: List memories by time, tags, or namespace
- memory_related: Find memories related to a specific entity or memory ID

Always recall relevant memories before starting a task.
When you solve problems, save the patterns and decisions.
```

### Step 2: Configure Cursor's MCP Connection

Edit Cursor's settings (usually `~/.cursor/settings.json`):

```json
{
  "mcpServers": {
    "memento": {
      "command": "memento",
      "args": ["server"],
      "env": {
        "MEMENTO_CONFIG": "~/.claude-memory/config.json"
      }
    }
  }
}
```

### Step 3: Set Cursor IDE Flag in Config

Edit `~/.claude-memory/config.json`:

```json
{
  "ide": "cursor",
  "capture": {
    "enabled": true,
    "sourceTag": "cursor"
  }
}
```

### Step 4: Enable Memory Tools in Cursor

In Cursor, open Settings (Cmd+,):
1. Search for "MCP"
2. Enable "MCPServers"
3. Find "memento" in the list
4. Toggle "Enabled"

### Verification

Restart Cursor. In a chat, type:

```
@memento Retrieve my recent memories about architecture decisions
```

Cursor should call `memory_recall` with appropriate filters.

## Windsurf Setup

[Windsurf](https://codeium.com/windsurf) is Codeium's AI editor. Setup is similar to Cursor but uses Windsurf-specific config locations.

### Step 1: Initialize Windsurf Target

```bash
memento init --target windsurf
```

This creates:
```
~/.windsurfrules
```

With content (similar to Cursor):
```
# Memento Memory Integration for Windsurf
You have access to persistent semantic memory via the Memento MCP server.
...
```

### Step 2: Configure Windsurf's MCP Connection

Edit Windsurf's config (usually `~/.windsurf/settings.json` or via UI):

```json
{
  "mcpServers": {
    "memento": {
      "command": "memento",
      "args": ["server"],
      "env": {
        "MEMENTO_CONFIG": "~/.claude-memory/config.json"
      }
    }
  }
}
```

### Step 3: Set Windsurf IDE Flag in Config

Edit `~/.claude-memory/config.json`:

```json
{
  "ide": "windsurf",
  "capture": {
    "enabled": true,
    "sourceTag": "windsurf"
  }
}
```

### Step 4: Verify Windsurf Connection

Open Windsurf and test:

```
@memento memory_health
```

Expected successful response.

## Running Setup for Multiple IDEs Simultaneously

If you use multiple editors at once, you can configure Memento to work with all of them:

### Unified Configuration

Create `~/.claude-memory/config.json` that works for all IDEs:

```json
{
  "storage": {
    "type": "json",
    "path": "~/.claude-memory/store"
  },
  "embeddings": {
    "provider": "local",
    "model": "all-MiniLM-L6-v2"
  },
  "capture": {
    "enabled": true,
    "minOutputLength": 50,
    "workerIntervalMs": 5000
  },
  "search": {
    "defaultMode": "hybrid",
    "vectorWeight": 0.70,
    "limit": 10
  },
  "multiIde": {
    "enabled": true,
    "shareStore": true,
    "sourceTags": {
      "claude-code": true,
      "cursor": true,
      "windsurf": true,
      "opencode": true
    }
  }
}
```

### Register Each IDE

For each IDE, register separately:

```bash
# Register Claude Code
memento init --target claude-code

# Register Cursor
memento init --target cursor

# Register Windsurf
memento init --target windsurf

# Register OpenCode
memento init --target opencode
```

Each registration adds its MCP config to the respective IDE config file while keeping a single shared memory store.

## Shared Memory Store Across IDEs

### Store Location

All IDEs write to the same location:
```
~/.claude-memory/
```

This means:
- **Memories saved in Claude Code** are immediately available in Cursor
- **Auto-captured outputs from Windsurf** appear in OpenCode search results
- **Deleted memories in one IDE** are gone everywhere
- **All memory statistics and relationships** are unified

### File Structure

```
~/.claude-memory/
├── config.json              ← shared configuration
├── store/
│   ├── memories.jsonl       ← all memories, one JSON object per line
│   ├── embeddings/          ← vector embeddings (shared)
│   └── index.hnsw           ← HNSW search index (shared)
├── capture-queue.jsonl      ← auto-capture queue (processed by all IDEs)
├── mcp.json                 ← MCP server config
├── .indexed                 ← marker file for project indexing
└── workspace.json           ← workspace/project context
```

### Concurrency Safety

Since multiple IDEs can access the store simultaneously, Memento uses:
- **File locks** on sensitive files (memories.jsonl)
- **Atomic writes** (write to temp file, then rename)
- **Conflict resolution** (last write wins, with timestamp tracking)

This ensures no data corruption even if two IDEs save memories simultaneously.

## Verifying Each Target

### Check All Targets

```bash
memento status --all-targets
```

Output:

```
Memento Status Across All Targets
═════════════════════════════════════════════════════════════════

Claude Code:
  ✓ Configured
  ✓ MCP server registered
  ✓ Auto-capture enabled
  ✓ Last activity: 2026-03-23 14:30:00

Cursor:
  ✓ Configured
  ✓ MCP server registered
  ✓ Auto-capture enabled
  ✓ Last activity: 2026-03-23 14:25:00

Windsurf:
  ✓ Configured
  ✓ MCP server registered
  ✓ Auto-capture enabled
  ✓ Last activity: 2026-03-20 10:15:00

OpenCode:
  ✓ Configured
  ✓ MCP server registered
  ✓ Auto-capture disabled (no recent activity)
  Last activity: never

Shared Memory Store:
  Location: ~/.claude-memory/
  Size: 2.3 MB
  Memories: 347
  Last update: 2026-03-23 14:30:00
```

### Test a Specific Target

```bash
memento test --target cursor
```

Output:

```
Testing Cursor connection to Memento...

1. MCP registration: ✓
2. Tools available: ✓ (17/17 loaded)
3. Memory store access: ✓ (readable, writable)
4. Embeddings: ✓ (all-MiniLM-L6-v2 ready)
5. Auto-capture: ✓ (queue accessible)

All checks passed! Cursor can use Memento.
```

## Scenario: Developing with Multiple IDEs

**Your workflow:**

1. **Morning (Claude Code)**
   - Work on authentication module
   - Auto-capture saves decisions: "Decided to use JWT with refresh tokens"
   - Create new memory: `memory_save "JWT token rotation implementation"`

2. **Afternoon (Cursor)**
   - Open the same project in Cursor to refactor
   - Call `memory_recall "authentication"` in Cursor
   - Get back both yesterday's memories AND this morning's auto-captured notes
   - Continue implementation with full context

3. **Evening (Windsurf)**
   - Test the auth flow
   - Windsurf auto-captures test results
   - Create memory: `memory_save "Auth tests pass, ready for production"`

4. **Next Day (Any IDE)**
   - Call `memory_search "JWT authentication"` in any IDE
   - Results include all memories from all three IDEs
   - Complete history of decisions, implementations, and testing

## Troubleshooting Multi-IDE Setup

**Q: Changes in one IDE don't appear in another**
A: Ensure both IDEs point to the same `~/.claude-memory/` directory. Check `MEMENTO_CONFIG` environment variable is set identically.

**Q: "Cannot acquire lock on memory store"**
A: Two IDEs are accessing simultaneously. This is safe, but wait a moment and retry. Locks auto-release after 30 seconds.

**Q: IDE doesn't show memory tools**
A: Restart the IDE. MCP server registration happens on startup. Check that `memento server` starts without errors.

**Q: Auto-capture works in one IDE but not others**
A: Check `capture.enabled` in config.json is true. Verify background worker is running: `memento health`.

---

Memento's multi-IDE support means you can code fluidly across tools while maintaining a unified, growing knowledge base. Every IDE contributes to the same memory store, making each one smarter over time.
