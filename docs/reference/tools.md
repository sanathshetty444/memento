# MCP Tools Reference

Complete reference for all 17 Memento MCP tools. Each tool is callable via the Model Context Protocol and exposed as `memory_*` commands.

## 1. memory_save

Save context, decisions, or knowledge to persistent memory for later recall.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `content` | string | Yes | — | The content to remember. Can be any text, code, decisions, architecture notes, etc. |
| `tags` | string[] | No | [] | Semantic tags for categorization. Built-in tags: `conversation`, `decision`, `code`, `error`, `architecture`, `config`, `dependency`, `todo`. Custom tags accepted. |
| `namespace` | string | No | auto-detected | Project namespace. Auto-detected from environment if omitted. |
| `global` | boolean | No | false | Save to global namespace (`__global__`) accessible across all projects. |
| `container` | string | No | namespace | Container for multi-project/team scoping (e.g., `team-backend`, `personal`). |

### Example Request

```
User: Save this important architecture decision about using PostgreSQL for the database
to memory with tags decision, architecture, and config.

System calls: memory_save with:
- content: "Decision: Use PostgreSQL for production database. Rationale: ACID guarantees, PostGIS support for geo queries, mature ecosystem. Alternative considered: MongoDB (rejected due to transaction needs)."
- tags: ["decision", "architecture", "config"]
- namespace: "myproject"
```

### Example Response

```
Saved 1 memory entry (id: uuid-abcd1234)
```

### Behavior

- Content is automatically embedded using the configured embedding provider
- Entry receives automatic tags based on signal keywords (remember, important, decision, etc.)
- Priority set to "high" for explicitly saved memories
- Deduplication check: entry rejected if >92% similar to existing memories
- Entry chunked if >500 chars (configurable)
- Returns array of saved entry IDs (1 entry usually, 2-3 if chunked)

---

## 2. memory_recall

Recall relevant memories from a specific project namespace using semantic search.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query. Natural language or keywords. Embedded and matched against all memories in the namespace. |
| `namespace` | string | No | auto-detected | Project namespace to search within. |
| `tags` | string[] | No | [] | Filter by semantic tags. Only memories with all specified tags are returned. |
| `searchMode` | enum | No | "vector" | `vector` = cosine similarity (default), `keyword` = BM25 keyword matching, `hybrid` = weighted combination (70% vector + 30% keyword). |
| `limit` | number | No | 10 | Max results (1-100). |
| `container` | string | No | — | Filter by container for multi-project/team scoping. |

### Example Request

```
User: Find memories about database schema changes in this project.

System calls: memory_recall with:
- query: "database schema changes migrations"
- namespace: "myproject"
- searchMode: "vector"
- limit: 5
```

### Example Response

```
Found 3 matching memories:

--- Result 1 ---
ID: uuid-0abc
Score: 0.9234
Summary: PostgreSQL schema migration strategy
Tags: architecture, database, decision
Timestamp: 2026-03-20T10:30:00Z
Container: team-backend
Content: Decision: Use Alembic for schema migrations in production. Each migration...

--- Result 2 ---
ID: uuid-1def
Score: 0.8156
Summary: Database indexing strategy
Tags: architecture, performance
Timestamp: 2026-03-19T14:15:00Z
Content: Performance optimization: Add indexes on user_id and created_at columns...

--- Result 3 ---
ID: uuid-2ghi
Score: 0.7234
Summary: Schema design notes
Tags: code, documentation
Timestamp: 2026-03-18T09:45:00Z
Content: Current schema includes users, posts, comments tables with...
```

### Behavior

- Returns top-N memories ranked by relevance score (0.0-1.0)
- Empty result if no matches found
- Each result shows: ID, score, summary, tags, timestamp, content preview (first 200 chars)
- Scores >0.8 indicate high relevance
- Scores 0.6-0.8 indicate moderate relevance

---

## 3. memory_search

