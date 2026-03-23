# Upgrading to Memento v1.0

This guide helps you upgrade from Memento v0.x to the new v1.0 release, which brings 17 tools, advanced search modes, and significant architecture improvements.

## What's New in v1.0

### 17 MCP Tools (Previously 6)

v0.x had basic functionality. v1.0 adds powerful tools for advanced use cases:

| Tool | v0.x | v1.0 | Purpose |
|------|------|------|---------|
| `/save` | ✓ | ✓ | Manual memory save |
| `/recall` | ✓ | ✓ | Retrieve context |
| `/search` | ✓ | ✓ | Find memories |
| `/forget` | ✓ | ✓ | Delete memory |
| `/list` | ✓ | ✓ | Show all memories |
| `/health` | ✓ | ✓ | Check status |
| `/export` | ✗ | ✓ | Export as JSON/CSV |
| `/import` | ✗ | ✓ | Import from backup |
| `/compact` | ✗ | ✓ | Optimize storage |
| `/status` | ✗ | ✓ | Detailed diagnostics |
| `/config show` | ✗ | ✓ | View settings |
| `/tag search` | ✗ | ✓ | Filter by tags |
| `/namespace switch` | ✗ | ✓ | Change project context |
| `/analytics` | ✗ | ✓ | Memory statistics |
| `/backup` | ✗ | ✓ | Create snapshots |
| `/restore` | ✗ | ✓ | Restore from backup |
| `/migrate` | ✗ | ✓ | Change storage backends |

### Three Search Modes (Previously One)

v0.x only had basic vector search. v1.0 adds:

```
v0.x: /search "query"
      └─ Vector search only

v1.0: /search "query"
      ├─ --mode vector (semantic)
      ├─ --mode keyword (precise)
      └─ --mode hybrid (default, combines both)
```

See [How It Works](./how-it-works.md) for detailed explanation.

### Smart Auto-Capture

v0.x captured everything. v1.0 is intelligent:

- Detects and redacts secrets automatically
- Learns your tagging preferences
- Deduplicates similar memories
- Batches writes for efficiency
- Respects circuit breaker for failures

### Multiple Storage Backends

v0.x: ChromaDB only
v1.0: ChromaDB + Neo4j + custom

Switch backends without re-tagging:
```bash
memento migrate --to neo4j
```

### Optional Cloud Embeddings

v0.x: Local embeddings only
v1.0: Also supports OpenAI and Google Gemini

For higher quality vectors if you want:
```bash
export OPENAI_API_KEY=sk-...
memento config set embeddings openai
```

## Breaking Changes

Important: Read these if you're upgrading from v0.x.

### 1. Tool Name Changes

Some tools were renamed for clarity:

```
v0.x              → v1.0
---                  ---
/save              → /save (unchanged)
/recall            → /recall (unchanged)
/search            → /search (unchanged)
/forget            → /forget (unchanged)
/list              → /list (unchanged)
/health            → /status (renamed)
(none)             → /export (new)
(none)             → /import (new)
```

**Action needed:** Update any scripts or shortcuts that use `/health`. Use `/status` instead.

### 2. Config File Format

v0.x config:
```json
{
  "storage": "chromadb",
  "dataDir": "~/.claude-memory"
}
```

v1.0 config (compatible, but extended):
```json
{
  "version": "1.0.0",
  "storage": "chromadb",
  "embeddings": "local",
  "dataDir": "~/.claude-memory",
  "circuitBreaker": {
    "failureThreshold": 5,
    "resetTimeout": 60000
  },
  "chunking": {
    "tokenLimit": 512,
    "overlapTokens": 50
  },
  "cache": {
    "enabled": true,
    "maxEntries": 1000
  }
}
```

**Action needed:** If you have a custom config, keep it. v1.0 will auto-migrate with new defaults.

### 3. Package Version in Config

v0.x didn't track versions. v1.0 requires:

```json
{
  "version": "1.0.0"
}
```

This is auto-added during setup. **Action needed:** None required; v1.0 setup handles it.

### 4. Memory File Format

v0.x memory:
```json
{
  "id": "mem_xyz",
  "content": "Some memory",
  "tags": []
}
```

