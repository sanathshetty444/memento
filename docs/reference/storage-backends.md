# Storage Backends Reference

Complete reference for all storage backends supported by Memento. Each backend has different trade-offs and use cases.

---

## Overview

Memento supports 4 storage backends:

| Backend | Environment | Default | Status | Use Case |
|---------|-------------|---------|--------|----------|
| **Local Files** | Node.js (server) | ✓ Yes | Stable | Development, single-machine, offline |
| **IndexedDB** | Browser | — | Stable | Browser extensions, client-side memory |
| **ChromaDB** | Node.js (server) | — | Optional | Production, better search, semantic focus |
| **Neo4j** | Node.js + Neo4j server | — | Optional | Graph-heavy workflows, relation analysis |

---

## 1. Local Files (Default)

### Overview

Stores memories as JSON files in the local file system. No external dependencies. Default for all installations.

### Configuration

**Type:** `local`

**Config file:** `~/.claude-memory/config.json`

```json
{
  "store": {
    "type": "local",
    "localPath": "~/.claude-memory/store"
  }
}
```

### Directory Structure

```
~/.claude-memory/store/
├── memories.jsonl          # All memory entries (line-delimited JSON)
├── index.json              # HNSW vector index (serialized)
├── entities.json           # Entity-to-memory mappings
├── relations.json          # Memory relations graph
└── metadata.json           # Index metadata
```

### Key Files

**memories.jsonl** — One JSON object per line, each line = 1 memory entry

```jsonl
{"id": "uuid-1", "content": "...", "embedding": [...], "contentHash": "abc123", "metadata": {...}}
{"id": "uuid-2", "content": "...", "embedding": [...], "contentHash": "def456", "metadata": {...}}
```

**index.json** — Hierarchical Navigable Small World (HNSW) vector index for similarity search

**entities.json** — Maps entities (file paths, function names) to memory IDs

```json
{
  "auth.ts": ["uuid-1", "uuid-3", "uuid-7"],
  "handleLogin": ["uuid-2", "uuid-4"],
  "express": ["uuid-1", "uuid-5", "uuid-6"]
}
```

**relations.json** — Memory relation graph (similar, supersedes, references, etc.)

```json
[
  {"sourceId": "uuid-1", "targetId": "uuid-2", "type": "supersedes", "strength": 0.95, "createdAt": "2026-03-20T10:00:00Z"},
  {"sourceId": "uuid-2", "targetId": "uuid-3", "type": "references", "strength": 0.87, "createdAt": "2026-03-20T11:00:00Z"}
]
```

### Dependencies

None. Uses only Node.js built-in modules (`fs`, `path`).

### Trade-offs

| Pros | Cons |
|------|------|
| Zero external dependencies | No network redundancy |
| Fast local access | Slower with >50K entries |
| Easy to backup (copy directory) | File system limits (ext4 max 4K per inode) |
| Works offline | Vector search slower than dedicated systems |
| Simple setup | Not suitable for distributed teams |
| Human-readable JSON | Concurrent writes can corrupt data |

### Setup Instructions

1. Install Memento (includes local backend by default):

```bash
npm install -g memento-memory
# or
npx memento-memory setup
```

2. Default config already uses local storage. Verify:

```bash
cat ~/.claude-memory/config.json | jq '.store.type'
# Output: "local"
```

3. (Optional) Change storage path:

```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "store": {
    "type": "local",
    "localPath": "/custom/path/memento-store"
  }
}
EOF
```

### Environment Variables

```bash
# Override storage path
MEMENTO_LOCAL_PATH=/custom/path memento serve

# Or via store type
MEMENTO_STORE_TYPE=local MEMENTO_LOCAL_PATH=/custom/path memento serve
```

### Performance Characteristics

- **Insert**: O(log N) for HNSW index update, O(1) for appending to JSON file
- **Search (vector)**: O(log N) on HNSW tree + O(K) for filtering (K = results)
- **Search (keyword)**: O(N) full scan with BM25 scoring
- **Delete**: O(N) full file rewrite (to remove entry)
- **Compact**: O(N log N) for dedup detection + rewriting

| Operation | Entries | Time |
|-----------|---------|------|
| Save | 1 | ~10ms |
| Recall (vector) | 1000 | ~20ms |
| Recall (keyword) | 1000 | ~50ms |
| Forget | 1000 | ~100ms (file rewrite) |
| Compact | 5000 | ~500ms |

### Backup and Recovery

**Backup:**

```bash
cp -r ~/.claude-memory ~/memento-backup
# Or create tarball
tar czf ~/memento-backup-$(date +%s).tar.gz ~/.claude-memory
```

