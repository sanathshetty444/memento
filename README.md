# Memento

Persistent semantic memory for Claude Code. Save, recall, and search context across sessions — even after autocompact.

## What it does

Memento captures conversation context, decisions, and code knowledge into a vector database with semantic retrieval. No more re-explaining context every new session.

- **Auto-capture** — hooks silently capture every meaningful tool call in the background
- **Survives compaction** — memories persist even when Claude's context window is compressed
- **Semantic recall** — find relevant context by meaning, not exact keywords
- **Cross-project search** — find knowledge across all your projects
- **Auto-tagging** — heuristic classification (code, decision, error, architecture, config, dependency, todo)
- **Sensitive data redaction** — API keys, tokens, passwords stripped before storage
- **Deduplication** — hash + cosine similarity prevents redundant entries
- **Local-first** — works offline with local embeddings, zero API keys required

## Quick Start

```bash
# Clone and install
git clone https://github.com/sanathshetty444/memento.git
cd memento
npm install
npm run build

# One command setup — done
node dist/cli.js setup
```

That's it. Your next Claude Code session will automatically capture and recall context.

### What `memento setup` configures

| File | What |
|------|------|
| `~/.claude.json` | MCP server — gives Claude `memory_save`, `memory_recall`, etc. |
| `~/.claude/settings.json` | PostToolUse + Stop hooks — auto-captures context silently |
| `~/.claude/CLAUDE.md` | Instructions for Claude to auto-recall on session start |
| `~/.claude-memory/` | Data directory for stored memories |

### CLI Commands

```bash
node dist/cli.js setup       # Configure everything (idempotent, safe to re-run)
node dist/cli.js status      # Check what's configured
node dist/cli.js teardown    # Remove config (keeps stored memories)
```

### After npm global install

```bash
npm install -g .
memento setup
memento status
memento teardown
```

## How it works

```
┌─ During your session ──────────────────────────────────────────┐
│                                                                │
│  Tool call (Edit, Bash, Write...)                              │
│       ↓                                                        │
│  PostToolUse hook → capture-queue.jsonl (fast, <50ms)          │
│                                                                │
│  Claude can also call memory_save explicitly for key decisions │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                           ↓
┌─ When session ends ────────────────────────────────────────────┐
│                                                                │
│  Stop hook captures last message + triggers queue worker       │
│       ↓                                                        │
│  Queue worker: redact → auto-tag → chunk → embed → dedup →    │
│                store in ~/.claude-memory/store/                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                           ↓
┌─ Next session ─────────────────────────────────────────────────┐
│                                                                │
│  Claude reads CLAUDE.md instructions                           │
│       ↓                                                        │
│  Calls memory_recall with relevant query                       │
│       ↓                                                        │
│  Context restored — compaction had zero effect                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### What gets captured (and what doesn't)

| Captured | Filtered out |
|----------|-------------|
| `Edit`, `Bash`, `Write` tool calls | `Read`, `Glob`, `Grep` (read-only, low signal) |
| Outputs ≥ 50 chars | Short outputs (< 50 chars) |
| Unique content | Duplicates (hash + 92% cosine similarity) |
| Redacted content | Raw secrets (API keys, tokens, passwords) |
| — | `memory_*` tool calls (prevents circular capture) |

## MCP Tools

| Tool | Description |
|------|-------------|
| `memory_save` | Save context with optional tags, namespace, global flag |
| `memory_recall` | Semantic search within current project |
| `memory_search` | Cross-project semantic search |
| `memory_forget` | Delete a memory by ID |
| `memory_list` | Browse memories with filters and pagination |
| `memory_health` | Storage status and diagnostics |
| `memory_export` | Export memories as JSON or JSONL |
| `memory_migrate` | Re-embed all memories after switching embedding models |

## Storage Backends

| Backend | Status | Description |
|---------|--------|-------------|
| **Local files** | Default | JSON files at `~/.claude-memory/store/`, zero config |
| **ChromaDB** | Optional | HTTP-based vector DB (needs running server) |
| **Neo4j** | Optional | Graph-enhanced retrieval with relationships |

## Embedding Providers

| Provider | Dimensions | Cost | Description |
|----------|-----------|------|-------------|
| **Local** (default) | 384 | Free | Transformers.js, all-MiniLM-L6-v2, offline |
| **Gemini** | 768 | Free tier | `text-embedding-004` |
| **OpenAI** | 1536 | Paid | `text-embedding-3-small` |

## Configuration

Config is loaded from: env vars → `~/.claude-memory/config.json` → defaults.

```json
{
  "store": {
    "type": "local",
    "localPath": "~/.claude-memory/store"
  },
  "embeddings": {
    "provider": "local"
  },
  "capture": {
    "autoCapture": true
  }
}
```

See `Techspec.md` for full config reference.

## Architecture

```
Memento
  ├── CLI (setup / teardown / status)
  ├── MCP Server (stdio)
  │   └── Tools: save, recall, search, forget, list, health, export, migrate
  ├── Memory Manager (orchestrator)
  │   └── Redaction → Tagging → Chunking → Dedup → Embed → Store
  ├── Storage (pluggable)
  │   ├── Local files (default)
  │   ├── ChromaDB (optional)
  │   └── Neo4j (optional)
  ├── Embeddings (pluggable)
  │   ├── Local/Transformers.js (default)
  │   ├── Gemini (optional)
  │   └── OpenAI (optional)
  ├── Hooks (auto-capture)
  │   ├── PostToolUse → capture queue
  │   └── Stop → session summary + queue processing
  └── Resilience
      ├── Circuit breaker
      ├── Write-ahead log
      └── LRU cache
```

## Development

```bash
npm run build        # Compile TypeScript
npm test             # Run tests (99 tests)
npm run test:watch   # Watch mode
npx tsc --noEmit     # Type-check only
```

## License

MIT
