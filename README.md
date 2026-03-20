[![npm version](https://img.shields.io/npm/v/memento-memory)](https://www.npmjs.com/package/memento-memory)
[![CI](https://github.com/sanathshetty444/memento/actions/workflows/ci.yml/badge.svg)](https://github.com/sanathshetty444/memento/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

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
- **Browser-compatible** — runs in browsers and extensions via IndexedDB + fetch-based embeddings

## Quick Start

> Requires Node.js >= 20

```bash
# One command — that's it
npx memento-memory setup
```

Or install globally:

```bash
npm install -g memento-memory
memento setup
```

Or from source:

```bash
git clone https://github.com/sanathshetty444/memento.git
cd memento
npm install && npm run build
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
memento setup       # Configure everything (idempotent, safe to re-run)
memento status      # Check what's configured
memento teardown    # Remove config (keeps stored memories)
```

All commands also work with `npx memento-memory <command>`.

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

| Backend | Status | Environment | Description |
|---------|--------|-------------|-------------|
| **Local files** | Default | Node.js | JSON files at `~/.claude-memory/store/`, zero config |
| **IndexedDB** | Default | Browser | Browser-native storage, zero config |
| **ChromaDB** | Optional | Node.js | HTTP-based vector DB (needs running server) |
| **Neo4j** | Optional | Node.js | Graph-enhanced retrieval with relationships |

## Embedding Providers

| Provider | Dimensions | Cost | Environment | Description |
|----------|-----------|------|-------------|-------------|
| **Local** (default) | 384 | Free | Node.js | Transformers.js, all-MiniLM-L6-v2, offline |
| **Gemini** | 768 | Free tier | Node.js | `text-embedding-004` via SDK |
| **Gemini Fetch** | 768 | Free tier | Browser | `text-embedding-004` via fetch API |
| **OpenAI** | 1536 | Paid | Node.js | `text-embedding-3-small` |

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

## Browser Usage

Memento runs in browsers and Chrome extensions via a dedicated entry point:

```typescript
import { MemoryManager, IndexedDBAdapter, GeminiFetchEmbeddingProvider } from "memento-memory/browser";

const store = new IndexedDBAdapter({ dbName: "my-app-memory" });
const embeddings = new GeminiFetchEmbeddingProvider({ apiKey: "your-gemini-key" });

const manager = new MemoryManager({ store, embeddings });
await manager.save({ content: "important context", tags: ["decision"] });
const results = await manager.recall("what was decided?");
```

The browser bundle is ~29KB ESM with zero Node.js dependencies. Uses IndexedDB for storage and the Gemini REST API (via `fetch`) for embeddings.

## Architecture

```
Memento
  ├── CLI (setup / teardown / status)
  ├── MCP Server (stdio)
  │   └── Tools: save, recall, search, forget, list, health, export, migrate
  ├── Memory Manager (orchestrator)
  │   └── Redaction → Tagging → Chunking → Dedup → Embed → Store
  ├── Storage (pluggable)
  │   ├── Local files (default, Node.js)
  │   ├── IndexedDB (default, browser)
  │   ├── ChromaDB (optional)
  │   └── Neo4j (optional)
  ├── Embeddings (pluggable)
  │   ├── Local/Transformers.js (default, Node.js)
  │   ├── Gemini Fetch (browser)
  │   ├── Gemini SDK (optional)
  │   └── OpenAI (optional)
  ├── Hooks (auto-capture)
  │   ├── PostToolUse → capture queue
  │   └── Stop → session summary + queue processing
  ├── Browser Bundle (ESM, ~29KB)
  │   └── import from "memento-memory/browser"
  └── Resilience
      ├── Circuit breaker
      ├── Write-ahead log
      └── LRU cache
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript + browser bundle
npm test             # Run tests (99 tests)
npm test -- --coverage  # Run with coverage report
npm run test:watch   # Watch mode
npm run lint         # Lint with ESLint
npm run lint:fix     # Lint and auto-fix
npm run format       # Format with Prettier
npm run format:check # Check formatting
npx tsc --noEmit     # Type-check only
```

Pre-commit hooks (husky + lint-staged) auto-fix formatting on commit. CI runs lint, typecheck, tests (Node 20 + 22), and build on every PR.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [AGPL-3.0](LICENSE).