Search memories across all projects and namespaces using semantic search.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search query. Embedded and matched against ALL memories across all namespaces. |
| `tags` | string[] | No | [] | Filter by semantic tags. Only memories with all specified tags are returned. |
| `searchMode` | enum | No | "vector" | `vector` = cosine similarity (default), `keyword` = BM25, `hybrid` = weighted combination. |
| `limit` | number | No | 10 | Max results (1-100). |

### Example Request

```
User: Search for any memory about authentication patterns across all projects.

System calls: memory_search with:
- query: "JWT token authentication OAuth2"
- searchMode: "hybrid"
- limit: 10
```

### Example Response

```
Found 5 matching memories:

--- Result 1 ---
ID: uuid-proj1-auth
Score: 0.9412
Namespace: auth-service
Summary: JWT refresh token implementation
Tags: decision, code, architecture
Timestamp: 2026-03-20T11:00:00Z
Content: Implement JWT with short-lived access tokens (15m) and long...

--- Result 2 ---
ID: uuid-proj2-oauth
Score: 0.8765
Namespace: frontend
Summary: OAuth2 flow with external providers
Tags: architecture, security
Timestamp: 2026-03-19T16:30:00Z
Content: Integrate Auth0 for OAuth2. Use Authorization Code flow...
```

### Behavior

- Searches across ALL namespaces (global and project-specific)
- Namespace field included in results for context
- Useful for finding patterns, solutions, or decisions used elsewhere
- Tag filtering applied across all namespaces

---

## 4. memory_forget

Delete a specific memory entry by its ID.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `id` | string | Yes | — | The ID of the memory entry to delete. Typically a UUID. |

### Example Request

```
User: Delete the memory entry with ID uuid-old-decision.

System calls: memory_forget with:
- id: "uuid-old-decision"
```

### Example Response

```
Memory entry uuid-old-decision deleted successfully.
```

Or if not found:

```
Memory entry uuid-old-decision not found.
```

### Behavior

- Permanently removes entry from storage
- Also removes any relations/links to this entry
- Non-fatal if entry doesn't exist
- Returns success/not-found status

---

## 5. memory_list

List memory entries with optional filtering by namespace, tags, and container.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `namespace` | string | No | auto-detected | Project namespace to list from. |
| `tags` | string[] | No | [] | Filter by semantic tags (AND logic). Only entries with all specified tags are returned. |
| `limit` | number | No | 10 | Max results (1-100). |
| `offset` | number | No | 0 | Number of entries to skip for pagination. |
| `container` | string | No | — | Filter by container. |

### Example Request

```
User: List the first 20 decision entries from this project, then show the next 20 with offset.

System calls: memory_list with:
- namespace: "myproject"
- tags: ["decision"]
- limit: 20
- offset: 0
```

### Example Response

```
Found 42 memory entries:

--- Entry 1 ---
ID: uuid-dec001
Summary: Use PostgreSQL for production
Tags: decision, architecture, database
Timestamp: 2026-03-20T10:30:00Z

--- Entry 2 ---
ID: uuid-dec002
Summary: Implement OAuth2 for authentication
Tags: decision, architecture, security
Timestamp: 2026-03-19T14:15:00Z
...
```

### Behavior

- Returns paginated list without content (for performance)
- Useful for browsing without search
- Timestamp shows entry creation time
- Container shown if present
- Tags shown as comma-separated list

---

## 6. memory_health

Check the health and status of the Memento memory system.

### Parameters

None. No parameters required.

### Example Request

```
User: Check the health of the memory system.

System calls: memory_health
```

### Example Response

```
Memento Health Status
=====================
Storage type: chromadb
Embedding provider: openai
Embedding model: text-embedding-3-small
Current namespace: myproject
Entries in namespace: 247
Global entries: 1032
Auto-capture: enabled
```

### Behavior

- No parameters required
- Returns config status: storage type, embedding provider, model
- Shows entry counts for current namespace and global
- Shows auto-capture status
- Useful for debugging configuration issues