**Restore:**

```bash
cp -r ~/memento-backup ~/.claude-memory
# Or extract tarball
tar xzf ~/memento-backup-2026-03-20.tar.gz -C ~/
```

**Verify integrity:**

```bash
# Count entries
grep -c "^{" ~/.claude-memory/store/memories.jsonl

# Validate JSON
jq '.' ~/.claude-memory/store/memories.jsonl > /dev/null
```

### Limitations

- **File size limit**: Typical ext4 filesystem has 4GB file size limit. At 2KB per entry, supports ~2M entries before hitting limits
- **Concurrent writes**: Multiple processes writing simultaneously can corrupt memories.jsonl. Lock file prevents this but may cause slowdowns
- **No replication**: Single point of failure. Use backups for safety
- **Slower than specialized systems**: HNSW search slower than ChromaDB or Pinecone at scale

### When to Use

✓ **Good for:**
- Development and testing
- Single-user workflows
- Projects with <50K memories
- Offline-first applications
- Quick prototyping
- Self-hosted, offline solutions

✗ **Not ideal for:**
- Teams sharing memory across machines
- >100K entries
- High-throughput insert scenarios
- Distributed deployments

---

## 2. IndexedDB (Browser)

### Overview

Browser-based storage using IndexedDB API. No network required. Persists across browser sessions.

### Configuration

**Type:** `indexeddb`

**Browser package:** `memento-memory/browser`

```javascript
// In browser extension or web app
import { createStore } from "memento-memory/browser";

const store = await createStore({
  type: "indexeddb",
  databaseName: "memento_db"
});
```

### Prerequisites

- Browser with IndexedDB support (all modern browsers)
- Memento browser build: `npm install memento-memory`
- Import from `memento-memory/browser` export

### Storage Characteristics

- **Storage location**: Browser local storage (IndexedDB)
- **Quota**: Typically 50MB-1GB per origin (varies by browser)
- **Persistence**: Survives browser restart, clears on "clear browsing data"
- **Scope**: Per-origin (domain + protocol). Chrome extension = different origin than web app

### Usage Example

```javascript
import { createStore } from "memento-memory/browser";

// Create IndexedDB store
const store = await createStore({
  type: "indexeddb",
  databaseName: "memento-extension-db"
});

// Use same API as other backends
await store.upsert({
  id: "uuid-1",
  content: "Important decision about caching strategy",
  metadata: { namespace: "project", tags: ["decision"] }
});

const results = await store.search([...embedding], { limit: 10 });
```

### Trade-offs

| Pros | Cons |
|------|------|
| No backend server needed | Limited storage quota (50MB-1GB) |
| Works offline | Slower than server storage |
| Persists across sessions | Cleared on "clear cache" |
| Per-extension isolation | Can't share data across tabs easily |
| Good for extensions | Browser-specific (no sync) |

### Setup Instructions

1. Install browser-compatible build:

```bash
npm install memento-memory
```

2. Import browser export:

```javascript
import { createStore } from "memento-memory/browser";

const store = await createStore({ type: "indexeddb" });
```

3. Use in extension or web app context

### Browser Compatibility

| Browser | Support | Quota |
|---------|---------|-------|
| Chrome | ✓ Yes | 50MB (can request more) |
| Firefox | ✓ Yes | 50MB minimum, no limit with permission |
| Safari | ✓ Yes (iOS 13.4+) | 50MB |
| Edge | ✓ Yes | 50MB |

### Limitations

- **Quota exhaustion**: Need to compact/delete old entries if quota exceeded
- **No sync**: Data isolated per browser. Can't access from different machine
- **No replication**: Single point of failure (browser deletion = data loss)
- **Slow at scale**: >10K entries becomes slow for searches
- **No graphs**: Relations graph not as efficient as dedicated systems

### When to Use

✓ **Good for:**
- Browser extensions
- Web-based clients
- Offline-first web apps
- Per-user browser-local memory
- Chrome/Firefox extensions for IDE

✗ **Not ideal for:**
- Shared team memory
- Large datasets (>10K entries)
- High-throughput applications
- Cloud-based deployments

---

## 3. ChromaDB

### Overview

Dedicated vector database optimized for semantic search. Best for production deployments with moderate-to-large memory stores.

### Configuration

**Type:** `chromadb`

**Config file:** `~/.claude-memory/config.json`

```json
{
  "store": {
    "type": "chromadb",
    "chromaPath": "~/.claude-memory/chromadb"
  }
}
```

### Installation

ChromaDB is an optional dependency:

