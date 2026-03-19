## 1. System Architecture

**The Problem:** We need to build a persistent semantic memory system that captures, indexes, and retrieves conversation context across Claude Code sessions. It must work fully offline with local infrastructure, support pluggable storage and embedding backends, and be designed for a future freemium SaaS layer.

**Architecture Overview:**

```
+-----------------------------------------------------------+
|  Claude Code Plugin (memento)                             |
|  +----------+  +----------+  +--------------------+      |
|  | /recall  |  | /remember|  | Hooks              |      |
|  | skill    |  | skill    |  | PostToolUse > Queue|      |
|  +----+-----+  +----+-----+  | Stop > Summary     |      |
|       |              |        +--------+-----------+      |
|  +----v--------------v-----------------v-----------+      |
|  |  MCP Server (stdio transport)                   |      |
|  |  Tools: memory_save, memory_recall,             |      |
|  |         memory_search, memory_forget,           |      |
|  |         memory_list, memory_health,             |      |
|  |         memory_migrate, memory_export           |      |
|  +------------------------+------------------------+      |
|                           |                               |
|  +------------------------v------------------------+      |
|  |  Memory Manager (orchestrator)                  |      |
|  |  Redaction > Tagger > Chunker > Dedup > Store   |      |
|  +--------+-------------------+--------------------+      |
|           |                   |                           |
|  +--------v--------+  +------v-------+                    |
|  | VectorStore      |  | Embeddings   |                   |
|  | - ChromaDB       |  | - Local      |                   |
|  | - Neo4j          |  | - Gemini     |                   |
|  | - Cloud (future) |  | - OpenAI     |                   |
|  | (pluggable)      |  | - Cloud      |                   |
|  +-----------------+  +--------------+                    |
+-----------------------------------------------------------+
```

**Data Flow — Save:**
```
Content -> Redactor (scrub secrets) -> Tagger (auto-classify) -> Chunker (split if >1000 words)
  -> Embedder (generate vectors) -> Dedup (hash + similarity check) -> VectorStore.upsert()
```

**Data Flow — Recall:**
```
Query -> Embedder (embed query) -> VectorStore.search(vector, filters)
  -> Dedup by parentId -> Rank by score -> Return top results
```

## 2. Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| MCP Server | `@modelcontextprotocol/sdk` (TypeScript) | Standard Claude integration protocol |
| Default Storage | ChromaDB (`chromadb` npm) | Zero-config local vector DB, persistent, SQLite-backed |
| Graph Storage | Neo4j (`neo4j-driver`) | Reuses omnigraph-ai infrastructure, graph-enhanced retrieval |
| Local Embeddings | `@xenova/transformers` (all-MiniLM-L6-v2, 384-dim) | Offline, free, ~50ms per embed, ~80MB RAM |
| Cloud Embeddings | `@google/generative-ai`, `openai` | Higher quality vectors, compatible with omnigraph-ai |
| Build | TypeScript -> ESM | Matches Claude Code plugin ecosystem |
| Tests | Vitest | Fast, ESM-native, TypeScript-first |
| omnigraph-ai | Local package dep (`file:../omnigraph-ai`) | Reuses Neo4j patterns, Gemini embedding generation |

## 3. Data Model

### MemoryEntry (core schema)

```typescript
interface MemoryEntry {
  id: string;                    // uuid v4
  content: string;               // Original text (post-redaction)
  embedding?: number[];          // Computed vector
  contentHash: string;           // SHA-256 of normalized content (dedup)
  parentId?: string;             // Links chunks from same source memory

  metadata: {
    namespace: string;           // Project ID (git repo name) or "__global__"
    tags: MemoryTag[];           // Semantic classification
    timestamp: string;           // ISO 8601
    source: MemorySource;        // How captured
    files?: string[];            // Associated file paths
    functions?: string[];        // Referenced function names
    sessionId?: string;          // Claude Code session ID
    summary?: string;            // Short description for list views
    relatedMemoryIds?: string[]; // Near-duplicate links
  };
}

type MemoryTag = "conversation" | "decision" | "code" | "error"
               | "architecture" | "config" | "dependency" | "todo";

type MemorySource = "explicit" | "hook:post_tool_use" | "hook:stop";
```

### ChromaDB Mapping
- Each `namespace` -> separate ChromaDB collection
- `content` -> ChromaDB document, `embedding` -> ChromaDB embedding vector
- All metadata fields -> ChromaDB metadata (filterable via `$and` where clauses)
- Persistent storage at `~/.claude-memory/chromadb/`