---

## 7. memory_export

Export all memories from a namespace as JSONL, JSON, Markdown, or CSV.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `namespace` | string | No | auto-detected | Project namespace to export from. |
| `format` | enum | No | "jsonl" | Export format: `jsonl` (line-delimited JSON), `json` (pretty-printed), `markdown` (sections with metadata tables), `csv` (tabular). |

### Example Request

```
User: Export all memories from the current project as markdown for documentation.

System calls: memory_export with:
- namespace: "myproject"
- format: "markdown"
```

### Example Response

```
Exported 247 entries (format: markdown)

## PostgreSQL schema migration strategy

| Field | Value |
| --- | --- |
| ID | uuid-0abc |
| Timestamp | 2026-03-20T10:30:00Z |
| Tags | architecture, database |
| Source | explicit |
| Namespace | myproject |

Decision: Use Alembic for schema migrations...

---

## Database indexing strategy

| Field | Value |
...
```

### Behavior

- Paginates internally to fetch all entries (no limit)
- Embeddings stripped to reduce file size
- Each format optimized for different use cases:
  - **jsonl**: Easiest for re-import, one JSON object per line
  - **json**: Structured, human-readable, good for backups
  - **markdown**: Readable in editors, summaries as headings
  - **csv**: Importable to spreadsheets, tabular view
- Large exports may take seconds to generate

---

## 8. memory_import

Import memories from text content in various formats.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `content` | string | Yes | — | Raw text content to import. Parsed based on format. |
| `format` | enum | Yes | — | Format of the input: `jsonl`, `json`, `markdown`, `text`, `csv`. |
| `namespace` | string | No | auto-detected | Project namespace to import into. |
| `tags` | string[] | No | [] | Tags to apply to all imported entries. |

### Example Request

```
User: Import a JSON backup of 50 memories into the project with architecture tag.

System calls: memory_import with:
- content: "[{\"content\": \"...\", ...}, ...]"
- format: "json"
- namespace: "myproject"
- tags: ["architecture"]
```

### Example Response

```
Imported 48 of 50 entries (format: json)
```

### Behavior

- Parses input based on format:
  - **jsonl**: Split by newlines, parse each as JSON. Extracts `content` or `text` field
  - **json**: Parse as JSON array or single object. Extracts `content` or `text` field
  - **markdown**: Split on `##` or `#` headings. Each section = 1 entry
  - **text**: Split on blank lines (paragraphs). Each paragraph = 1 entry
  - **csv**: Parse as CSV with header. Extracts "content" column or last column
- Each entry runs through full memory pipeline: embedding, dedup, chunking
- Entries rejected by dedup or other checks are skipped (not counted as failures)
- Returns count of successfully imported entries

---

## 9. memory_migrate

Re-embed all memories with the current embedding provider (use after switching embedding models).

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `namespace` | string | No | auto-detected | Project namespace to migrate. |
| `dryRun` | boolean | No | false | If true, count entries without actually re-embedding. Preview only. |

### Example Request

```
User: Switch from local embeddings to OpenAI, then migrate all memories.

System calls: memory_migrate with:
- namespace: "myproject"
- dryRun: false
```

### Example Response (dry run)

```
Dry run: found 247 entries to re-embed. No changes made.
```

### Example Response (actual migration)

```
Migration complete:
  Total:     247
  Processed: 245
  Failed:    2
  Skipped:   0

Errors:
  - uuid-old1: Rate limit exceeded
  - uuid-old2: Invalid content
```

### Behavior

- Fetches all entries by paginating (100 at a time)
- For each entry:
  1. Delete old entry from store
  2. Re-save with fresh embedding using current provider
  3. Preserves all metadata (tags, namespace, source, etc.)
- Dry run counts entries without modifying anything
- Failed entries logged with error message
- Useful when switching from local to cloud embeddings or vice versa
- Can be re-run if interrupted (idempotent on successful entries)

