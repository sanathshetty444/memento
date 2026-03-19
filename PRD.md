### 1. Objective & Purpose (The "Why")

**The Problem:** Claude Code's memory is ephemeral. Sessions get autocompacted, context is lost, and there's no way to semantically recall what was discussed, decided, or built across sessions. Developers waste time re-explaining context every new conversation.

**The Solution:** Memento is a Claude Code plugin + MCP server that automatically captures conversation context, decisions, and code knowledge into a vector database, then enables semantic recall across sessions, projects, and even after autocompact.

**The "Why Now":** Local embedding models (transformers.js) are fast enough to run on dev machines with zero API cost. The MCP protocol standardizes tool integration across Claude CLI and App. The plugin architecture makes distribution trivial. And the freemium SaaS model enables cross-device sync and team sharing for power users.

### 2. Target Audience & User Personas

- **Power Claude Code Users:** Developers who use Claude Code daily across multiple projects and lose context between sessions. Want seamless recall without manual note-taking.

- **Team Leads / Senior Engineers:** Work across many repos, make architectural decisions that need to persist. Want to ask "what did we decide about auth?" weeks later.

- **Teams (Pro tier):** Engineering teams that want shared memory across team members — "what did Alice learn about the billing integration?"

- **Motivation:** Eliminate context re-establishment overhead. Make Claude truly remember.

### 3. Features & Functionality (MoSCoW)

| **Priority** | **Feature** | **Description** |
|---|---|---|
| **Must-Have** | Semantic Memory Save | MCP tool to explicitly save context with auto-tagging (code, decision, error, architecture) |
| **Must-Have** | Semantic Memory Recall | MCP tool to query memories by natural language with relevance ranking |
| **Must-Have** | Auto-Capture Hooks | Automatically capture significant tool uses and session summaries via Claude Code hooks |
| **Must-Have** | Per-Project Isolation | Memories scoped by project namespace, preventing cross-project leakage |
| **Must-Have** | Local-First Operation | Works offline with local embeddings + ChromaDB, zero API keys required |
| **Must-Have** | Sensitive Data Redaction | Auto-scrub API keys, tokens, passwords before storage |
| **Should-Have** | Cross-Project Search | Opt-in search across all projects for shared knowledge |
| **Should-Have** | Global Memory Namespace | Store user preferences, patterns, and cross-project knowledge |
| **Should-Have** | Neo4j Storage Adapter | Graph-enhanced storage reusing omnigraph-ai infrastructure |
| **Should-Have** | Cloud Embeddings | Gemini and OpenAI embedding adapters for higher quality vectors |
| **Should-Have** | Resilience (Circuit Breaker, WAL) | Graceful degradation when storage is unavailable |
| **Could-Have** | Cloud SaaS Backend | Hosted API for cloud storage, cross-device sync, and team sharing |
| **Could-Have** | Freemium Tiers | Free (local-only) -> Pro (cloud sync, team sharing, managed embeddings) |
| **Could-Have** | Memory Migration | Export/import between storage backends (ChromaDB <-> Neo4j) |
| **Could-Have** | Memory Compaction | Merge near-duplicate memories, TTL expiry for stale entries |
| **Could-Have** | Embedding Model Migration | Handle model switches with dual-read and background re-embedding |
| **Won't-Have (MVP)** | LLM-based Summarization | Using Claude/Gemini to summarize before storing (keep it deterministic for v1) |
| **Won't-Have (MVP)** | Multi-agent Memory Sharing | Real-time memory sync between concurrent Claude sessions |

### 4. User Flow & Design

1. **Install:** User installs the Memento plugin or adds the MCP server to `.mcp.json`
2. **Zero Config:** On first run, creates `~/.claude-memory/` with local ChromaDB + transformers.js embeddings. No API keys needed.
3. **Automatic Operation:** Hooks begin capturing significant tool uses (file edits, git commits, config changes) and session summaries in the background. Noise filtering ensures only meaningful context is stored.
4. **Explicit Save:** User tells Claude "remember that we decided to use JWT for auth" -> Claude calls `memory_save` with auto-detected tags `["decision", "architecture"]`
5. **New Session / Post-Autocompact:** User starts a fresh session. All built-in Claude memory is gone.
6. **Recall:** User asks "what did we decide about auth?" -> Claude calls `memory_recall` -> gets relevant memories with context, ranked by semantic similarity.
7. **Cross-Project:** User switches to another repo, asks "how did I handle database migrations in that other project?" -> Claude calls `memory_search` (cross-project mode)
8. **Pro Upgrade (future):** User enables cloud mode -> memories sync across devices, team members can share project memories.

### 5. Success Metrics & KPIs

- **Recall Latency:** < 200ms p95 for semantic search (local mode)
- **Hook Overhead:** < 50ms per tool use event (fire-and-forget to async queue)
- **Recall Accuracy:** Relevant memory appears in top 3 results for queries about saved context
- **Zero-Config Setup:** Working system with `npm install` + add to `.mcp.json`, no API keys needed
- **Storage Efficiency:** < 500MB disk usage for 10K memories with local embeddings
- **Adoption:** Measured by plugin installs and daily active recall queries

### 6. Non-Goals / Out of Scope

- Building consumer-facing chat memory applications
- Training or fine-tuning embedding models
- Replacing Claude's built-in file-based memory system (Memento supplements it)
- Real-time collaboration / concurrent session memory sharing (v1)
- On-device LLM for summarization or re-ranking
