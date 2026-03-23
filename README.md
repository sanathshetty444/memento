[![npm version](https://img.shields.io/npm/v/memento-memory)](https://www.npmjs.com/package/memento-memory)
[![CI](https://github.com/sanathshetty444/memento/actions/workflows/ci.yml/badge.svg)](https://github.com/sanathshetty444/memento/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Docs](https://img.shields.io/badge/docs-live-7c3aed)](https://sanathshetty444.github.io/memento/)

# Memento

Persistent semantic memory for AI coding agents. Save, recall, and search context across sessions — even after autocompact.

Works with **Claude Code**, **OpenCode**, **Cursor**, and **Windsurf**. Runs entirely on your machine — no cloud, no API keys, no data leaving your computer.

## Quick Start

```bash
npx memento-memory setup
```

That's it. Your next session will automatically capture and recall context.

> Requires Node.js >= 20. See [Installation Guide](https://sanathshetty444.github.io/memento/getting-started/installation) for all methods and IDE-specific setup.

## Features

- **Auto-capture** — hooks silently capture every meaningful tool call in the background
- **Survives compaction** — memories persist even when the context window is compressed
- **Semantic recall** — find relevant context by meaning, not exact keywords
- **Hybrid search** — vector (cosine similarity) + keyword (BM25), weighted scoring
- **Smart memory** — contradiction detection, importance scoring, entity extraction, relationship tracking
- **17 MCP tools** — save, recall, search, forget, list, health, export, import, migrate, session management, project indexing, profiling, compaction, and more
- **Cross-project search** — find knowledge across all your projects
- **Auto-tagging** — heuristic classification (code, decision, error, architecture, config, dependency, todo)
- **Sensitive data redaction** — API keys, tokens, passwords stripped before storage
- **Local-first** — works offline with local embeddings (all-MiniLM-L6-v2), zero config
- **Browser-compatible** — runs in browsers and extensions via IndexedDB + fetch-based embeddings
- **HTTP API + Graph UI** — REST endpoints and D3 visualization of your memory graph

## How It Works

```
Session active → PostToolUse hook captures context → queue
Session ends   → Stop hook triggers pipeline:
                 redact → tag → chunk → dedup → embed → store
Next session   → memory_recall restores context automatically
```

See [How It Works](https://sanathshetty444.github.io/memento/getting-started/how-it-works) for the full architecture walkthrough.

## Documentation

**[sanathshetty444.github.io/memento](https://sanathshetty444.github.io/memento/)**

- [Installation](https://sanathshetty444.github.io/memento/getting-started/installation) — setup for all IDEs, troubleshooting
- [Quickstart](https://sanathshetty444.github.io/memento/getting-started/quickstart) — your first memory in 5 minutes
- [Search Modes](https://sanathshetty444.github.io/memento/guides/search-modes) — vector, keyword, and hybrid explained
- [Smart Memory](https://sanathshetty444.github.io/memento/guides/smart-memory) — contradiction detection, importance scoring, entities
- [Configuration](https://sanathshetty444.github.io/memento/guides/configuration) — full config reference
- [MCP Tools Reference](https://sanathshetty444.github.io/memento/reference/tools) — all 17 tools with parameters and examples
- [CLI Reference](https://sanathshetty444.github.io/memento/reference/cli) — setup, status, teardown, serve
- [Architecture](https://sanathshetty444.github.io/memento/architecture/overview) — system overview, memory pipeline, search internals

## Development

```bash
npm install && npm run build   # Build
npm test                       # Run tests
npm run lint                   # Lint
npx tsc --noEmit               # Type-check
```

## Contributing

Contributions welcome! See the [Contributing Guide](https://sanathshetty444.github.io/memento/contributing/CONTRIBUTING).

## License

[AGPL-3.0](LICENSE)