---

## 10. memory_session_start

Initialize a session by recalling recent context and processing pending memories from the last session.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `namespace` | string | No | auto-detected | Project namespace. |
| `query` | string | No | "recent decisions, architecture, important context" | Optional query to focus recall on specific topics. |
| `limit` | number | No | 15 | Max memories to recall (1-100). |

### Example Request

```
User: Initialize the session at conversation start to restore context.

System calls: memory_session_start with:
- namespace: "myproject"
- query: "authentication and session management"
- limit: 15
```

### Example Response

```
## Session Context (12 memories)

**Project Indexed**: README.md, package.json, src/index.ts scanned (src/index.ts already indexed).

**Queue**: Processed 3 pending entries from last session.

**Profile**: Top tags: decision, architecture, code | Languages: TypeScript, Python

**Decisions**:
- [decision, architecture] Use PostgreSQL for production with Alembic migrations...
- [decision, security] Implement JWT with 15m access tokens and refresh tokens...
- [decision, database] Add indexes on user_id and created_at columns for query performance...

**Architecture**:
- [architecture, code] Modular service architecture with separate auth, api, data layers...
- [architecture, deployment] Docker containers with Kubernetes orchestration...

**Recent Errors**:
- [error, database] Fix: Connection pooling issue in PostgreSQL adapter when under load...

**Other Context**:
- [conversation] Notes from Monday standup about Q2 roadmap...
- [code] TypeScript strict mode configuration for all services...
```

### Behavior

1. Auto-indexes project (README, package.json, etc.) if not already indexed
2. Processes queue of pending memories from last session (up to 5 entries batched)
3. Loads and displays cached user profile (coding patterns, top tags, languages)
4. Recalls top-N memories matching query
5. Groups results by category (decisions, architecture, errors, other)
6. Returns formatted context bundle with ~300 char preview per entry
7. Typically called once per conversation to restore context

---

## 11. memory_session_summary

Combine memories from a session into a single high-importance summary.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `sessionId` | string | No | most recent | Specific session to summarize. If omitted, uses most recent session. |
| `namespace` | string | No | auto-detected | Project namespace. |

### Example Request

```
User: Create a summary of today's work session.

System calls: memory_session_summary with:
- namespace: "myproject"
```

### Example Response

```
Summarized 24 memories from session "sess_2026-03-20-10am".

Session summary (sess_2026-03-20-10am):
Fixed bug in authentication flow where JWT tokens expired prematurely
Implemented rate limiting on API endpoints using node-rate-limiter
Added comprehensive error handling for database connection failures
Reviewed pull request for schema migration strategy and approved changes
Discussed Q2 goals: improve test coverage, reduce deployment time, scale to 10K users
```

### Behavior

- Filters all entries by matching `sessionId` metadata
- If no sessionId provided, finds most recent session by timestamp
- Sorts entries chronologically (oldest first)
- Builds summary from first 100 chars of each entry, max 2000 chars total
- Saves summary as new high-priority entry tagged with `conversation`, `decision`
- Useful for end-of-session notes or capturing daily progress

---

## 12. memory_stats

Show memory statistics: total count, per-tag breakdown, sources, oldest/newest, disk usage.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `namespace` | string | No | auto-detected | Project namespace to analyze. |

### Example Request

```
User: Show statistics for memory usage in this project.

System calls: memory_stats with:
- namespace: "myproject"
```

### Example Response

```
## Memory Statistics

**Total entries**: 247
**Sessions**: 12
**Avg entries/session**: 20.6
**Oldest**: 2026-01-15T08:30:00Z
**Newest**: 2026-03-20T14:45:00Z
**Disk usage**: 3.2 MB

### By Tag
- architecture: 52
- decision: 48
- code: 31
- config: 28
- conversation: 22
- error: 18
- dependency: 15
- todo: 12
- performance: 8
- security: 7

### By Source
- explicit: 198
- hook:post_tool_use: 38
- hook:stop: 11
- import: 0
```

