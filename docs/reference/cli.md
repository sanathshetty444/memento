# CLI Reference

Complete reference for the Memento CLI tool. Provides setup, status, teardown, and server commands for integrating Memento with Claude Code, Cursor, Windsurf, and OpenCode.

## Overview

The Memento CLI configures the MCP server for different IDEs and provides utilities for setup, status checking, and serving.

```bash
memento [command] [options]
```

The CLI binary is available as `memento` or `memento-memory` after installation.

---

## Commands

### setup

Configure Memento for an IDE target.

```bash
memento setup [--target `<target>`]
```

#### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--target` | string | `claude` | IDE target to configure. Options: `claude`, `cursor`, `windsurf`, `opencode` |

#### Targets

##### claude (default)

Configures Memento for Claude Code (Anthropic's official IDE extension).

```bash
memento setup
# or explicitly
memento setup --target claude
```

**What it configures:**

1. Creates `.claude/` directory if needed
2. Writes MCP server config to `~/.claude.json`:
   ```json
   {
     "mcpServers": {
       "memento": {
         "command": "npx",
         "args": ["-y", "memento-memory"]
       }
     }
   }
   ```
3. Creates `.claude/CLAUDE.md` with Memento system instructions
4. Initializes data directory: `~/.claude-memory/`
5. Creates default `config.json` with standard settings

**Output:**
```
✓ Configured MCP server for Claude Code
✓ Created ~/.claude.json
✓ Created CLAUDE.md with Memento instructions
✓ Initialized memory storage at ~/.claude-memory
```

---

##### cursor

Configures Memento for Cursor IDE.

```bash
memento setup --target cursor
```

**What it configures:**

1. Writes MCP config to `~/.cursor/mcp.json`:
   ```json
   {
     "mcpServers": {
       "memento": {
         "command": "npx",
         "args": ["-y", "memento-memory"]
       }
     }
   }
   ```
2. Creates rules file: `~/.cursor/rules/memento.txt` with memory guidelines
3. Initializes data directory: `~/.claude-memory/`

**Output:**
```
✓ Configured MCP server for Cursor
✓ Created ~/.cursor/mcp.json
✓ Created memory guidelines in ~/.cursor/rules/memento.txt
```

---

##### windsurf

Configures Memento for Windsurf IDE.

```bash
memento setup --target windsurf
```

**What it configures:**

1. Writes MCP config to `~/.windsurf/mcp.json` or `~/.codeium/windsurf/mcp.json` (whichever exists)
2. Creates rules file in Windsurf rules directory
3. Initializes data directory: `~/.claude-memory/`

**Output:**
```
✓ Configured MCP server for Windsurf
✓ Created ~/.windsurf/mcp.json (or ~/.codeium/windsurf/mcp.json)
```

---

##### opencode

Configures Memento for OpenCode IDE with auto-capture hooks.

```bash
memento setup --target opencode
```

**What it configures:**

1. Writes MCP server config to `~/.config/opencode/opencode.json`
2. Generates and writes auto-capture plugin to `~/.config/opencode/plugins/memento-capture.js`
3. Initializes data directory: `~/.claude-memory/`
4. Enables post-tool-use hook for auto-capture

**Output:**
```
✓ Configured MCP server for OpenCode
✓ Created OpenCode plugin at ~/.config/opencode/plugins/memento-capture.js
✓ Auto-capture hook installed
```

---

### status

Check current installation status and configuration.

```bash
memento status
```

#### Parameters

None. No parameters required.

#### What it checks

1. **Claude Code**
   - Checks `~/.claude.json` exists and contains memento server config
   - Checks `~/.claude/CLAUDE.md` exists with Memento block
   - Checks data directory: `~/.claude-memory/` exists

2. **Cursor**
   - Checks `~/.cursor/mcp.json` exists
   - Checks `~/.cursor/rules/memento.txt` exists

3. **Windsurf**
   - Checks `~/.windsurf/mcp.json` or `~/.codeium/windsurf/mcp.json`

4. **OpenCode**
   - Checks `~/.config/opencode/opencode.json`
   - Checks `~/.config/opencode/plugins/memento-capture.js`

5. **Storage**
   - Checks `~/.claude-memory/config.json` exists
   - Reports storage type, embedding provider
   - Counts entries in data directory

#### Example Output

```
Memento Status
==============

Claude Code: ✓ Installed
  - MCP config: ~/.claude.json
  - Rules: ~/.claude/CLAUDE.md

Cursor: ✗ Not installed

Windsurf: ✓ Installed
  - MCP config: ~/.windsurf/mcp.json

OpenCode: ✗ Not installed

Storage: ~/.claude-memory/
  - Type: local
  - Embedding: local (Xenova/all-MiniLM-L6-v2, 384-dim)
  - Entries: 247
  - Size: 3.2 MB

Config file: ~/.claude-memory/config.json
  - autoCapture: true
  - deduplicationThreshold: 0.92
```

---

### teardown

Remove all Memento configuration from installed IDEs. **Keeps stored memories intact.**

```bash
memento teardown
```

#### Parameters

None. No parameters required.

#### What it removes

1. **Claude Code**
   - Removes `memento` entry from `~/.claude.json` (keeps other MCP servers)
   - Removes Memento block from `~/.claude/CLAUDE.md` (keeps other content)

2. **Cursor**
   - Removes `memento` entry from `~/.cursor/mcp.json`
   - Removes `~/.cursor/rules/memento.txt`

3. **Windsurf**
   - Removes `memento` entry from `~/.windsurf/mcp.json`

4. **OpenCode**
   - Removes `memento` entry from `~/.config/opencode/opencode.json`
   - Removes `~/.config/opencode/plugins/memento-capture.js`

#### What it preserves

- `~/.claude-memory/` directory and all stored memories
- `~/.claude-memory/config.json` configuration
- All memory data (can be restored by running `setup` again)
- Other IDE configs and rules

#### Example Output

```
Removing Memento configuration...

Claude Code: ✓ Removed
  - Removed memento from ~/.claude.json
  - Removed Memento block from ~/.claude/CLAUDE.md

Cursor: ✓ Removed
  - Removed ~/.cursor/rules/memento.txt

Windsurf: ✗ Not installed

OpenCode: ✓ Removed
  - Removed memento plugin

Memory data preserved at ~/.claude-memory/
```

---

### serve

Start local HTTP API server for Memento.

```bash
memento serve [--port `<port>`]
```

#### Parameters

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--port` | number | 21476 | HTTP server port. Can also set via `MEMENTO_PORT` env var. |

#### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMENTO_PORT` | 21476 | HTTP server port |
| `MEMENTO_API_KEY` | — | Optional API key for authentication (header: `x-api-key`) |

#### Example

```bash
# Start server on default port 21476
memento serve

# Start server on custom port
memento serve --port 8000

# With API key
MEMENTO_API_KEY=my-secret-key memento serve --port 8000
```

#### Output

```
Starting Memento HTTP API server...
Listening on http://127.0.0.1:21476
Web UI: http://127.0.0.1:21476/
API docs: http://127.0.0.1:21476/docs

Memory: local (247 entries)
Embedding: Xenova/all-MiniLM-L6-v2 (384-dim)

Press Ctrl+C to stop
```

#### Server Endpoints

See [REST API Reference](rest-api.md) for complete endpoint documentation.

**Base URL:** `http://127.0.0.1:21476`

- `POST /api/save` — Save memory
- `POST /api/recall` — Semantic recall
- `POST /api/search` — Cross-namespace search
- `GET /api/list` — List memories
- `GET /api/health` — Health check
- `DELETE /api/:id` — Forget memory
- `GET /` — Web UI

---

## Configuration Directories

### Data Directory

All memory data stored at: `~/.claude-memory/`

```
~/.claude-memory/
├── config.json           # Configuration file
├── store/                # Local file storage (if type: local)
│   ├── entities.json
│   ├── relations.json
│   ├── memories.jsonl
│   └── index.json
├── chromadb/             # ChromaDB storage (if type: chromadb)
│   └── ...
└── .indexed              # Marker file (project already indexed)
```

### Config File

Located at: `~/.claude-memory/config.json`

```json
{
  "store": {
    "type": "local",
    "localPath": "~/.claude-memory/store"
  },
  "embeddings": {
    "provider": "local",
    "model": "Xenova/all-MiniLM-L6-v2",
    "dimensions": 384
  },
  "capture": {
    "autoCapture": true,
    "hooks": ["post_tool_use", "stop"],
    "redactSecrets": true,
    "maxContentLength": 4096,
    "queueFlushIntervalMs": 5000
  },
  "memory": {
    "defaultNamespace": "project",
    "defaultLimit": 10,
    "maxLimit": 100,
    "deduplicationThreshold": 0.92,
    "chunkSize": 500,
    "chunkOverlap": 100
  }
}
```

---

## Exit Codes

| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | `memento setup` completed successfully |
| 1 | General error | Invalid command, missing required option |
| 2 | File system error | Permission denied, path not writable |
| 3 | Configuration error | Invalid config.json, bad credentials |
| 4 | Network error | Connection timeout, unreachable service |
| 5 | Validation error | Invalid port number, malformed JSON |

---

## Global Flags

All commands support these flags:

```bash
memento [command] [options] [--help] [--version] [--verbose]
```

| Flag | Description |
|------|-------------|
| `--help` | Show command help and usage |
| `--version` | Show Memento version |
| `--verbose` | Enable verbose logging (debug mode) |
| `--no-color` | Disable colored output |

---

## Examples

### Setup Memento for Claude Code with local storage

```bash
memento setup
# Initializes ~/.claude-memory with local file storage
# Configures ~/.claude.json with MCP server
```

### Switch from local to OpenAI embeddings

1. Update config:
```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "dimensions": 1536,
    "openaiApiKey": "sk-..."
  }
}
EOF
```

2. Migrate existing memories:
```bash
# Use memory_migrate tool via MCP
# Or call it via HTTP API:
curl -X POST http://127.0.0.1:21476/api/migrate \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

### Configure multiple IDEs

```bash
# Claude Code
memento setup --target claude

# Also support Cursor
memento setup --target cursor

# And Windsurf
memento setup --target windsurf

# status shows all configured IDEs
memento status
```

### Run server with custom API key and port

```bash
MEMENTO_API_KEY=secret-key-12345 memento serve --port 3000
```

Then access with:
```bash
curl -H "x-api-key: secret-key-12345" http://127.0.0.1:3000/api/health
```

### Check installation after setup

```bash
memento status

# Example output shows all installed targets and storage info
```

### Remove Memento from system (keep data)

```bash
memento teardown
# Removes all IDE configs but keeps ~/.claude-memory/
# Memories can be restored by running setup again
```

---

## Troubleshooting

### "command not found: memento"

The CLI is not in PATH. Either:

1. Install globally:
```bash
npm install -g memento-memory
```

2. Or run with npx:
```bash
npx memento-memory setup
```

---

### "Permission denied" errors

The script lacks execute permission:

```bash
chmod +x $(npm list -g memento-memory | grep memento)/dist/cli.js
```

---

### IDE doesn't recognize MCP server

After running `setup`, restart the IDE:

- **Claude Code**: Close and reopen the editor
- **Cursor/Windsurf**: Restart the application
- **OpenCode**: Reload plugins or restart

Then verify:
```bash
memento status
```

---

### Port already in use

Change the port:

```bash
memento serve --port 3001
```

Or kill the existing process:

```bash
lsof -i :21476  # Find PID
kill -9 <PID>
memento serve
```

---

## Migration Path

### From Claude Code to Multiple IDEs

```bash
# Initial setup for Claude Code
memento setup --target claude

# Later, add support for Cursor
memento setup --target cursor

# All IDEs share the same memory database
# (same ~/.claude-memory directory)
```

---

## Best Practices

1. **Run `memento status` after setup** to verify installation
2. **Keep API key secret** — Don't commit to version control
3. **Back up memories** periodically:
   ```bash
   curl http://127.0.0.1:21476/api/export > memories-backup.jsonl
   ```
4. **Test after config changes** — Restart IDE and call `memory_health`
5. **Use `--target` explicitly** if unsure of default behavior

