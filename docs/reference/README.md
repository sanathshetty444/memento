# Memento Reference Documentation

Complete reference documentation for Memento persistent semantic memory system. These are exhaustive, parameter-complete references suitable as the definitive source of truth for developers, DevOps engineers, and systems integrators.

## Documents

### [tools.md](tools.md) - MCP Tools Reference (1065 lines)
Complete reference for all 17 MCP tools available in Memento.

**Coverage:**
- memory_save, memory_recall, memory_search, memory_forget, memory_list
- memory_health, memory_export, memory_import, memory_migrate
- memory_session_start, memory_session_summary, memory_stats
- memory_profile, memory_compact, memory_related, memory_index, memory_ingest

**For each tool:**
- Complete parameter list (name, type, required, default, description)
- Example natural language requests
- Example responses with realistic output
- Detailed behavior documentation
- Search modes explained (vector, keyword, hybrid)

**Additional sections:**
- Built-in tags reference
- Common workflow patterns
- Error handling guide

---

### [cli.md](cli.md) - CLI Command Reference (591 lines)
Complete reference for the Memento CLI tool.

**Commands:**
- `memento setup [--target <target>]` - Configure for different IDEs
- `memento status` - Check installation status
- `memento teardown` - Remove configuration (keeps data)
- `memento serve [--port <port>]` - Start HTTP server

**Setup targets:**
- Claude Code (default)
- Cursor IDE
- Windsurf IDE
- OpenCode

**For each command/target:**
- Detailed parameter documentation
- What gets configured/installed
- Configuration file paths
- Example output
- Troubleshooting

**Additional sections:**
- Configuration directories and structure
- Exit codes and error handling
- Global flags
- Best practices
- Migration paths between IDEs

---

### [storage-backends.md](storage-backends.md) - Storage Reference (723 lines)
Complete reference for all 4 storage backends.

**Backends:**
- Local Files (default) - filesystem-based
- IndexedDB (browser) - client-side storage
- ChromaDB - vector database optimized for search
- Neo4j - graph database for relations

**For each backend:**
- Overview and use case
- Configuration with example JSON
- Dependencies and installation
- Directory structure / data model
- Performance characteristics (tables with benchmarks)
- Trade-offs analysis (pros and cons)
- Setup instructions
- Limitations
- When to use / when not to use

**Additional sections:**
- Comparison matrix
- Backup and recovery (for local)
- Browser compatibility (for IndexedDB)
- Migration instructions between backends
- Recommendations by use case

---

### [embedding-providers.md](embedding-providers.md) - Embedding Reference (750 lines)
Complete reference for all 4 embedding providers.

**Providers:**
- Local / MiniLM (default) - on-device, free
- OpenAI - cloud, highest quality (1536-dim)
- Gemini SDK - cloud, balanced cost/quality (768-dim)
- Gemini Fetch (browser) - cloud, browser-compatible (768-dim)

**For each provider:**
- Model details and dimensions
- Cost and pricing analysis
- Performance metrics (tables with benchmarks)
- Installation and dependencies
- Configuration with example JSON
- Environment variables
- Trade-offs analysis
- Setup instructions
- Limitations
- When to use / when not to use

**Additional sections:**
- Switching providers with dry-run support
- Migration instructions
- Comparison matrix
- Cost comparison table
- Dimension reduction options
- Recommendations by use case

---

### [types.md](types.md) - TypeScript Types Reference (732 lines)
Complete TypeScript type definitions for Memento.

**Core Types:**
- MemoryEntry - represents a single memory
- MemoryMetadata - rich metadata about memories
- MemoryTag, MemorySource, MemoryPriority
- MemoryResult, MemoryRelation, RelationType

**Options Types:**
- SaveOptions - parameters for saving
- RecallOptions - parameters for searching
- ListOptions - parameters for listing

**Interface Types:**
- VectorStore - storage backend interface with all methods
- EmbeddingProvider - embedding interface
- SearchFilters, ListFilters

**Config Types:**
- MementoConfig - main configuration
- StoreConfig, EmbeddingsConfig, CaptureConfig, MemoryConfig

**Additional sections:**
- Constants (namespaces, limits, built-in tags, signal keywords)
- Usage examples and import statements
- Utility types
- Notes on format conventions

---

### [rest-api.md](rest-api.md) - REST API Reference (780 lines)
OpenAPI-style reference for Memento's HTTP server.

**Endpoints:**
- POST /api/save - Save a memory
- POST /api/recall - Search within namespace
- POST /api/search - Search all namespaces
- GET /api/list - List with pagination
- GET /api/health - Health check
- DELETE /api/:id - Delete by ID
- GET / - Web UI

**For each endpoint:**
- Complete request format with JSON example
- All query/body parameters documented
- Response format with example
- HTTP status codes
- Error responses

**Code examples in:**
- JavaScript (Fetch API)
- Python (requests library)
- TypeScript
- cURL

**Additional sections:**
- Authentication (optional API key)
- CORS headers
- Rate limiting guidance
- Performance metrics
- Batch operations
- Reverse proxy setup (nginx, Apache)
- Security considerations
- Timeouts and limits

---

## How to Use These Docs

### Finding Information

**I want to...**

- **Use a specific tool** → See [tools.md](tools.md)
  - memory_save → Go to section "1. memory_save"
  - memory_recall → Go to section "2. memory_recall"
  - etc.

- **Set up Memento** → See [cli.md](cli.md)
  - For Claude Code → Section "setup (default)"
  - For Cursor → Section "setup --target cursor"
  - etc.

- **Choose a storage backend** → See [storage-backends.md](storage-backends.md)
  - Compare trade-offs → See "Comparison Matrix"
  - Local storage details → Section "1. Local Files (Default)"
  - Production deployment → Recommendations by use case

