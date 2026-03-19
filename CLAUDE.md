# Memento — Project Instructions

## Overview

Memento is a Claude Code plugin + MCP server for persistent semantic memory. It captures conversation context, decisions, and code knowledge into a vector database with semantic retrieval across sessions.

## Tech Stack

- **Language**: TypeScript (ESM, `.js` extensions in imports)
- **MCP SDK**: `@modelcontextprotocol/sdk` (stdio transport)
- **Default Storage**: ChromaDB (local persistent)
- **Optional Storage**: Neo4j (graph-enhanced, `neo4j-driver` optional dep)
- **Default Embeddings**: `@xenova/transformers` (all-MiniLM-L6-v2, 384-dim, offline)
- **Optional Embeddings**: Gemini (`@google/generative-ai`), OpenAI (`openai`) — optional deps
- **Tests**: Vitest
- **Build**: `tsc` → `dist/`

## Git Workflow

- **Remote**: `git@github.com-work:sanathshetty444/memento.git`
- **Identity**: `git config --local user.email "sanathshetty444@gmail.com"`
- **Never push directly to main.** Always create a feature branch and PR.
- **Branch naming**: `<version>-<feat/bug>-<name>` (e.g., `v0.1.0-feat-add-export-tool`)
- **PR title matches branch name.**
- **gh CLI**: Use `-R sanathshetty444/memento` flag (gh is authenticated as `sanath-browserstack`).
- Maintain `CHANGELOG.md` with version numbers and feature/bug entries.

## Commands

- `npm run build` — Compile TypeScript to `dist/`
- `npm test` — Run all tests (`vitest run`)
- `npm run test:watch` — Watch mode tests
- `npx tsc --noEmit` — Type-check without emitting

## Project Structure

```
src/
  index.ts              # MCP server entry point
  config.ts             # Config loader (env → file → defaults)
  tools/                # MCP tool handlers (save, recall, search, forget, list, health)
  memory/               # Core subsystems (types, manager, tagger, chunker, dedup, redactor, namespace)
  storage/              # VectorStore interface + adapters (chromadb, neo4j)
  embeddings/           # EmbeddingProvider interface + adapters (local, gemini, openai)
  hooks/                # Auto-capture hooks (post-tool-use, stop, queue-worker)
  resilience/           # Circuit breaker, WAL, LRU cache
skills/                 # /recall and /remember slash commands
tests/                  # Unit + integration tests
```

## Key Patterns

- Optional dependencies (`neo4j-driver`, `@google/generative-ai`, `openai`) use dynamic imports with error messages. Type stubs in `src/optional-deps.d.ts`.
- Storage and embedding adapters are created via factory functions (`createStore`, `createEmbeddingProvider`) with dynamic imports.
- Config lives at `~/.claude-memory/config.json`, data at `~/.claude-memory/`.
- All MCP tools are registered in `src/tools/index.ts` via `registerAllTools()`.
