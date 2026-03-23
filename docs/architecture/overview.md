# Memento Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          User/Agent                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   ┌────▼─────┐         ┌────────▼───────┐
   │   CLI    │         │   HTTP REST    │
   │ (setup,  │         │   API/Server   │
   │  status, │         │  (/ask, /list) │
   │  serve)  │         └────────────────┘
   └────┬─────┘
        │
        │ stdio transport
        │
   ┌────▼──────────────────────────────────────┐
   │     MCP Server (index.ts)                  │
   │                                            │
   │   Registers 17 Tools & Auto-Capture       │
   └────┬───────────────────────────┬──────────┘
        │                           │
   ┌────▼────────┐      ┌──────────▼────────┐
   │ Tools Layer │      │  Hooks & Watcher  │
   │  (17 tools) │      │ (auto-capture)    │
   └────┬────────┘      └──────────┬────────┘
        │                          │
        └────────┬─────────────────┘
                 │
         ┌───────▼──────────────────────────────────┐
         │    Memory Manager (Core Coordinator)     │
         │                                          │
         │  • Orchestrates pipeline stages          │
         │  • Routes to storage & embeddings        │
         │  • Manages namespace isolation           │
         └───────┬──────────────────────────────────┘
                 │
    ┌────────────┼──────────────┬──────────────┐
    │            │              │              │
┌───▼──────┐ ┌──▼───────┐ ┌───▼──────┐ ┌────▼────┐
│ Pipeline │ │ Storage  │ │Embeddings│ │Resilience
│          │ │          │ │          │ │
│ • Redact │ │ • Local  │ │ • Local  │ │• Circuit
│ • Tag    │ │ • Chroma │ │ • Gemini │ │  Breaker
│ • Chunk  │ │ • Neo4j  │ │ • OpenAI │ │• WAL
│ • Dedup  │ │ • HNSW   │ │ • Fetch  │ │• LRU
└──────────┘ └──────────┘ └──────────┘ │  Cache
                                        └────────┘