### Behavior

- Paginates to fetch all entries (no limit)
- Counts per-tag (entries may have multiple tags)
- Counts per-source
- Calculates session statistics
- Extracts timestamp range
- Calculates directory size in bytes (KB/MB)
- Useful for understanding growth, memory bloat, and patterns

---

## 13. memory_profile

View or regenerate your user profile — shows coding patterns, preferred languages, frequently modified files, and decision history.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `namespace` | string | No | auto-detected | Project namespace. |
| `regenerate` | boolean | No | false | If true, regenerate profile from scratch. Otherwise use cached version. |

### Example Request

```
User: Show my coding profile for this project.

System calls: memory_profile with:
- namespace: "myproject"
- regenerate: false
```

### Example Response

```
## User Profile: myproject
_Generated: 2026-03-20T14:30:00Z_

### Stats
- **Total memories**: 247
- **Sessions**: 12
- **Avg entries/session**: 20.6
- **Oldest memory**: 2026-01-15T08:30:00Z
- **Newest memory**: 2026-03-20T14:45:00Z

### Top Tags
- decision: 48 (19.4%)
- architecture: 52 (21.1%)
- code: 31 (12.6%)
- config: 28 (11.3%)
- conversation: 22 (8.9%)

### Preferred Languages
TypeScript, Python, SQL, Go

### Frequently Referenced Files
- src/memory/memory-manager.ts (24)
- src/tools/save-context.ts (18)
- src/storage/chromadb-adapter.ts (14)
- package.json (12)

### Frequently Referenced Functions
- manager.save() (18)
- manager.recall() (14)
- createStore() (9)
- parseQuery() (7)

### Common Packages
@modelcontextprotocol/sdk, chromadb, uuid, zod

### Recent Decisions
- Use PostgreSQL for production database
- Implement JWT authentication with refresh tokens
- Add indexes on frequently queried columns
- Switch to OpenAI embeddings for better accuracy

_Cached profile. Use `regenerate: true` to refresh._
```

### Behavior

- Tries to load cached profile first (unless regenerate=true)
- If no cache, generates fresh profile by analyzing all memories
- Profile shows patterns discovered from entry analysis:
  - Top tags by frequency
  - Languages extracted from code memories
  - Files mentioned in memories
  - Functions/methods referenced
  - Packages used
  - Recent decisions
- Saves generated profile as special `__profile__` memory for caching
- Regeneration takes seconds (scans all entries)

---

## 14. memory_compact

Compact memories: remove expired entries, merge near-duplicates, evict oldest if over limit.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `namespace` | string | Yes | — | Project namespace to compact. |
| `dryRun` | boolean | No | false | Preview what would be removed without actually deleting. |
| `ttlDays` | number | No | 180 | TTL in days — entries older than this are expired. |
| `maxEntries` | number | No | 10000 | Maximum entries to keep in namespace. If exceeded, oldest entries evicted. |

### Example Request

```
User: Clean up old memories, keeping only 1 year of data with max 500 entries per project.

System calls: memory_compact with:
- namespace: "myproject"
- ttlDays: 365
- maxEntries: 500
- dryRun: false
```

### Example Response (dry run)

```
## Compaction Preview (dry run)

**Total entries**: 1247
**Expired (TTL)**: 234
**Merged (near-duplicates)**: 12
**Evicted (over limit)**: 501
**Remaining**: 500
```

### Example Response (actual compaction)

```
## Compaction Complete

**Total entries**: 1247
**Expired (TTL)**: 234
**Merged (near-duplicates)**: 12
**Evicted (over limit)**: 501
**Remaining**: 500
```

### Behavior

- Requires namespace (no default)
- Dry run shows what would happen without making changes
- Removes entries older than ttlDays (default 180 days = 6 months)
- Merges near-duplicates (>92% similarity)
- Evicts oldest entries if total exceeds maxEntries
- Operations applied in order: expire → merge → evict
- Useful for managing storage growth and preventing stale context

