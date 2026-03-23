# Memory Pipeline: Detailed Stage-by-Stage Processing

The memory pipeline transforms raw user input into searchable, deduplicated, embedded memories. Each stage operates deterministically using heuristic rules, no LLM inference required.

## Stage 1: Redaction (redactor.ts)

**Purpose**: Mask sensitive information before storage to prevent credential leakage.

**Process**:
1. Input text scanned line-by-line
2. Regex patterns match sensitive patterns
3. Matched text replaced with redacted placeholder (e.g., `[AWS_ACCESS_KEY]`)
4. Redaction map tracked for audit trail

**Sensitive Patterns Detected**:

| Pattern | Regex | Examples |
|---------|-------|----------|
| AWS Access Keys | `AKIA[0-9A-Z]{16}` | `AKIAIOSFODNN7EXAMPLE` |
| AWS Secret Keys | `aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}` | In ~/.aws/credentials |
| Private Keys | `-----BEGIN.*PRIVATE KEY-----[\s\S]*?-----END.*PRIVATE KEY-----` | OpenSSH, RSA, EC keys |
| API Keys | `(api[_-]?key\|apikey)\s*[=:]\s*[A-Za-z0-9_\-]{20,}` | Any api_key=... line |
| Bearer Tokens | `Bearer\s+[A-Za-z0-9\._\-]{40,}` | OAuth/JWT tokens |
| Passwords | `(password\|passwd)\s*[=:]\s*.{6,}` | password=... lines |
| Database URIs | `(postgres\|mysql\|mongodb)://[^\s]+` | Connection strings |
| Email with Context | `[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}` | User emails (optional, configurable) |
| Credit Cards | `\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b` | 16-digit numbers |
| Base64 Blobs | `[A-Za-z0-9+/]{64,}={0,2}(?:\n[A-Za-z0-9+/]{64,}={0,2})*` | Large base64 strings |

**Example**:

```
Input:
  "I configured the database with password='super_secret_123' and
   AWS key AKIAIOSFODNN7EXAMPLE for the Lambda function."

Output:
  "I configured the database with password='[PASSWORD]' and
   AWS key [AWS_ACCESS_KEY] for the Lambda function."

Redaction Map:
  {
    "AKIAIOSFODNN7EXAMPLE": "[AWS_ACCESS_KEY]",
    "super_secret_123": "[PASSWORD]"
  }
```

**Configuration**:
- `config.json` → `redaction.enabled` (default: true)
- `config.json` → `redaction.patterns` (array of custom regex strings)

---

## Stage 2: Auto-Tagging (tagger.ts)

**Purpose**: Automatically assign semantic labels for filtering and classification.

**Heuristic Rules**:

### `decision`
Triggered when memory contains:
- Keywords: "decided", "decided to", "we chose", "we settled on", "for this reason"
- Pattern: Explanation of "why" after "how"
- Example: "We decided to use Redis instead of Memcached because response times are critical."

