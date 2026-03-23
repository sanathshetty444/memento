# Configuration Guide: Complete Reference

Memento is configured via `~/.claude-memory/config.json`. This file controls storage backend, embeddings provider, auto-capture behavior, search settings, and more.

## Configuration Resolution Order

Memento loads configuration in this priority order:

```
1. Environment Variables (highest priority)
   MEMENTO_STORAGE_TYPE=chromadb
   MEMENTO_EMBEDDINGS_PROVIDER=openai

2. Config File (~/.claude-memory/config.json)
   {
     "storage": { "type": "json" },
     "embeddings": { "provider": "local" }
   }

3. Default Values (lowest priority)
   storage.type = "json"
   embeddings.provider = "local"
```

If you set an environment variable, it overrides the config file. If the config file has a value, it's used. Otherwise, the default is applied.

## Complete Configuration Reference

### Root Level

```json
{
  "id": "memento-config",
  "version": "0.1.0",
  "ide": "claude-code",
  "namespace": "default",
  "projectPath": "/Users/me/my-project"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | "memento-config" | Config identifier |
| `version` | string | "0.1.0" | Config version (for migrations) |
| `ide` | string | "claude-code" | IDE being used: claude-code, cursor, windsurf, opencode |
| `namespace` | string | "default" | Default namespace for memories |
| `projectPath` | string | current dir | Project root path |

### Storage Configuration

Controls where memories are stored.

#### JSON (Local File-Based, Default)

```json
{
  "storage": {
    "type": "json",
    "path": "~/.claude-memory/store",
    "compression": false,
    "backupInterval": 3600000
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | "json" | Storage backend type |
| `path` | string | "~/.claude-memory/store" | Directory to store JSON files |
| `compression` | boolean | false | Enable gzip compression (saves 60% space) |
| `backupInterval` | number | 3600000 | Backup every N ms (1 hour default) |

**Environment Variable Override:**
```bash
MEMENTO_STORAGE_TYPE=json
MEMENTO_STORAGE_PATH=/custom/path
```

**Use JSON when:**
- You want portability (all files are readable JSON)
- You prefer simplicity
- You're on a laptop or single machine
- You don't have extra dependencies

#### IndexedDB (Browser)

```json
{
  "storage": {
    "type": "indexeddb",
    "dbName": "memento-app",
    "storeName": "memories",
    "version": 1
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | - | Must be "indexeddb" |
| `dbName` | string | "memento-db" | Browser database name |
| `storeName` | string | "memories" | Object store within database |
| `version` | number | 1 | Database schema version |

**Use IndexedDB when:**
- Building web applications
- You need persistent browser storage
- You want offline-first capability

#### ChromaDB (Vector Database)

```json
{
  "storage": {
    "type": "chromadb",
    "host": "localhost",
    "port": 8000,
    "path": "~/.chroma",
    "collectionName": "memento"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | - | Must be "chromadb" |
| `host` | string | "localhost" | ChromaDB server host |
| `port` | number | 8000 | ChromaDB server port |
| `path` | string | "~/.chroma" | Local ChromaDB data path |
| `collectionName` | string | "memento" | Collection name in ChromaDB |

**Use ChromaDB when:**
- You want a dedicated vector database
- You need better search performance at scale (10K+ memories)
- You're sharing a database across multiple users

**Start ChromaDB:**
```bash
# Install (optional dependency)
pip install chromadb

# Start server
chroma run --host localhost --port 8000
```

#### Neo4j (Graph Database)

```json
{
  "storage": {
    "type": "neo4j",
    "uri": "bolt://localhost:7687",
    "username": "neo4j",
    "password": "${MEMENTO_NEO4J_PASSWORD}",
    "database": "memento"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | - | Must be "neo4j" |
| `uri` | string | "bolt://localhost:7687" | Neo4j connection URI |
| `username` | string | "neo4j" | Neo4j username |
| `password` | string | - | Neo4j password (use env var!) |
| `database` | string | "memento" | Database name |

**Use Neo4j when:**
- You want relationship-aware storage
- You're doing complex graph queries
- You need to integrate with other graph applications
- You want to visualize memory relationships

**Start Neo4j:**
```bash
# Docker
docker run -d \
  --name neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j

# Or use Neo4j Desktop app
```

### Embeddings Configuration

Controls how memories are converted to vectors for semantic search.

#### Local Embeddings (Default)

```json
{
  "embeddings": {
    "provider": "local",
    "model": "all-MiniLM-L6-v2",
    "dimensions": 384,
    "offline": true
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | "local" | Must be "local" |
| `model` | string | "all-MiniLM-L6-v2" | Hugging Face model ID |
| `dimensions` | number | 384 | Vector dimensionality |
| `offline` | boolean | true | Works without internet |

**Use local when:**
- You want offline operation (no API key needed)
- You want privacy (embeddings never leave your machine)
- You prefer simplicity
- You have adequate RAM (model is ~200MB)

#### Gemini Embeddings (Google)

```json
{
  "embeddings": {
    "provider": "gemini",
    "model": "embedding-001",
    "apiKey": "${MEMENTO_GEMINI_API_KEY}",
    "dimensions": 768,
    "batchSize": 100
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | - | Must be "gemini" |
| `model` | string | "embedding-001" | Gemini model ID |
| `apiKey` | string | - | API key (NEVER hardcode!) |
| `dimensions` | number | 768 | Output vector size |
| `batchSize` | number | 100 | Requests per batch |

**Get an API key:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Create API key
3. Set environment variable:
```bash
export MEMENTO_GEMINI_API_KEY=your-key
```

**Use Gemini when:**
- You want high-quality embeddings
- You're okay with API calls
- You need better semantic understanding
- You have a Google Cloud account

#### OpenAI Embeddings

```json
{
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "apiKey": "${MEMENTO_OPENAI_API_KEY}",
    "dimensions": 1536,
    "batchSize": 100
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | - | Must be "openai" |
| `model` | string | "text-embedding-3-small" | OpenAI model ID |
| `apiKey` | string | - | OpenAI API key |
| `dimensions` | number | 1536 | Output vector size |
| `batchSize` | number | 100 | Requests per batch |

**Get an API key:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create API key
3. Set environment variable:
```bash
export MEMENTO_OPENAI_API_KEY=your-key
```

**Costs:**
- text-embedding-3-small: $0.02 per 1M tokens
- ~10,000 memories: ~$0.01

**Use OpenAI when:**
- You're already using OpenAI for other tasks
- You want the best embeddings (text-embedding-3-large)
- You have an OpenAI subscription

### Search Configuration

Controls default search behavior.

```json
{
  "search": {
    "defaultMode": "hybrid",
    "vectorWeight": 0.70,
    "keywordWeight": 0.30,
    "limit": 10,
    "hnswMaxElements": 10000,
    "hnswEfConstruction": 200,
    "hnswEf": 100
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultMode` | string | "hybrid" | Default search mode: vector, keyword, hybrid |
| `vectorWeight` | number | 0.70 | Weight for vector results in hybrid (0-1) |
| `keywordWeight` | number | 0.30 | Weight for keyword results in hybrid (0-1) |
| `limit` | number | 10 | Default max results per query |
| `hnswMaxElements` | number | 10000 | Max elements in HNSW index |
| `hnswEfConstruction` | number | 200 | HNSW construction parameter (higher = better quality, slower) |
| `hnswEf` | number | 100 | HNSW search parameter (higher = more accurate, slower) |

**HNSW Tuning:**
```json
{
  "search": {
    "hnswMaxElements": 5000,
    "hnswEfConstruction": 100,
    "hnswEf": 50
  }
}
```

For fast searches with 1K-5K memories:
```json
{
  "search": {
    "hnswEfConstruction": 100,
    "hnswEf": 30
  }
}
```

For accurate searches with 10K+ memories:
```json
{
  "search": {
    "hnswEfConstruction": 400,
    "hnswEf": 200
  }
}
```

### Auto-Capture Configuration

Controls what gets automatically saved to memory.

```json
{
  "capture": {
    "enabled": true,
    "minOutputLength": 50,
    "ignoredTools": ["Read", "Glob", "Grep"],
    "workerIntervalMs": 5000,
    "queuePath": "~/.claude-memory/capture-queue.jsonl",
    "dedupSimilarityThreshold": 0.95,
    "sourceTag": "auto-capture"
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | true | Enable auto-capture |
| `minOutputLength` | number | 50 | Minimum output length in characters |
| `ignoredTools` | array | ["Read","Glob","Grep"] | Tools to skip |
| `workerIntervalMs` | number | 5000 | Queue processing interval (ms) |
| `queuePath` | string | "~/.claude-memory/capture-queue.jsonl" | Queue file location |
| `dedupSimilarityThreshold` | number | 0.95 | Skip if similar to existing (0-1) |
| `sourceTag` | string | "auto-capture" | Tag for auto-captured memories |

**Disable auto-capture:**
```json
{
  "capture": {
    "enabled": false
  }
}
```

**Capture everything (aggressive):**
```json
{
  "capture": {
    "enabled": true,
    "minOutputLength": 10,
    "ignoredTools": []
  }
}
```

**Selective capture (conservative):**
```json
{
  "capture": {
    "enabled": true,
    "minOutputLength": 200,
    "ignoredTools": ["Read", "Glob", "Grep", "Bash"]
  }
}
```

### Smart Memory Configuration

Controls importance scoring, contradiction detection, and entity extraction.

```json
{
  "smartMemory": {
    "importanceScoringEnabled": true,
    "sourceWeights": {
      "write": 0.90,
      "edit": 0.80,
      "bash": 0.70,
      "manual": 0.85
    },
    "tagWeights": {
      "decision": 0.95,
      "architecture": 0.90,
      "error": 0.80,
      "code": 0.60
    },
    "contradictionDetectionEnabled": true,
    "entityExtractionEnabled": true,
    "relationshipTypesEnabled": ["similar", "supersedes", "references", "contradicts", "elaborates"]
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `importanceScoringEnabled` | boolean | true | Calculate importance scores |
| `sourceWeights` | object | see above | Weight each memory source |
| `tagWeights` | object | see above | Weight each tag |
| `contradictionDetectionEnabled` | boolean | true | Detect contradictions |
| `entityExtractionEnabled` | boolean | true | Extract entities (file paths, functions, etc.) |
| `relationshipTypesEnabled` | array | all | Relationship types to track |

### Server Configuration

Controls HTTP API settings.

```json
{
  "server": {
    "port": 7007,
    "host": "127.0.0.1",
    "cors": {
      "enabled": true,
      "origins": ["http://localhost:3000"],
      "credentials": true
    },
    "auth": {
      "enabled": true,
      "apiKeys": ["sk-abc123def456"]
    },
    "rateLimit": {
      "enabled": true,
      "requestsPerMinute": 100
    }
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | 7007 | HTTP server port |
| `host` | string | "127.0.0.1" | Bind to this host |
| `cors.enabled` | boolean | true | Enable CORS |
| `cors.origins` | array | ["*"] | Allowed origins |
| `cors.credentials` | boolean | false | Allow credentials |
| `auth.enabled` | boolean | true | Require API key |
| `auth.apiKeys` | array | [] | Valid API keys |
| `rateLimit.enabled` | boolean | true | Enable rate limiting |
| `rateLimit.requestsPerMinute` | number | 100 | Request limit |

### Index Configuration

Controls project indexing behavior.

```json
{
  "index": {
    "excludePatterns": [
      "node_modules/",
      ".git/",
      "dist/",
      "build/",
      ".next/"
    ],
    "maxFileSizeKB": 50,
    "maxFilesPerScan": 1000,
    "fileTypes": [
      "*.md",
      "*.ts",
      "*.js",
      "*.py",
      "package.json",
      "docker-compose.yml"
    ]
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `excludePatterns` | array | see above | Directories to skip |
| `maxFileSizeKB` | number | 50 | Skip files larger than this |
| `maxFilesPerScan` | number | 1000 | Max files to scan per index run |
| `fileTypes` | array | see above | File extensions to include |

### Compaction Configuration

Controls memory store cleanup.

```json
{
  "compaction": {
    "enabled": true,
    "schedule": "0 2 * * 0",
    "ttlDays": 180,
    "maxEntries": 10000,
    "removeLowImportance": true,
    "lowImportanceThreshold": 0.3,
    "deduplicationSimilarityThreshold": 0.95
  }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | true | Enable auto-compaction |
| `schedule` | string | "0 2 * * 0" | Cron schedule (2 AM Sunday) |
| `ttlDays` | number | 180 | Delete memories older than N days |
| `maxEntries` | number | 10000 | Maximum memories to keep |
| `removeLowImportance` | boolean | true | Remove low-importance memories |
| `lowImportanceThreshold` | number | 0.3 | Importance cutoff (0-1) |
| `deduplicationSimilarityThreshold` | number | 0.95 | Similarity threshold for dedup |

## Environment Variable Overrides

All config can be overridden via environment variables using SCREAMING_SNAKE_CASE:

```bash
# Storage
MEMENTO_STORAGE_TYPE=chromadb
MEMENTO_STORAGE_PATH=/custom/path

# Embeddings
MEMENTO_EMBEDDINGS_PROVIDER=openai
MEMENTO_EMBEDDINGS_API_KEY=sk-...

# Search
MEMENTO_SEARCH_DEFAULT_MODE=vector
MEMENTO_SEARCH_LIMIT=20

# Capture
MEMENTO_CAPTURE_ENABLED=true
MEMENTO_CAPTURE_MIN_OUTPUT_LENGTH=100

# Server
MEMENTO_SERVER_PORT=8008
MEMENTO_SERVER_AUTH_ENABLED=false

# IDE
MEMENTO_IDE=cursor
```

## Example Configurations

### Lightweight Development Setup

```json
{
  "storage": {
    "type": "json",
    "compression": false
  },
  "embeddings": {
    "provider": "local",
    "model": "all-MiniLM-L6-v2"
  },
  "search": {
    "defaultMode": "hybrid",
    "limit": 10
  },
  "capture": {
    "enabled": true,
    "minOutputLength": 50
  }
}
```

### Production Server Setup

```json
{
  "storage": {
    "type": "chromadb",
    "host": "chroma.internal",
    "port": 8000,
    "collectionName": "memento-prod"
  },
  "embeddings": {
    "provider": "openai",
    "model": "text-embedding-3-large",
    "apiKey": "${OPENAI_API_KEY}"
  },
  "search": {
    "defaultMode": "vector",
    "limit": 50
  },
  "server": {
    "port": 7007,
    "host": "0.0.0.0",
    "cors": {
      "origins": ["https://app.example.com"]
    },
    "auth": {
      "enabled": true,
      "apiKeys": ["${MEMENTO_API_KEY}"]
    }
  }
}
```

### Research/Archival Setup

```json
{
  "storage": {
    "type": "neo4j",
    "uri": "bolt://graph.example.com:7687",
    "username": "neo4j",
    "password": "${NEO4J_PASSWORD}"
  },
  "embeddings": {
    "provider": "gemini",
    "apiKey": "${GEMINI_API_KEY}"
  },
  "search": {
    "defaultMode": "hybrid",
    "hnswEfConstruction": 400,
    "hnswEf": 200
  },
  "compaction": {
    "ttlDays": 730,
    "maxEntries": 100000
  }
}
```

### Browser App Setup

```json
{
  "storage": {
    "type": "indexeddb",
    "dbName": "my-app-memories"
  },
  "embeddings": {
    "provider": "gemini",
    "apiKey": "${VITE_GEMINI_API_KEY}"
  },
  "search": {
    "defaultMode": "hybrid"
  },
  "capture": {
    "enabled": false
  }
}
```

## Validating Your Configuration

Check your config is valid:

```bash
memento config --validate
```

Output:
```
Validating configuration...

✓ storage: json backend configured
✓ embeddings: local provider ready
✓ search: hybrid mode (70/30 weights)
✓ capture: enabled (minLength: 50)
✓ server: port 7007

Configuration is valid!
```

---

Memento's configuration system provides sensible defaults that work for most users, while offering deep control for advanced use cases. Start with defaults, customize only what you need.