### Neo4j Graph Model
```
(:Memory {id, content, contentHash, namespace, tags[], timestamp, source, summary, sessionId, embedding})
  -[:REFERENCES_FILE]-> (:File {path})
  -[:REFERENCES_FUNCTION]-> (:Function {name})
  -[:RELATED_TO]-> (:Memory)
```
- Vector index: `CREATE VECTOR INDEX memory_embeddings FOR (m:Memory) ON (m.embedding)` (configurable dimensions)
- Search: `db.index.vector.queryNodes` (same pattern as omnigraph-ai's `findSimilarChunks` in `graph-builder.ts`)

## 4. Storage Abstraction Layer

```typescript
interface VectorStore {
  initialize(): Promise<void>;
  upsert(entry: MemoryEntry): Promise<void>;
  search(queryEmbedding: number[], filters: {
    namespace?: string;
    tags?: string[];
    after?: string;       // ISO date lower bound
    before?: string;      // ISO date upper bound
    limit: number;
  }): Promise<MemoryResult[]>;
  delete(id: string): Promise<boolean>;
  list(filters: {
    namespace?: string;
    tags?: string[];
    limit: number;
    offset: number;
  }): Promise<MemoryEntry[]>;
  close(): Promise<void>;
}

interface MemoryResult {
  entry: MemoryEntry;
  score: number;          // Similarity score 0-1
}
```

**ChromaDB Adapter:** `PersistentClient` at `~/.claude-memory/chromadb/`. WAL mode for concurrent reads. Each namespace maps to a collection.

**Neo4j Adapter:** Imports `initializeNeo4jDriver()` and vector search patterns from omnigraph-ai's `graph-builder.ts`. Uses Cypher `WHERE` for metadata filtering on top of vector similarity.

**Cloud Adapter (future):** Forwards all operations to Memento SaaS API via REST. Handles offline fallback (queue writes locally, sync when online).

## 5. Embedding Abstraction Layer

```typescript
interface EmbeddingProvider {
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

| Adapter | Model | Dimensions | Latency | Cost | Use Case |
|---------|-------|-----------|---------|------|----------|
| Local (default) | all-MiniLM-L6-v2 | 384 | ~50ms | Free, offline | Default, zero-config |
| Gemini | gemini-embedding-001 | 3072 | ~150ms | Free tier | Matches omnigraph-ai vector space |
| OpenAI | text-embedding-3-small | 1536 | ~100ms | Paid | High quality |
| Cloud (future) | Managed | Variable | ~100ms | Freemium | SaaS tier |

Dynamic imports: factories use `await import()` so unused adapters are never loaded.

## 6. MCP Tools

| Tool | Parameters | Returns | Description |
|------|-----------|---------|-------------|
| `memory_save` | content: string, tags?: MemoryTag[], namespace?: string, global?: boolean | { id, tags, namespace } | Explicit context save |
| `memory_recall` | query: string, namespace?: string, tags?: MemoryTag[], limit?: number (default 5) | MemoryResult[] | Semantic search within project |
| `memory_search` | query: string, tags?: MemoryTag[], limit?: number | MemoryResult[] | Cross-project search (no namespace filter) |
| `memory_forget` | id: string | { success: boolean } | Delete specific memory |
| `memory_list` | namespace?: string, tags?: MemoryTag[], limit?: number, offset?: number | MemoryEntry[] | Browse memories (timestamp desc) |
| `memory_health` | - | { storage, status, circuit_state, wal_pending, last_error } | System health check |
| `memory_migrate` | - | { status, progress, total } | Re-embed after model switch |
| `memory_export` | format?: "jsonl" | { path, count } | Export to canonical format |

## 7. Auto-Capture Pipeline

### Hook Architecture

**PostToolUse Hook:**
```
Event received (tool_name, input, output)
  -> Tier 1: Tool filter
     SKIP: Read, Glob, Grep, Bash:ls, Bash:cat, Bash:head, Bash:tail, memory_*
     CAPTURE: Edit, Write, Bash:git, Bash:npm, Bash:docker
  -> Tier 2: Significance scoring (0-5)
     Output length (>50 chars: +1), file-modifying (+2), state-changing (+1), error output (+1)
     Threshold: score >= 3
  -> Tier 3: Append to ~/.claude-memory/capture-queue.jsonl
     Fire-and-forget, target < 50ms total
```

**Stop Hook:**
```
Session ending -> Capture session summary with all files touched
  -> Tag as "conversation" with session metadata
```

**Background Queue Worker:**
- Polls `~/.claude-memory/capture-queue.jsonl` every 2 seconds
- Batches entries (accumulate 5 seconds before processing)
- Processes through Memory Manager pipeline (redact -> tag -> chunk -> embed -> dedup -> store)

### Circular Capture Prevention
- Hook checks if tool name starts with `memory_` -> skip immediately
- Lockfile `~/.claude-memory/.processing` during MCP tool execution

### Sensitive Data Redaction

Pre-embedding regex scrubbing:
- API keys: `(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*\S+`
- Bearer tokens: `(?i)bearer\s+\S+`
- AWS keys: `AKIA[0-9A-Z]{16}`
- GitHub tokens: `gh[ps]_[A-Za-z0-9_]+`
- Base64 blocks > 40 chars
- File path exclusion: `.env*`, `*credentials*`, `*.pem`, `*.key`
- User-configurable patterns in `~/.claude-memory/config.json`

## 8. Auto-Tagging (Heuristic, No LLM)

| Tag | Detection Heuristics |
|-----|---------------------|
| `code` | Code fences (triple backticks), file paths with extensions, function/class signatures |
| `error` | "error", "exception", "failed", stack traces, exit codes |
| `decision` | "decided", "chose", "because", "trade-off", "instead of", "went with" |
| `architecture` | "component", "module", "service", "layer", "interface", "pattern", "schema" |
| `config` | Env var patterns (`[A-Z_]+=`), config file references, "settings" |
| `dependency` | Package names (@scope/pkg), version numbers, "install", "upgrade", "npm", "pip" |
| `todo` | "TODO", "FIXME", "HACK", "need to", "should", "later" |
| `conversation` | Fallback default when no other tag matches |

Multiple tags per entry. Zero API calls. Deterministic.

## 9. Namespace Resolution

1. Walk upward from cwd looking for `.git` directory
2. If found: use the git repo root directory name as namespace
3. If not found: use the cwd directory name
4. Special namespace `__global__` for cross-project and user-level knowledge

## 10. Resilience

### Circuit Breaker
State machine wrapping all VectorStore operations:
- **CLOSED** (normal): track last 10 operations
- 5/10 failures -> **OPEN**: all ops return immediately with fallback
- After 30s -> **HALF_OPEN**: allow one probe
- Probe succeeds -> **CLOSED**; fails -> **OPEN** (doubled timeout, max 300s)

### Write-Ahead Log (WAL)
- Append-only JSONL at `~/.claude-memory/wal.jsonl`
- Every write appends BEFORE storage attempt
- On MCP server startup: replay any "pending" entries
- Daily rotation, committed entries pruned after 7 days

### In-Memory Cache
- LRU cache of last 100 memory entries
- Populated during normal reads
- Fallback when storage unavailable (circuit OPEN)

### Deduplication
- **Phase 1:** SHA-256 content hash (exact match, zero cost)
- **Phase 2:** Post-embedding cosine similarity >= 0.92 check
  - New is longer -> update existing (enrichment)
  - New is equivalent -> skip
  - New is related (0.85-0.92) -> store with `relatedMemoryIds` link

### Concurrent Access
- ChromaDB: SQLite WAL mode + `flock` advisory locks for writes
- Retry: 3 attempts, exponential backoff (100ms / 200ms / 400ms)
- Session ID tagging for conflict tracing

## 11. Embedding Model Migration

When the configured model differs from the stored collection's model:
1. **Detect** at startup: compare `config.embeddings.type` vs collection metadata
2. **Create** new collection with new model identifier
3. **Dual-read**: query both old and new collections, rank-fusion merge results
4. **`memory_migrate` tool**: explicit background re-embedding in batches of 50
5. **Track state** in `~/.claude-memory/migration-state.json`
6. **Fallback**: if old model unavailable, keyword search on old collection's raw text

## 12. Configuration

Load order: environment variables -> `~/.claude-memory/config.json` -> defaults

```json
{
  "mode": "local",
  "store": {
    "type": "chromadb",
    "chromadb": { "path": "~/.claude-memory/chromadb" },
    "neo4j": { "url": "bolt://localhost:7687", "username": "neo4j", "password": "" }
  },
  "embeddings": {
    "type": "local",
    "local": { "modelPath": "~/.claude-memory/models" },
    "gemini": { "apiKey": "" },
    "openai": { "apiKey": "" }
  },
  "capture": {
    "enabled": true,
    "skipTools": ["Read", "Glob", "Grep"],
    "redactionPatterns": []
  },
  "memory": {
    "maxPerProject": 10000,
    "ttlDays": 180,
    "compactionThreshold": 0.92
  }
}
```

**Mode options:**
- `"local"` (default): Everything on-machine, zero cost
- `"cloud"` (future): Everything via Memento SaaS API
- `"hybrid"` (future): Local primary + cloud sync

## 13. Directory Structure

```
memento/
  package.json
  tsconfig.json
  plugin.json
  PRD.md
  Techspec.md
  src/
    index.ts                        # MCP server entry point (stdio)
    tools/
      index.ts                      # Tool registry
      save-context.ts               # memory_save
      recall-context.ts             # memory_recall
      search-memory.ts              # memory_search (cross-project)
      forget.ts                     # memory_forget
      list-memories.ts              # memory_list
      health.ts                     # memory_health
      migrate.ts                    # memory_migrate
      export-import.ts              # memory_export / memory_import
    memory/
      types.ts                      # Core interfaces (MemoryEntry, etc.)
      memory-manager.ts             # Orchestrator
      chunker.ts                    # Semantic text chunking
      tagger.ts                     # Heuristic auto-classification
      namespace.ts                  # Project ID resolution
      dedup.ts                      # Deduplication logic
      redactor.ts                   # Sensitive data scrubbing
    storage/
      interface.ts                  # VectorStore interface
      chromadb-adapter.ts           # Default local adapter
      neo4j-adapter.ts              # Graph-enhanced (uses omnigraph-ai)
      index.ts                      # Factory
    embeddings/
      interface.ts                  # EmbeddingProvider interface
      local-adapter.ts              # transformers.js (384-dim)
      gemini-adapter.ts             # Gemini (3072-dim)
      openai-adapter.ts             # OpenAI (1536-dim)
      index.ts                      # Factory
    hooks/
      post-tool-use.ts              # Auto-capture hook
      stop.ts                       # Session-end summary
      queue-worker.ts               # Background batch processor
    resilience/
      circuit-breaker.ts            # Circuit breaker pattern
      wal.ts                        # Write-ahead log
      cache.ts                      # In-memory LRU cache
    config.ts                       # Configuration loader
  skills/
    recall.md                       # /recall skill
    remember.md                     # /remember skill
  tests/
    memory-manager.test.ts
    chunker.test.ts
    tagger.test.ts
    dedup.test.ts
    redactor.test.ts
    chromadb-adapter.test.ts
    neo4j-adapter.test.ts
    local-embeddings.test.ts
    integration/
      full-pipeline.test.ts
```

## 14. omnigraph-ai Integration

omnigraph-ai is a separate git repository referenced as a local package dependency:
```json
{ "omnigraph-ai": "file:../omnigraph-ai" }
```

**What we import:**
- Neo4j driver initialization patterns from `src/lib/ai/graph-builder.ts`
- Vector index creation and `db.index.vector.queryNodes` query patterns
- Gemini embedding generation from `src/lib/ai/provider.ts`

**Shared vector space:** When using Neo4j + Gemini, memento memories and omnigraph-ai documents share the same Neo4j instance. Different node labels (`Memory` vs `Document`/`Chunk`) prevent collision. Future: cross-query between them ("recall things I discussed about this document").

## 15. Future: SaaS / Freemium Layer

### Cloud Storage Adapter
- Implements VectorStore interface, forwards to Memento SaaS API
- Auth via API key or OAuth
- Offline fallback: queue writes locally, sync when online

### Cloud Embedding Adapter
- Forwards to SaaS (no local model needed)
- Reduces client resource usage

### Sync Engine
- Bidirectional sync between local and cloud
- Last-write-wins with version vectors
- Selective: user chooses which projects to sync

### Freemium Tiers
| Tier | Storage | Embeddings | Sync | Team | Price |
|------|---------|-----------|------|------|-------|
| Free | Local only | Local only | None | None | $0 |
| Pro | Local + Cloud | Cloud managed | Cross-device | Up to 5 | TBD |
| Team | Cloud primary | Cloud managed | Real-time | Unlimited | TBD |