```bash
npm install chromadb chromadb-default-embed
```

### Directory Structure

```
~/.claude-memory/chromadb/
├── chroma.sqlite3              # Main database file
├── index/                      # Embedding indices
│   └── ...
└── migrations/                 # Database schema versions
```

### Key Features

- **Built-in embedding support** (Hugging Face Transformers)
- **Hybrid search** (vector + metadata filters)
- **Persistent SQLite** database
- **HNSW indexing** (Hierarchical Navigable Small World)
- **Full-text search** on metadata

### Configuration Options

```json
{
  "store": {
    "type": "chromadb",
    "chromaPath": "~/.claude-memory/chromadb",
    "allowReset": true,
    "isChroot": false
  }
}
```

### Environment Variables

```bash
MEMENTO_STORE_TYPE=chromadb
MEMENTO_CHROMA_PATH=~/.claude-memory/chromadb
memento serve
```

### Performance Characteristics

| Operation | Entries | Time |
|-----------|---------|------|
| Save | 1 | ~15ms |
| Recall (vector) | 10K | ~30ms |
| Recall (hybrid) | 10K | ~50ms |
| Forget | 10K | ~10ms |
| Compact | 50K | ~1s |

### Trade-offs

| Pros | Cons |
|------|------|
| Optimized for vector search | Requires separate installation |
| Better search than local | Heavier resource footprint |
| Built-in embeddings support | SQLite limitations at very large scale |
| Full-text search on metadata | Not distributed (single machine) |
| HNSW indexing efficient | Learning curve vs local |
| Production-ready | More complex setup |

### Setup Instructions

1. Install ChromaDB:

```bash
npm install chromadb chromadb-default-embed
```

2. Update config:

```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "store": {
    "type": "chromadb",
    "chromaPath": "~/.claude-memory/chromadb"
  }
}
EOF
```

3. Migrate existing data (if switching from local):

```bash
# Use memory_migrate tool to re-embed all entries
memento serve &
# Then call memory_migrate via API or MCP
```

4. Verify:

```bash
ls -lh ~/.claude-memory/chromadb/chroma.sqlite3
```

### Limitations

- **Single machine**: Not distributed. No built-in replication
- **SQLite limits**: Performance degradation at >1M entries
- **No authentication**: Designed for local use, not multi-tenant
- **Memory usage**: Keeps indices in memory, can use significant RAM with large datasets

### When to Use

✓ **Good for:**
- Production single-machine deployments
- 10K-500K memories
- Better search quality than local
- Self-hosted solutions
- Development with larger datasets

✗ **Not ideal for:**
- Distributed teams
- >1M entries
- Multi-tenant systems
- Cloud-native deployments

---

## 4. Neo4j

### Overview

Graph database for memory relationships. Best when relation queries are frequent (finding similar memories, tracing decision chains).

### Configuration

**Type:** `neo4j`

**Prerequisites:**

1. Neo4j server running (local or remote)
2. neo4j-driver package installed

```bash
npm install neo4j-driver
```

**Config file:** `~/.claude-memory/config.json`

```json
{
  "store": {
    "type": "neo4j",
    "neo4jUrl": "bolt://localhost:7687",
    "neo4jUser": "neo4j",
    "neo4jPassword": "your-password"
  }
}
```

### Setup Instructions

1. **Install Neo4j** (Docker recommended):

```bash
docker run --name neo4j -d \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your-password \
  neo4j:5.15-enterprise
```

2. **Install driver:**

```bash
npm install neo4j-driver
```

3. **Configure Memento:**

```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "store": {
    "type": "neo4j",
    "neo4jUrl": "bolt://localhost:7687",
    "neo4jUser": "neo4j",
    "neo4jPassword": "your-password"
  }
}
EOF
```

4. **Verify connection:**

```bash
# Check Neo4j is running
curl http://localhost:7474/
# Should return browser UI or JSON

# Start Memento server
memento serve
# Server should connect to Neo4j
```

### Data Model

**Nodes:**

```cypher
(Memory {
  id: "uuid-1",
  content: "...",
  namespace: "project",
  tags: ["decision", "architecture"],
  timestamp: "2026-03-20T10:00:00Z"
})
```

**Relationships:**

```cypher
(Memory1)-[:SIMILAR {strength: 0.95}]->(Memory2)
(Memory1)-[:SUPERSEDES {strength: 0.88}]->(Memory2)
(Memory1)-[:REFERENCES {strength: 0.82}]->(Memory2)
```

### Querying Examples