- **Choose an embedding provider** → See [embedding-providers.md](embedding-providers.md)
  - Compare cost vs quality → See "Cost Comparison" and "Comparison Matrix"
  - Budget-first → Section "1. Local / MiniLM (Default)"
  - Highest quality → Section "2. OpenAI"

- **Integrate with REST API** → See [rest-api.md](rest-api.md)
  - Save a memory → Section "POST /api/save"
  - Search memories → Section "POST /api/recall"
  - Examples in your language → Code examples section

- **Understand the data model** → See [types.md](types.md)
  - What fields does a memory have? → MemoryEntry section
  - How to create a memory programmatically? → SaveOptions section
  - Type-safe integration → Usage Examples section

### Common Tasks

#### "I want to save a memory"

1. See [tools.md](tools.md) → Section "1. memory_save"
2. Review parameters table for all options
3. Look at "Example Request" and "Example Response"
4. For code: See [rest-api.md](rest-api.md) → "Code examples" or [types.md](types.md) → "Type-Safe Operations"

#### "I want to switch from local to OpenAI embeddings"

1. See [embedding-providers.md](embedding-providers.md) → Section "2. OpenAI"
2. Follow "Setup Instructions"
3. See "Switching Providers" section in [embedding-providers.md](embedding-providers.md)
4. Use memory_migrate tool from [tools.md](tools.md) → Section "9. memory_migrate"

#### "I want to deploy Memento for a team"

1. Choose storage backend:
   - See [storage-backends.md](storage-backends.md) → Recommendations
   - Typically: ChromaDB for production, Neo4j for distributed teams
2. Choose embedding provider:
   - See [embedding-providers.md](embedding-providers.md) → Recommendations
   - Typically: Local for privacy, OpenAI for quality
3. Set up:
   - See [cli.md](cli.md) → "setup" command
   - Update config files per [types.md](types.md) → MementoConfig section
4. Run server:
   - See [cli.md](cli.md) → "serve" command
   - For REST API: See [rest-api.md](rest-api.md) → Overview
   - For reverse proxy: See [rest-api.md](rest-api.md) → "Reverse Proxy Setup"

#### "I want to understand the TypeScript API"

1. See [types.md](types.md) for all type definitions
2. See [tools.md](tools.md) for what each tool does
3. Look at "Type-Safe Operations" example in [types.md](types.md)

#### "I want to build a browser extension"

1. Storage: See [storage-backends.md](storage-backends.md) → Section "2. IndexedDB"
2. Embedding: See [embedding-providers.md](embedding-providers.md) → Section "4. Gemini Fetch"
3. Setup: See respective setup instructions in each document
4. Tools: See [tools.md](tools.md) for all available operations

---

## Document Statistics

| Document | Lines | Size | Topics |
|----------|-------|------|--------|
| tools.md | 1065 | 30KB | 17 tools, search modes, patterns, error handling |
| cli.md | 591 | 12KB | 4 commands, 4 targets, config, troubleshooting |
| storage-backends.md | 723 | 17KB | 4 backends, trade-offs, performance, migration |
| embedding-providers.md | 750 | 17KB | 4 providers, pricing, setup, recommendations |
| types.md | 732 | 18KB | All TypeScript types, interfaces, constants, examples |
| rest-api.md | 780 | 15KB | 7 endpoints, auth, CORS, security, examples |
| **TOTAL** | **4641** | **109KB** | **Complete system reference** |

---

## Key Features

- **Exhaustive**: Every parameter, every option, every field documented
- **Precise**: Exact types, defaults, constraints, and specifications
- **Practical**: Examples in real scenarios and code
- **Comparable**: Trade-off matrices and comparison tables for informed decisions
- **Structured**: Consistent format across documents for easy navigation
- **Searchable**: Markdown format, well-organized with headers and tables

---

## Quick Reference

### All 17 Tools

1. memory_save - Save to memory
2. memory_recall - Search within namespace
3. memory_search - Search all namespaces
4. memory_forget - Delete by ID
5. memory_list - List with filters
6. memory_health - System status
7. memory_export - Export as JSON/CSV/etc
8. memory_import - Import from external source
9. memory_migrate - Re-embed with new provider
10. memory_session_start - Restore session context
11. memory_session_summary - Summarize session
12. memory_stats - View statistics
13. memory_profile - View user profile
14. memory_compact - Clean up old entries
15. memory_related - Find related memories
16. memory_index - Index project files
17. memory_ingest - Ingest files/URLs

### All 4 Storage Backends

1. **Local Files** (default) - Fast, free, offline
2. **IndexedDB** - Browser storage, per-extension
3. **ChromaDB** - Production vector DB
4. **Neo4j** - Graph DB for relations

### All 4 Embedding Providers

1. **Local/MiniLM** (default) - Free, offline, 384-dim
2. **OpenAI** - Highest quality, 1536-dim, $0.02/M tokens
3. **Gemini SDK** - Balanced, 768-dim, $2/M tokens
4. **Gemini Fetch** - Browser, 768-dim, $2/M tokens

### All 4 CLI Commands

1. **setup** [--target `<target>`] - Configure for IDE
2. **status** - Check installation
3. **teardown** - Remove config (keep data)
4. **serve** [--port `<port>`] - Start HTTP server

---

## For Questions

See the relevant document section:
- **"How do I...?"** → Tools section in [tools.md](tools.md)
- **"What are the options for...?"** → Comparison matrices in backend/provider docs
- **"How do I set up...?"** → Setup Instructions in [cli.md](cli.md) or provider docs
- **"What's the API for...?"** → [rest-api.md](rest-api.md) or [types.md](types.md)
- **"What are the trade-offs...?"** → Trade-offs section in storage/provider docs