---

## 15. memory_related

Find memories related to a specific memory ID via the memory graph, or find all memories mentioning a specific entity.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `id` | string | No | — | The memory ID to find relations for. |
| `entity` | string | No | — | Entity value to search for (e.g., 'auth.ts', 'handleLogin', 'express'). Returns all memories mentioning this entity. |
| `namespace` | string | No | auto-detected | Project namespace. |

### Example Request

```
User: Find memories related to authentication or mentioning the file "auth.ts".

System calls: memory_related with:
- entity: "auth.ts"
- namespace: "myproject"

OR

System calls: memory_related with:
- id: "uuid-auth-decision"
- namespace: "myproject"
```

### Example Response (entity-based)

```
Found 7 memories mentioning "auth.ts":

--- Result 1 ---
ID: uuid-auth001
Summary: JWT token implementation in auth.ts
Tags: code, decision
Timestamp: 2026-03-20T10:30:00Z
Content: Implemented JWT token creation and validation...

--- Result 2 ---
ID: uuid-auth002
Summary: Refactored auth.ts for better error handling
Tags: code, refactoring
Timestamp: 2026-03-19T14:15:00Z
Content: Added comprehensive error messages for auth failures...
```

### Example Response (id-based)

```
Found 3 relations for memory uuid-auth-decision:

--- Relation 1 ---
Related ID: uuid-oauth
Type: references
Strength: 0.87
Summary: OAuth2 flow implementation
Content: Integrate OAuth2 for federated authentication...
Created: 2026-03-20T11:00:00Z

--- Relation 2 ---
Related ID: uuid-sessions
Type: elaborates
Strength: 0.82
Summary: Session management strategy
Content: Use Redis for session storage...
Created: 2026-03-19T15:30:00Z
```

### Behavior

- **Entity-based**: Searches entity index for all memories mentioning the entity
- **ID-based**: Looks up memory relation graph for connections to specified ID
- Relation types: `similar`, `supersedes`, `references`, `contradicts`, `elaborates`
- Strength: 0.0-1.0 (higher = stronger relation)
- Either `id` or `entity` required (not both)
- Useful for exploring knowledge graph and finding related context

---

## 16. memory_index

Index the current project by scanning key files (README, package.json, etc.) and saving them as high-importance memories.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `namespace` | string | No | auto-detected | Project namespace. |
| `force` | boolean | No | false | Re-index even if the project has already been indexed. |

### Example Request

```
User: Index the project structure for the first time.

System calls: memory_index with:
- namespace: "myproject"
- force: false
```

### Example Response (first time)

```
## Project Indexed

**Indexed** (3): README.md, package.json, src/index.ts
**Skipped** (not found): Dockerfile, docker-compose.yml
Directory tree saved as architecture memory.
```

### Example Response (already indexed)

```
Project already indexed. Use `force: true` to re-index.
```

### Behavior

- Scans for common files: README.md, package.json, tsconfig.json, Dockerfile, docker-compose.yml, .env, Makefile, etc.
- Extracts content from found files
- Creates architecture memory with directory tree
- Creates high-priority memories for each found file
- Uses `.indexed` marker file to prevent re-indexing
- Force flag deletes marker file and re-indexes
- Auto-called by memory_session_start if not already indexed

---

## 17. memory_ingest

Ingest content from a file path or URL — auto-detects format, extracts text, and saves as memory.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `input` | string | Yes | — | File path (local) or URL (http/https). Auto-detected format. |
| `namespace` | string | No | auto-detected | Project namespace to ingest into. |
| `tags` | string[] | No | [] | Semantic tags for the ingested content. |

### Example Request

