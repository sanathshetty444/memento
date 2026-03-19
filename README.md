# Memento

Persistent semantic memory for Claude Code. Save, recall, and search context across sessions — even after autocompact.

## What it does

Memento is a Claude Code plugin + MCP server that captures conversation context, decisions, and code knowledge into a vector database with semantic retrieval. No more re-explaining context every new session.

- **Semantic save & recall** — save context explicitly or let hooks capture it automatically
- **Cross-project search** — find knowledge across all your projects
- **Auto-tagging** — heuristic classification (code, decision, error, architecture, config, dependency, todo)
- **Sensitive data redaction** — API keys, tokens, passwords stripped before storage
- **Deduplication** — hash + cosine similarity prevents redundant entries
- **Local-first** — works offline with local embeddings, zero API keys required

## Quick Start

```bash
# Install
cd memento
npm install

# Build
npm run build

# Add to your MCP config (~/.claude/mcp.json or .mcp.json)
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memento/dist/index.js"]
    }
  }
}
```

Then in Claude Code:

```
> remember that auth uses JWT with refresh tokens
> what did we decide about auth?
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `memory_save` | Save context with optional tags, namespace, global flag |
| `memory_recall` | Semantic search within current project |
| `memory_search` | Cross-project semantic search |
| `memory_forget` | Delete a memory by ID |
| `memory_list` | Browse memories with filters |
| `memory_health` | Storage status and diagnostics |

## Storage Backends

| Backend | Status | Description |
|---------|--------|-------------|
| **ChromaDB** | Default | Local persistent vector DB, zero config |
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
    "type": "chromadb",
    "chromaPath": "~/.claude-memory/chromadb"
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
Claude Code Plugin
  ├── MCP Server (stdio)
  │   └── Tools: save, recall, search, forget, list, health
  ├── Memory Manager (orchestrator)
  │   └── Redaction → Tagging → Chunking → Dedup → Embed → Store
  ├── Storage (pluggable)
  │   ├── ChromaDB (default)
  │   └── Neo4j (optional)
  ├── Embeddings (pluggable)
  │   ├── Local/Transformers.js (default)
  │   ├── Gemini (optional)
  │   └── OpenAI (optional)
  ├── Hooks (auto-capture)
  │   ├── PostToolUse → capture queue
  │   └── Stop → session summary
  └── Resilience
      ├── Circuit breaker
      ├── Write-ahead log
      └── LRU cache
```

## Development

```bash
npm run build        # Compile TypeScript
npm test             # Run tests (64 tests)
npm run test:watch   # Watch mode
npx tsc --noEmit     # Type-check only
```

## License

MIT
