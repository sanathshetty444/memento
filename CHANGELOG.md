# Changelog

## v0.1.0 — 2026-03-19

Initial implementation.

### Features
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
- 64 unit tests passing