v1.0 memory (backward compatible):
```json
{
  "id": "mem_xyz",
  "namespace": "my-project",
  "content": "Some memory",
  "embedding": [0.12, 0.45, ...],
  "tags": ["decision", "architecture"],
  "createdAt": "2026-03-23T10:00:00Z",
  "updatedAt": "2026-03-23T10:00:00Z",
  "source": "auto-capture",
  "confidence": 0.95,
  "tokens": 42
}
```

**Important:** Old memories are automatically migrated on first read. No action needed.

### 5. Environment Variable Renames

v0.x:
```bash
MEMENTO_DIR=/custom/path
MEMENTO_DB=chromadb
```

v1.0:
```bash
MEMENTO_DATA_DIR=/custom/path      # Renamed from MEMENTO_DIR
MEMENTO_STORAGE=chromadb            # Renamed from MEMENTO_DB
MEMENTO_EMBEDDINGS=local            # New
MEMENTO_NAMESPACE=my-project        # New
```

**Action needed:** Update any environment variables in scripts or `.bashrc`.

## Step-by-Step Upgrade Guide

### 1. Check Current Version

```bash
npx memento-memory --version
```

If you see `v0.x.x`, you need to upgrade.

### 2. Backup Your Memories (Recommended)

Just in case anything goes wrong:

```bash
npx memento-memory export --format json --output memento-backup-v0.json
```

This creates a JSON file with all your memories. Safe to keep.

### 3. Update Memento

If you installed globally:
```bash
npm install -g memento-memory@latest
```

If you use npx (no action needed; it auto-fetches latest):
```bash
npx memento-memory@latest status
```

### 4. Run Setup Again

Setup is idempotent (safe to run multiple times):

```bash
npx memento-memory setup
```

**What happens:**
- Detects your IDE (Claude Code, Cursor, Windsurf, OpenCode)
- Migrates old config to v1.0 format
- Adds version field: `"version": "1.0.0"`
- Initializes new features (circuit breaker, cache)
- Does NOT delete existing memories

**Output:**
```
✓ Detecting Memento version: v0.x
✓ Backing up old config
✓ Migrating to v1.0 format
✓ Initializing new features
✓ Re-registering with IDE
✓ Upgrade complete!
✓ Your 127 memories preserved
```

### 5. Verify Upgrade

Check everything works:

```bash
npx memento-memory status
```

Should show v1.0:
```
Memento v1.0.0 installed
Memory store: ~/.claude-memory/
Database: ChromaDB (local)
Embeddings: all-MiniLM-L6-v2 (384 dims)
IDE: Claude Code
123 memories in 5 namespaces
```

### 6. Test Key Features

Quick sanity checks:

```bash
# Test recall (should still work like before)
/recall

# Test new search mode
/search --mode hybrid "your query"

# Test new export feature
npx memento-memory export --format csv

# Test status (replacement for /health)
npx memento-memory status
```

### 7. Update Scripts (If You Have Any)

If you have custom scripts using Memento, update tool names:

```bash
# Old
npx memento-memory health

# New
npx memento-memory status
```

### 8. Optional: Enable New Features

v1.0 has optional features that need setup:

#### Use Cloud Embeddings (Higher Quality)

```bash
# With OpenAI
export OPENAI_API_KEY=sk-...
npx memento-memory config set embeddings openai

# With Google Gemini
export GOOGLE_API_KEY=...
npx memento-memory config set embeddings gemini
```

#### Switch to Neo4j (Advanced)

```bash
# Requires Neo4j installed locally
npx memento-memory migrate --to neo4j
```

#### Enable HTTP Server (For IDE Extensions)

```bash
npx memento-memory config set http.enabled true
npx memento-memory config set http.port 3000
```

None of these are required; they're optional enhancements.

## Data Migration Details

### Automatic Memory Migration

When v1.0 first reads old v0.x memories, they're automatically upgraded:

```
Old memory file:
{
  "id": "mem_abc",
  "content": "JWT strategy",
  "tags": ["decision"]
}

After first read by v1.0:
{
  "id": "mem_abc",
  "namespace": "my-project",           ← Added
  "content": "JWT strategy",
  "embedding": [0.12, 0.45, ...],      ← Added
  "tags": ["decision"],
  "createdAt": "2026-03-23T...",       ← Added
  "updatedAt": "2026-03-23T...",       ← Added
  "source": "user",                    ← Added
  "confidence": 1.0,                   ← Added
  "tokens": 4                          ← Added
}
```

