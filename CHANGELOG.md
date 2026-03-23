# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-03-23

### Added
- **9 new MCP tools**: `memory_session_start`, `memory_stats`, `memory_compact`, `memory_related`, `memory_session_summary`, `memory_index_project`, `memory_ingest`, `memory_profile`, `memory_import`
- **Contradiction detection**: auto-detects when new memories supersede existing ones using negation/temporal patterns
- **Importance scoring**: calculates importance (0–1) at save time with exponential decay over time
- **Entity extraction**: indexes file paths, functions, classes, packages, URLs, env vars for knowledge graph
- **Relationship tracking**: graph relations (similar, supersedes, references, contradicts, elaborates) between memories
- **Re-ranking**: post-search re-ranking with recency, source quality, and tag relevance signals
- **User/project profiling**: generates coding patterns and decision history from memory
- **HNSW index**: fast approximate nearest neighbor search for local file adapter
- **BM25 keyword search**: full-text keyword matching with term/document frequency scoring
- **Hybrid search mode**: weighted combination of vector (cosine) + keyword (BM25) scoring
- **Local HTTP REST API** (`memento serve`): REST endpoints mirroring all MCP tools, CORS-enabled, API key support
- **D3.js graph visualization UI**: interactive memory graph with search, namespace/tag filters, force simulation
- **Chrome extension**: save pages/selections to Memento via context menu (Manifest v3)
- **File watchers**: auto-ingest files from `~/.claude-memory/inbox/`
- **Content extractors**: markdown, source code, URL, PDF, and image extractors
- **Multi-IDE CLI support**: `memento setup --target cursor|windsurf` with shared rules files
- **Project indexer**: scan README, package.json, config files for initial knowledge base
- **Performance benchmarks**: MemoryBench-compatible provider adapter, ingestion/search/relevance benchmarks
- **Memory compaction tool**: clean up old, duplicate, and low-importance memories

### Changed
- Version bump from 0.4.0 to 1.0.0 (major release with SuperMemory feature parity)

## [0.4.0] - 2026-03-20

### Added
- OpenCode support: auto-detects OpenCode and configures MCP server + capture plugin during `memento setup`
- OpenCode capture plugin with `tool.execute.after` and `session.idle` hooks

## [0.3.0] - 2026-03-20

### Added
- Browser compatibility: IndexedDB storage adapter, Gemini fetch embedding adapter, browser entry point (`memento-memory/browser`)
- Constructor-based config for MemoryManager (`chunkSize`, `chunkOverlap`, `redactSecrets`, `autoTag`, `deduplicationThreshold`)
- Browser bundle via tsup (29KB ESM, zero Node.js dependencies)

### Fixed
- MCP config now writes to `~/.claude.json` (correct location for Claude Code CLI)
- Stop hook properly detaches queue worker process
- Unified dedup threshold (0.92) and chunk settings (500/100) across all pipelines
- Queue worker now passes local storage config to createStore

### Changed
- `contentHash()` is now async (returns `Promise<string>`) — breaking for direct callers
- API key sent via `x-goog-api-key` header instead of URL query parameter

## [0.2.0] - 2026-03-19

### Added
- CLI setup command (`memento setup`) for zero-config onboarding
- Local file storage adapter (default, zero dependencies)
- PostToolUse + Stop hooks for auto-capture
- `memory_export` and `memory_migrate` MCP tools
- `/recall` and `/remember` slash command skills

## [0.1.0] - 2026-03-19

### Added
- MCP server with stdio transport (6 tools: `memory_save`, `memory_recall`, `memory_search`, `memory_forget`, `memory_list`, `memory_health`)
- ChromaDB storage adapter (local persistent)
- Neo4j storage adapter (optional, graph-enhanced)
- Local embeddings via Transformers.js (all-MiniLM-L6-v2, 384-dim)
- Gemini and OpenAI embedding adapters (optional)
- Memory Manager orchestrator (redaction → tagging → chunking → dedup → embedding → storage)
- Heuristic auto-tagger (8 tag types, no LLM)
- Sensitive data redaction (AWS keys, API keys, bearer tokens, passwords, base64)
- Content chunking with overlap
- SHA-256 + cosine similarity deduplication
- Git-based namespace resolution
- Auto-capture hooks (PostToolUse, Stop) with queue worker
- Circuit breaker, write-ahead log, LRU cache resilience
- `/recall` and `/remember` slash command skills
- Config loader (env vars → config file → defaults)