```

## Module Map and Responsibilities

### Entry Points

| Module | Responsibility |
|--------|-----------------|
| **index.ts** | MCP server lifecycle, tool registration, auto-capture setup |
| **cli.ts** | Command-line interface for setup, status, serve, teardown |
| **server.ts** | HTTP REST API for /ask, /list, /export operations |
| **watcher.ts** | File system watcher for inbox directory auto-ingest |

### Core Pipeline (memory/)

| Module | Responsibility |
|--------|-----------------|
| **types.ts** | Core TypeScript interfaces: Memory, SearchResult, Config, etc. |
| **manager.ts** | Orchestrates save/recall/search workflow, coordinates subsystems |
| **redactor.ts** | Detects & masks sensitive patterns (AWS keys, tokens, passwords) |
| **tagger.ts** | Auto-tags memories with semantic labels (decision, code, error, etc.) |
| **chunker.ts** | Boundary-aware segmentation (paragraph → sentence → word) |
| **deduplicator.ts** | Two-phase dedup: SHA-256 hash phase 1, cosine similarity phase 2 |
| **namespace.ts** | Isolates memories by project, filters on recall |
| **contradiction.ts** | Detects inconsistencies between memories |
| **entities.ts** | Extracts and links named entities (functions, files, packages) |
| **importance.ts** | Scores memory importance for ranking/retention decisions |
| **indexer.ts** | Builds reverse indexes for fast entity lookup |
| **profile.ts** | Builds user coding profile (patterns, languages, files) |
| **relations.ts** | Builds relationship graph between memories |
| **reranker.ts** | Re-ranks search results using LLM or heuristics |
| **compactor.ts** | Merges near-duplicate memories, evicts old entries |

### Storage Layer (storage/)

| Module | Responsibility |
|--------|-----------------|
| **types.ts** | VectorStore interface contract |
| **local-file.ts** | File-based JSON storage with embedded vectors (default) |
| **chromadb.ts** | ChromaDB integration (optional, requires installation) |
| **neo4j.ts** | Neo4j graph database integration (optional) |
| **hnsw.ts** | HNSW approximate nearest neighbor search |
| **indexeddb.ts** | Browser-based IndexedDB (experimental) |

### Embedding Layer (embeddings/)

| Module | Responsibility |
|--------|-----------------|
| **types.ts** | EmbeddingProvider interface contract |
| **local.ts** | all-MiniLM-L6-v2 via @xenova/transformers (default, offline) |
| **gemini.ts** | Google Gemini API integration (optional) |
| **gemini-fetch.ts** | Fetch-based Gemini integration (optional) |
| **openai.ts** | OpenAI API integration (optional) |

### Resilience (resilience/)

| Module | Responsibility |
|--------|-----------------|
| **circuit-breaker.ts** | Prevents cascading failures, manages slow/failing operations |
| **wal.ts** | Write-ahead log for crash recovery |
| **lru-cache.ts** | In-memory cache with stale-while-revalidate strategy |

### Extractors (extractors/)

| Module | Responsibility |
|--------|-----------------|
| **markdown.ts** | Parse markdown, extract headers, code blocks, lists |
| **code.ts** | Extract functions, classes, imports from source code |
| **url.ts** | Fetch and parse web pages |
| **pdf.ts** | Extract text from PDF files |
| **image.ts** | OCR and metadata from images |

### Tools (tools/)

17 MCP tool implementations:
- **save.ts** — Memory persistence
- **recall.ts** — Semantic search with filtering
- **search.ts** — Full-text + vector hybrid search
- **forget.ts** — Memory deletion by ID or tag
- **list.ts** — Enumerate memories (namespace, tag, container filters)
- **health.ts** — System health check
- **import.ts** — Bulk import from JSON/JSONL/Markdown/CSV
- **export.ts** — Bulk export with format selection
- **session-start.ts** — Session context initialization
- **session-summary.ts** — Summarize session learnings
- **index.ts** — Project indexing (README, package.json, etc.)
- **ingest.ts** — File/URL content ingestion
- **profile.ts** — Generate user coding profile
- **migrate.ts** — Re-embed with new model
- **compact.ts** — Cleanup and merge duplicates
- **related.ts** — Find memories by relation graph
- **stats.ts** — Memory statistics and usage

### Tools Index (tools/index.ts)

Central registry that:
- Imports all tool modules
- Defines Zod schemas for each tool's parameters
- Wires up handler functions
- Registers with MCP server via `registerAllTools()`

## Dependency Graph

```
                      ┌────────────────────┐
                      │  index.ts (Entry)  │
                      └─────────┬──────────┘
                                │
                    ┌───────────┴──────────────┐
                    │                          │
            ┌───────▼─────┐        ┌──────────▼───────┐
            │ config.ts   │        │ manager.ts       │
            └─────────────┘        │ (Coordinator)    │
                                   └──────────┬───────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                ┌─────────▼──────────┐ ┌──────▼─────────┐ ┌──────▼──────┐
                │ Pipeline:          │ │ Storage Layer  │ │ Embeddings  │
                │ • redactor         │ │ (VectorStore)  │ │ (Provider)  │
                │ • tagger           │ └────────────────┘ └─────────────┘
                │ • chunker          │
                │ • deduplicator     │
                │ • namespace        │
                │ • entities         │
                │ • indexer          │
                │ • relations        │
                │ • reranker         │
                └────────────────────┘
                          │
                   ┌──────┴──────┐
                   │             │
            ┌──────▼──┐  ┌───────▼────┐
            │Resilience  │ Extractors
            │• CB        │ • markdown
            │• WAL       │ • code
            │• LRU       │ • url
            └───────────┘ └────────────┘
```

## Data Flow: Capture to Storage to Recall

### Save Flow (Persistence)

```
1. Tool receives input (memory text, tags, namespace)
                │
2. Config.ts loads settings
                │
3. Redactor.ts masks sensitive data
                │