### `code`
Triggered when memory contains:
- Language keywords: `function`, `const`, `class`, `import`, `def`, `func`, `struct`, etc.
- File extensions mentioned: `.ts`, `.js`, `.py`, `.rs`, `.go`, etc.
- Code fence markers: ` ``` ` blocks
- Pattern: Function/class names (CamelCase, snake_case)
- Example: "Fixed the handleLogin() function to validate email format."

### `error`
Triggered when memory contains:
- Keywords: "error", "bug", "crash", "failed", "exception", "issue", "broken", "not working"
- Pattern: Error messages (stack traces, exception names)
- Patterns: Node stack traces, Python tracebacks, Go panics
- Example: "TypeError: Cannot read property 'id' of undefined"

### `architecture`
Triggered when memory contains:
- Keywords: "architecture", "design", "pattern", "refactor", "modular", "dependency", "layer"
- Pattern: Mentions of multiple components interacting
- Example: "Redesigned the auth layer to separate concerns from the API gateway."

### `config`
Triggered when memory contains:
- Keywords: "config", "environment", "setting", "flag", "parameter", "variable"
- Pattern: Key=value assignments
- File mentions: `.env`, `config.yml`, `settings.json`, etc.
- Example: "DATABASE_URL must include ?ssl=require for production deployments."

### `dependency`
Triggered when memory contains:
- Keywords: "package", "library", "module", "import", "require", "version", "upgrade"
- Pattern: Semantic versioning (1.2.3, ~1.2.0, ^2.0.0)
- Examples: "npm install", "pip install", "Added lodash@4.17.21 to dependencies"

### `todo`
Triggered when memory contains:
- Keywords: "TODO", "FIXME", "HACK", "XXX", "should", "need to", "must"
- Pattern: Item preceded by `- [ ]` (markdown checkbox)
- Example: "TODO: Add rate limiting to /api/users endpoint"

### `conversation` (Auto-applied)
Applied to all memories from conversation contexts (chat history, user messages).

**Scoring Logic**:
- Each rule scores 1-5 points
- Multiple rules can apply to single memory
- Tags with score > 2 are applied
- Order of application: decision → code → error → architecture → config → dependency → todo

**Example**:

```
Input Memory:
  "In LoginHandler, I added a check for empty passwords
   (bug fix from PR #1247) using const isEmpty = pwd.length === 0.
   TODO: also validate against common patterns."

Auto-Tags:
  - "code" (triggered: const, LoginHandler, pwd.length)
  - "error" (triggered: bug, fix)
  - "todo" (triggered: TODO)
  - "conversation" (auto-applied)

Final Tags: ["code", "error", "todo", "conversation"]
```

---

## Stage 3: Chunking (chunker.ts)

**Purpose**: Break large memories into sized segments that fit embedding and search models.

**Chunk Size Limits**:
- Target: 512 tokens (~2000 characters for English text)
- Min: 256 tokens (~1000 chars) — prevents orphaned fragments
- Max: 1024 tokens (~4000 chars) — maintains semantic coherence

**Boundary Detection** (in priority order):

1. **Paragraph Boundary** (strongest)
   - Blank lines (`\n\n`)
   - Markdown headers (`# `, `## `, etc.)
   - Markdown list start (`- `, `* `, `+ `)

2. **Sentence Boundary** (medium)
   - Period + space + capital letter (`\. [A-Z]`)
   - Exclamation + space (`\! `)
   - Question mark + space (`\? `)

3. **Word Boundary** (weakest, fallback)
   - Space between words (`\s+`)
   - Hyphen (`-`)

**Chunking Algorithm**:

```
1. Split by paragraph boundaries
2. For each paragraph:
   - If size < min: try merging with adjacent
   - If size > max:
     - Split by sentence boundaries
     - Recombine to max size respecting sentences
     - If still > max, split by words
3. Add overlap:
   - Last sentence of chunk N appears at start of chunk N+1
   - Typical overlap: 50-100 tokens
```

**Example**:

```
Input (1800 chars):
"We implemented Redis caching for the user session store.
This reduced database queries by 60% and improved response times
from 200ms to 50ms.

The implementation uses a ttl of 1 hour to ensure fresh data.
We also added a cache invalidation hook that clears on password change.
For the session data schema, we serialize to JSON and prefix keys
with 'sess:' for easy identification and TTL management."

Result Chunks:

CHUNK 1 (654 chars):
"We implemented Redis caching for the user session store.
This reduced database queries by 60% and improved response times
from 200ms to 50ms.

The implementation uses a ttl of 1 hour to ensure fresh data."

CHUNK 2 (812 chars, overlaps last sentence):
"The implementation uses a ttl of 1 hour to ensure fresh data.
We also added a cache invalidation hook that clears on password change.
For the session data schema, we serialize to JSON and prefix keys
with 'sess:' for easy identification and TTL management."

Overlap:
"The implementation uses a ttl of 1 hour to ensure fresh data."
```

**Metadata Attached to Each Chunk**:
```json
{
  "chunkId": "mem-uuid-chunk-0",
  "chunkIndex": 0,
  "totalChunks": 2,
  "text": "...",
  "startChar": 0,
  "endChar": 654,
  "overlapFromPrevious": false
}
```

---

## Stage 4: Deduplication (deduplicator.ts)

**Purpose**: Prevent duplicate and near-duplicate memories from bloating storage and skewing search results.

**Phase 1: SHA-256 Hash Deduplication** (Instant Duplicates)

1. Compute SHA-256 hash of normalized memory text:
   - Lowercase entire text
   - Remove leading/trailing whitespace
   - Collapse multiple spaces to single space
2. Check hash against existing memories
3. If match found:
   - Return existing memory ID
   - Do not save new version
   - Update metadata (last_seen, access_count)

**Phase 2: Cosine Similarity Deduplication** (Near-Duplicates)

1. Generate embedding for new memory chunk
2. Query storage: "Find all memories within threshold"
3. Compute cosine similarity against candidates
4. Threshold: 0.92 (92% similar = duplicate)

**Similarity Threshold Tuning**:
- **0.99+**: Only identical semantics (too strict, misses duplicates)
- **0.92**: Identical intent/meaning, different wording ← **current default**
- **0.85**: Similar topic, possibly different conclusions (too loose)
- **0.75**: Loosely related (misses important distinctions)

**Example**:

```
Existing Memory:
  "The handleLogin function validates email format using regex."

New Memory:
  "I validated email addresses in the login handler with a regex pattern."

SHA-256: Different (different text)
Cosine Similarity: 0.94 (above 0.92 threshold)

Result: Flagged as duplicate
Action: Merge into existing memory, update access_count, note timestamp
```

**Dedup Metadata**:
```json
{
  "deduped": true,
  "dedupeOf": "mem-uuid-existing",
  "similarity": 0.94,
  "mergedAt": "2026-03-23T10:45:30Z"
}
```

---

## Stage 5: Embedding (All Providers)

**Purpose**: Convert text chunks to fixed-dimensional vectors for semantic search.

### Default: Local @xenova/transformers

- **Model**: all-MiniLM-L6-v2 (SBERT variant)
- **Dimensions**: 384
- **Pooling**: Mean pooling over token embeddings
- **Tokenizer**: Sentence-piece BPE
- **Max Tokens**: 512 per chunk
- **Speed**: ~2ms per 512-token chunk on modern CPU
- **Offline**: No API calls, runs fully local
- **License**: Apache-2.0

**Batching**:
- Batch size: 32 chunks per batch
- Processes in parallel using Web Workers (browser) or Worker threads (Node.js)

**Example**:

```
Input Chunk:
"We implemented Redis caching for user sessions."

Output Vector:
[0.234, -0.127, 0.456, ..., -0.089]  // 384 floats

Similarity to other memories:
- "Added Redis for session caching": 0.96 (very similar)
- "Database performance optimization": 0.71 (loosely related)
- "Frontend routing logic": 0.12 (unrelated)
```

### Optional: Gemini API

- **Model**: Embedding for Content (768 dimensions)
- **Batching**: 100 chunks per API call
- **Rate Limit**: 60 reqs/min (default)
- **Cost**: $0.02 per 1M input tokens
- **Setup**: `GOOGLE_API_KEY` environment variable

### Optional: OpenAI API

- **Model**: text-embedding-3-small (1536 dimensions)
- **Batching**: 100 chunks per API call
- **Rate Limit**: 3,500 requests per minute
- **Cost**: $0.02 per 1M input tokens
- **Setup**: `OPENAI_API_KEY` environment variable

---

## Stage 6: Storage (File Format & Structure)

**Purpose**: Persist memory with vector embeddings for retrieval.

### Default: Local JSON Files

**Directory Structure**:

```
~/.claude-memory/
├── store/
│   └── {namespace}/
│       ├── memory-{uuid}.json          # Individual memory file
│       ├── memory-{uuid}.json
│       └── index.json                  # Namespace-level index
```

**Memory File Format** (`memory-{uuid}.json`):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "namespace": "my-project",
  "container": "user",
  "text": "Full original text of memory...",
  "tags": ["code", "error", "conversation"],
  "entities": {
    "functions": ["handleLogin", "validateEmail"],
    "files": ["src/auth/login.ts"],
    "packages": ["express", "jsonwebtoken"]
  },
  "importance": 0.78,
  "timestamp": "2026-03-23T10:45:30.123Z",
  "lastAccessed": "2026-03-23T10:45:30.123Z",
  "accessCount": 5,
  "vector": [0.234, -0.127, 0.456, ...],  // 384 floats for local
  "vectorDimension": 384,
  "vectorModel": "all-MiniLM-L6-v2",
  "metadata": {
    "source": "conversation",
    "context": "discussion about authentication",
    "userEmail": "user@example.com"
  },
  "dedup": {
    "deduped": false,
    "contentHash": "sha256-abcd1234..."
  },
  "relations": {
    "relatedMemories": ["550e8400-e29b-41d4-a716-446655440001"],
    "contradictions": []
  }
}
```

**Index File** (`index.json`):

```json
{
  "namespace": "my-project",
  "totalMemories": 247,
  "lastUpdated": "2026-03-23T10:45:30.123Z",
  "tagIndex": {
    "code": 142,
    "error": 45,
    "decision": 60
  },
  "entityIndex": {
    "functions": {
      "handleLogin": ["mem-uuid-1", "mem-uuid-2"]
    },
    "files": {
      "src/auth/login.ts": ["mem-uuid-1"]
    }
  },
  "stats": {
    "totalChunks": 312,
    "avgImportance": 0.65,
    "oldestMemory": "2026-01-01T00:00:00Z",
    "newestMemory": "2026-03-23T10:45:30Z"
  }
}
```

### ChromaDB Storage

**Setup**:
```bash
npm install chromadb
CHROMA_HOST=localhost CHROMA_PORT=8000 memento serve
```

**Collection Structure**:
- Collection name: `{namespace}`
- Each memory → single ChromaDB document
- Vector stored in ChromaDB native format
- Metadata (tags, entities) → ChromaDB metadata fields
- Document ID: memory UUID

**Schema**:
```python
{
  "ids": ["mem-uuid-1", "mem-uuid-2"],
  "embeddings": [[0.234, -0.127, ...], [...]],
  "documents": ["text of memory 1", "text of memory 2"],
  "metadatas": [
    {
      "namespace": "my-project",
      "tags": "code,error",
      "entities_functions": "handleLogin,validateEmail",
      "timestamp": "2026-03-23T10:45:30Z"
    },
    ...
  ]
}
```

### Neo4j Storage

**Setup**:
```bash
npm install neo4j-driver
NEO4J_URI=bolt://localhost:7687 memento serve
```

**Graph Schema**:
- **Node Types**: Memory, Tag, Entity, File, Function, Package
- **Relationships**:
  - `(Memory)-[:TAGGED]->(Tag)`
  - `(Memory)-[:MENTIONS]->(Entity)`
  - `(Memory)-[:CONTRADICTS]->(Memory)`
  - `(Memory)-[:RELATED_TO]->(Memory)`

**Example Cypher**:
```cypher
CREATE (m:Memory {
  id: "mem-uuid",
  namespace: "my-project",
  text: "...",
  importance: 0.78,
  timestamp: "2026-03-23T10:45:30Z",
  vector: [0.234, -0.127, ...],
  vectorDimension: 384
})
-[:TAGGED]->(tag:Tag {name: "code"})
-[:MENTIONED]->(func:Function {name: "handleLogin", file: "src/auth/login.ts"})
```

---

## Pipeline Summary

| Stage | Input | Output | Latency | Async |
|-------|-------|--------|---------|-------|
| Redaction | Raw text | Masked text | <1ms | No |
| Auto-tagging | Text | Tags[] | 2-5ms | No |
| Chunking | Text | Chunk[] | 5-10ms | No |
| Dedup Phase 1 | Hash | Found? | <1ms | No |
| Dedup Phase 2 | Embedding | Score | 2-10ms | No |
| Embedding | Chunk | Vector | 2-50ms | Yes |
| Storage | Vector+Meta | ID | 5-20ms | Yes |
| Indexing | Memory | Indexes updated | 1-5ms | No |

**Total Pipeline Latency**: ~50-150ms for 3 chunks with embedding

**Configuration Tuning**:
```json
{
  "pipeline": {
    "redaction": {"enabled": true, "patterns": []},
    "tagging": {"enabled": true, "customRules": {}},
    "chunking": {"minTokens": 256, "maxTokens": 1024, "overlap": 50},
    "dedup": {
      "phase1": true,
      "phase2": true,
      "similarity": 0.92
    },
    "embedding": {
      "batchSize": 32,
      "workers": 4
    }
  }
}
```
