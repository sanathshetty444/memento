# Memento Documentation

Persistent semantic memory for AI coding agents. Save, recall, and search context across sessions — even after autocompact.

Memento works with **Claude Code**, **OpenCode**, **Cursor**, and **Windsurf**. It runs entirely on your machine — no cloud, no API keys, no data leaving your computer.

---

## Getting Started

New to Memento? Start here.

- [**Installation**](getting-started/installation.md) — System requirements, setup for all IDEs, troubleshooting
- [**Quickstart**](getting-started/quickstart.md) — Your first memory in 5 minutes
- [**How It Works**](getting-started/how-it-works.md) — Architecture overview, the capture pipeline, how recall works
- [**Upgrading from v0.x**](getting-started/upgrading.md) — Migration guide, breaking changes, new features

## Guides

Learn how to use every feature.

- [**Auto-Capture**](guides/auto-capture.md) — How hooks capture context silently in the background
- [**Search Modes**](guides/search-modes.md) — Vector, keyword, and hybrid search explained
- [**Smart Memory**](guides/smart-memory.md) — Contradiction detection, importance scoring, entity extraction, relationships
- [**Multi-IDE Setup**](guides/multi-ide-setup.md) — Claude Code, OpenCode, Cursor, Windsurf configuration
- [**Project Indexing**](guides/project-indexing.md) — Bootstrap context with memory_index and memory_ingest
- [**Export & Import**](guides/export-import.md) — Backups, migration, all 4 formats
- [**Compaction**](guides/compaction.md) — Cleaning up old and duplicate memories
- [**Browser Usage**](guides/browser-usage.md) — Browser bundle, IndexedDB, Chrome extension
- [**HTTP API & Graph UI**](guides/http-api.md) — REST endpoints, D3 visualization, integrations
- [**Configuration**](guides/configuration.md) — Full config reference, storage backends, embedding providers

## Reference

Definitive reference for every tool, type, and endpoint.

- [**MCP Tools (all 17)**](reference/tools.md) — Parameters, examples, and responses for every tool
- [**CLI Commands**](reference/cli.md) — setup, status, teardown, serve
- [**Storage Backends**](reference/storage-backends.md) — Local files, IndexedDB, ChromaDB, Neo4j
- [**Embedding Providers**](reference/embedding-providers.md) — Local/MiniLM, Gemini, OpenAI
- [**TypeScript Types**](reference/types.md) — MemoryEntry, MemoryRelation, VectorStore, EmbeddingProvider
- [**REST API**](reference/rest-api.md) — OpenAPI-style endpoint reference

## Architecture

How Memento works under the hood.

- [**System Overview**](architecture/overview.md) — Diagrams, module map, data flow
- [**Memory Pipeline**](architecture/memory-pipeline.md) — Redaction, tagging, chunking, dedup, embedding, storage
- [**Resilience**](architecture/resilience.md) — Circuit breaker, write-ahead log, LRU cache
- [**Search Internals**](architecture/search-internals.md) — HNSW, BM25, hybrid scoring math
- [**Architecture Decisions**](architecture/decisions.md) — ADRs: why local-first, why AGPL, why MiniLM

## Contributing

Want to improve Memento?

- [**Contributing Guide**](contributing/CONTRIBUTING.md) — Setup, branch naming, PR guidelines
- [**Code Style**](contributing/code-style.md) — ESLint, Prettier, ESM conventions
- [**Testing**](contributing/testing.md) — Vitest patterns, coverage thresholds, mocking
- [**Adding a Tool**](contributing/adding-a-tool.md) — Step-by-step guide to create a new MCP tool
- [**Adding a Storage Backend**](contributing/adding-a-storage-backend.md) — VectorStore interface, adapter pattern

---

## Quick Links

- [GitHub Repository](https://github.com/sanathshetty444/memento)
- [npm Package](https://www.npmjs.com/package/memento-memory)
- [Changelog](https://github.com/sanathshetty444/memento/blob/main/CHANGELOG.md)
- [License (AGPL-3.0)](https://github.com/sanathshetty444/memento/blob/main/LICENSE)