```cypher
// Find all memories similar to a decision
MATCH (m:Memory)-[:SIMILAR]->(related:Memory)
WHERE m.id = "uuid-decision-1"
RETURN related, m

// Trace decision chain
MATCH path = (start:Memory)-[:SUPERSEDES|:REFERENCES*1..5]->(end:Memory)
WHERE start.id = "uuid-old-decision"
RETURN path

// Find frequently referenced memories
MATCH (m:Memory)-[r:REFERENCES]->()
RETURN m, count(r) as references
ORDER BY references DESC
LIMIT 10
```

### Performance Characteristics

| Operation | Entries | Time |
|-----------|---------|------|
| Save | 1 | ~20ms (includes relation creation) |
| Vector search | 100K | ~50ms |
| Find relations | 100K | ~30ms |
| Traverse graph (3 hops) | 100K | ~100ms |
| Compact | 100K | ~2s |

### Trade-offs

| Pros | Cons |
|------|------|
| Optimized for relationships | Requires running Neo4j server |
| Graph traversal efficient | More infrastructure to manage |
| Distributed via Causal Cluster | Higher resource usage |
| APOC plugins for advanced queries | Learning curve (Cypher language) |
| Built-in visualization | More complex debugging |
| Enterprise scalability | Overkill for small teams |

### Limitations

- **Server dependency**: Neo4j must be running and accessible
- **Infrastructure overhead**: Adds significant complexity vs local/ChromaDB
- **Network latency**: Slower than embedded systems
- **Licensing**: Community edition has limitations, enterprise is paid
- **Operational complexity**: Requires database administration, backups, etc.

### When to Use

✓ **Good for:**
- Large teams (>10 people) sharing memory
- Frequent relation queries needed
- Complex decision chains to trace
- Distributed deployments (Neo4j Cluster)
- Enterprise deployments requiring HA/DR

✗ **Not ideal for:**
- Single user or small teams
- Simple use cases without relation queries
- Minimal infrastructure preference
- Development/prototyping

---

## Comparison Matrix

| Feature | Local | IndexedDB | ChromaDB | Neo4j |
|---------|-------|-----------|----------|-------|
| **Setup** | Auto | Import | Install pkg | Docker + config |
| **Storage** | Filesystem | Browser IDB | SQLite | Graph DB |
| **Max entries** | 2M | 10K | 500K | 10M+ |
| **Vector search** | HNSW | HNSW | HNSW | Plugin |
| **Keyword search** | BM25 | Limited | Full-text | Full-text |
| **Relations** | JSON | In-memory | Limited | Native |
| **Distributed** | No | No | No | Yes (Cluster) |
| **Cost** | Free | Free | Free | Free (Community) / Paid (Enterprise) |
| **Complexity** | Low | Medium | Medium | High |
| **Best for** | Dev/single-user | Browser ext | Prod small team | Large enterprise |

---

## Migration Between Backends

### Local → ChromaDB

1. Update config:
```bash
cat > ~/.claude-memory/config.json << 'EOF'
{
  "store": {
    "type": "chromadb",
    "chromaPath": "~/.claude-memory/chromadb"
  }
}
EOF
```

2. Run migration:
```bash
# Via MCP tool
memory_migrate(namespace: "myproject", dryRun: false)

# Or via HTTP API
curl -X POST http://127.0.0.1:21476/api/migrate \
  -H "Content-Type: application/json" \
  -d '{"namespace": "myproject", "dryRun": false}'
```

3. Verify:
```bash
ls ~/.claude-memory/chromadb/chroma.sqlite3
```

### ChromaDB → Neo4j

1. Install Neo4j and driver
2. Update config with Neo4j connection
3. Run migration to re-embed all entries
4. Neo4j automatically creates relations graph

### Export data (any backend)

```bash
# Via MCP tool
memory_export(namespace: "myproject", format: "jsonl")

# Or via HTTP API
curl http://127.0.0.1:21476/api/export?namespace=myproject&format=jsonl > backup.jsonl
```

Then import into new backend:

```bash
memory_import(content: `<file contents>`, format: "jsonl", namespace: "myproject")
```

---

## Recommendations

| Use Case | Recommended Backend |
|----------|---------------------|
| **Personal projects** | Local Files (default) |
| **Browser extension** | IndexedDB |
| **Small team, self-hosted** | ChromaDB |
| **Large team, distributed** | Neo4j Cluster |
| **Cloud deployment** | Neo4j (managed) or ChromaDB (hosted) |
| **Offline first** | Local Files or IndexedDB |
| **High throughput** | ChromaDB or Neo4j |
| **Complex relationships** | Neo4j |