4. Tagger.ts auto-assigns semantic tags
                │
5. Chunker.ts breaks into sized segments
                │
6. Deduplicator.ts:
   - Phase 1: SHA-256 hash check (instant duplicates)
   - Phase 2: cosine similarity @ 0.92 threshold (near-dupes)
                │
7. Embeddings provider converts chunks to vectors:
   - Local: @xenova/transformers (384-dim)
   - Gemini/OpenAI: API calls with batching
                │
8. Namespace.ts assigns to project container
                │
9. Entities.ts extracts and links (functions, files, packages)
                │
10. Relations.ts updates relationship graph
                │
11. Importance.ts scores for ranking/retention
                │
12. Storage adapter persists:
    - Local: ~/.claude-memory/store/{namespace}/memory-{id}.json
    - Chroma: in-process or remote HTTP
    - Neo4j: graph nodes + embeddings as properties
                │
13. WAL.ts records save operation for crash recovery
                │
14. Circuit breaker tracks success/failure metrics
```

### Recall Flow (Retrieval)

```
1. Tool receives search query + filters (tags, namespace, dates)
                │
2. Redactor.ts sanitizes query (removes sensitive patterns)
                │
3. Embeddings provider converts query → vector
                │
4. Storage adapter searches:
   - HNSW: nearest neighbor search (M=16, efSearch=50)
   - BM25: keyword matching (k1=1.2, b=0.75)
   - Hybrid: 70% cosine + 30% BM25 weighted score
                │
5. Namespace.ts filters to requested project
                │
6. Reranker.ts re-orders results (LLM or heuristic scoring)
                │
7. Profile.ts applies user context (preferences, patterns)
                │
8. Relations.ts adds related memories
                │
9. Contradiction.ts flags inconsistent results
                │
10. LRU cache stores results for stale-while-revalidate
                │
11. Return ranked SearchResult[] with scores and metadata
```

### File Storage Structure

```
~/.claude-memory/
├── config.json                    # User config (storage, embeddings, namespace)
├── store/
│   └── {namespace}/
│       ├── memory-{uuid}.json     # Individual memory + embedded vector
│       ├── memory-{uuid}.json
│       └── ...
├── wal/
│   └── {timestamp}.log            # Write-ahead log entries
├── cache/
│   └── lru.db                     # LRU cache dump
├── index/
│   ├── entities.json              # Entity index (file → memories)
│   ├── relations.json             # Relationship graph
│   └── profile.json               # User coding profile
└── inbox/
    ├── file-1.md                  # Auto-ingest pending items
    └── file-2.txt
```

## Key Design Principles

1. **Local-First**: Default storage is encrypted JSON files at ~/.claude-memory/, no cloud calls required
2. **Semantic Search**: Vector embeddings (384-dim, all-MiniLM) capture meaning beyond keywords
3. **Resilience**: Circuit breaker, write-ahead log, and LRU cache ensure reliability
4. **Privacy**: On-disk encryption, redaction of secrets, optional air-gap operation
5. **Extensibility**: VectorStore and EmbeddingProvider interfaces allow swapping implementations
6. **Namespace Isolation**: Separate memory stores per project with filtering on recall
7. **Relationship Graph**: Entities and relations enable finding memories by association, not just search
8. **Auto-Capture**: Hooks capture context automatically from conversations and tool use
9. **Heuristic Processing**: All pipeline stages use deterministic rules (no LLM calls in pipeline)
10. **ESM-Only**: Modern JavaScript module system, no CommonJS baggage

## Configuration Lifecycle

1. User runs `memento setup` → interactive config builder
2. Config saved to `~/.claude-memory/config.json` with defaults
3. On startup, `config.ts` loads: env vars → file → hardcoded defaults (env wins)
4. Storage and embedding providers instantiated via factory functions
5. Optional dependencies loaded dynamically with helpful error messages if missing
6. Health checks verify storage and embeddings connectivity
7. WAL recovery runs on startup if needed