```
User: Ingest a PDF whitepaper about distributed systems and tag it as architecture.

System calls: memory_ingest with:
- input: "/path/to/distributed-systems.pdf"
- namespace: "myproject"
- tags: ["architecture", "reference"]

OR

System calls: memory_ingest with:
- input: "https://example.com/article/caching-strategies.md"
- namespace: "myproject"
- tags: ["architecture", "performance"]
```

### Example Response

```
Ingested: /path/to/distributed-systems.pdf
Format: pdf
Text length: 12847 chars
Saved 3 memory entries (uuid-pdf-001, uuid-pdf-002, uuid-pdf-003)
```

### Behavior

- Supports formats:
  - **Code**: .ts, .js, .py, .go, .rs, .java, .rb, .c, .cpp, .h
  - **Markup**: .md
  - **Images**: .png, .jpg, .jpeg, .gif, .bmp, .webp
  - **Documents**: .pdf
  - **URLs**: http/https (fetches and auto-detects)
- Extracts text from each format using specialized extractors
- For URLs: fetches HTML, extracts readable content, preserves source URL
- For images: performs OCR using Tesseract
- For PDFs: extracts text per page
- For code: includes language context
- For markdown: preserves structure
- Content chunked if >500 chars (multiple entries)
- Returns count of entries created

---

## Search Modes Explained

### vector

Cosine similarity search on embeddings. Best for semantic/conceptual queries.

```
Query: "how to optimize database performance"
→ Matches: "Add indexes for faster queries", "Use connection pooling", "Query optimization tips"
```

### keyword

BM25 keyword matching. Best for exact phrases and technical terms.

```
Query: "PostgreSQL JSONB indexing"
→ Matches: Memories containing "PostgreSQL", "JSONB", "indexing" (exact words)
```

### hybrid

70% vector + 30% keyword. Combines semantic understanding with keyword precision.

```
Query: "JWT token refresh strategy"
→ Matches: Semantically similar (vector) + Contains exact terms "JWT", "token", "refresh" (keyword)
```

---

## Built-in Tags Reference

These tags are predefined and used in auto-tagging based on content analysis:

| Tag | Use Case |
|-----|----------|
| `conversation` | Meeting notes, discussion summaries, standup notes |
| `decision` | Architecture decisions, technology choices, important conclusions |
| `code` | Code snippets, implementations, functions, examples |
| `error` | Bug reports, stack traces, issues found and fixed |
| `architecture` | System design, module structure, data flow, patterns |
| `config` | Configuration, environment variables, setup instructions |
| `dependency` | Libraries, packages, versions, compatibility notes |
| `todo` | Action items, reminders, future work |

Custom tags also accepted and preserved across all operations.

---

## Common Patterns

### Workflow: Save → Recall → Refine

```
1. memory_save("We decided to use Redis for caching", tags=["decision", "architecture"])
2. [Later] memory_recall("caching strategy")
3. Refine the memory with new information
4. memory_save("Updated caching strategy: Redis for cache, database for source of truth")
```

### Workflow: Session Management

```
1. memory_session_start() - restore context at conversation start
2. [Work on tasks]
3. memory_save(...) - save decisions, discoveries
4. memory_session_summary() - create end-of-session summary
5. [Next session] memory_session_start() - restored full context
```

### Workflow: Project Onboarding

```
1. memory_index() - scan project structure
2. memory_ingest("README.md") - ingest documentation
3. memory_ingest("ARCHITECTURE.md") - ingest architecture docs
4. memory_recall("project structure") - understand project
5. memory_save("Onboarded successfully, team uses TypeScript + PostgreSQL")
```

---

## Error Handling

Most tools return graceful errors:

| Scenario | Response |
|----------|----------|
| No memories found | "No matching memories found." |
| Entry not found (forget) | "Memory entry {id} not found." |
| Invalid format (ingest) | "Unsupported format: {input}. Supported: ..." |
| Extraction error | "Extraction failed: {message}" |
| JSON parse error (import) | "Failed to parse JSON content" |

Tools continue gracefully; non-fatal errors don't halt execution.