The file is updated on disk automatically. No action needed.

### Config File Migration

```
Old config (~/.claude-memory/config.json):
{
  "storage": "chromadb",
  "dataDir": "~/.claude-memory"
}

Backup created: config.json.v0-backup

New config:
{
  "version": "1.0.0",
  "storage": "chromadb",
  "embeddings": "local",
  "dataDir": "~/.claude-memory",
  "circuitBreaker": {
    "failureThreshold": 5,
    "resetTimeout": 60000
  },
  "chunking": {
    "tokenLimit": 512,
    "overlapTokens": 50
  },
  "cache": {
    "enabled": true,
    "maxEntries": 1000
  }
}
```

Old settings are preserved; new settings added with defaults.

## Troubleshooting Upgrade

### Issue: "Cannot find module '@xenova/transformers'"

The embedding model needs to be downloaded. This happens on first use of v1.0:

```bash
npx memento-memory status
```

Watch for:
```
Downloading all-MiniLM-L6-v2 (100 MB)...
████████████████████ 100%
✓ Ready
```

Takes 1-2 minutes depending on internet speed.

### Issue: "Old memories not appearing in /recall"

Memories are still there, just need re-embedding. Run:

```bash
npx memento-memory migrate --embeddings local --re-embed
```

This re-embeds all old memories with the v1.0 embeddings system.

### Issue: "IDE not finding Memento after upgrade"

Re-register with your IDE:

```bash
npx memento-memory setup --ide claude-code --force
```

Or for other IDEs:
```bash
npx memento-memory setup --ide cursor --force
npx memento-memory setup --ide windsurf --force
```

### Issue: "Config validation failed"

Your custom config might have old field names. Check:

```bash
npx memento-memory config show
```

If you see warnings, reset to defaults and reconfigure:

```bash
rm ~/.claude-memory/config.json
npx memento-memory setup --force
```

### Issue: "Storage corruption after upgrade"

If ChromaDB is corrupted:

```bash
rm -rf ~/.claude-memory/chromadb
npx memento-memory setup --force
```

This reinitializes the database. Your JSON memories are separate and won't be deleted.

## Rollback to v0.x (If Needed)

If you encounter issues:

```bash
npm install -g memento-memory@0.x.x
npx memento-memory setup
```

Your backup JSON file will still exist:
```bash
npx memento-memory import memento-backup-v0.json
```

But note: v0.x won't understand v1.0 metadata. This is why you should keep the backup.

## Performance & Storage

v1.0 may use slightly more disk space (new metadata fields):

```
v0.x memory: ~200 bytes
v1.0 memory: ~2KB (includes embedding vector)

1000 memories:
v0.x: ~200KB
v1.0: ~2MB
```

Not a concern for typical usage. Embeddings are compressed in storage.

To optimize:

```bash
npx memento-memory compact
```

This removes duplicates and old entries beyond the TTL (default: 180 days).

## New Features That Require Setup

### Chrome Extension Support (v1.1+)

Allow Claude to remember while browsing:

```bash
npx memento-memory setup chrome-extension
```

Then install the [Memento Chrome Extension](https://chrome.google.com/webstore/...).

### Slack Integration (v1.2+)

Remember code discussions from Slack:

```bash
npx memento-memory setup slack --token xoxb-...
```

### GitHub Integration (v1.3+)

Auto-capture from PR discussions:

```bash
npx memento-memory setup github --token ghp_...
```

These are future features to look forward to.

## Getting Help

After upgrading, if something isn't working:

```bash
# Check detailed logs
npx memento-memory logs --tail 50

# Run diagnostics
npx memento-memory diagnose

# Check system info
npx memento-memory system-info
```

Open an issue on [GitHub](https://github.com/sanathshetty444/memento/issues) with the output.

## Summary

Upgrading to v1.0 is safe and automatic:

1. `npm install -g memento-memory@latest`
2. `npx memento-memory setup`
3. All your memories are preserved
4. New features available optionally
5. Tools mostly backward compatible (except `/health` → `/status`)

You're now ready to enjoy 17 tools, advanced search modes, and intelligent auto-capture. See [How It Works](./how-it-works.md) to dive deeper into the new architecture.
