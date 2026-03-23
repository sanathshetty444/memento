# How Memento Works: The Complete Architecture Guide

Memento solves a fundamental problem: AI agents forget. Claude can only see the current conversation. Once you close the IDE or the conversation gets too long and gets "compacted," important context vanishes. Memento is your solution—a persistent external memory system that remembers everything important across sessions.

This guide explains every component in detail, from the capture pipeline to semantic search, so you understand not just *how to use* Memento, but *how it works* under the hood.

## The Problem: Why Agents Need External Memory

### What AI Agents Can See

Claude's context window (the amount of text it can see at once) is large but finite. In Claude Code, you get about 150,000 tokens. That sounds like a lot, but here's what happens:

1. **Session 1**: You work on a React authentication system. You make 500 tokens of conversation.
2. **Session 2** (next day): New conversation. Claude can't see Session 1 anymore. 0 tokens of context.
3. **Session 3** (week later): You're back, but Claude still can't see Sessions 1 or 2.

Even within a single long conversation, context gets lost:

1. You discuss database architecture (tokens 1-500)
2. You work on API endpoints (tokens 501-2000)
3. You discuss caching strategy (tokens 2001-2500)
4. The conversation gets long. Claude might not remember token 100-400 clearly.

### The Solution: External Memory

Memento stores important information *outside* the context window, in a local database. When you start a new session or need context, Memento retrieves it:

```
Session 1: Working on auth system
  → Memento captures: "Using JWT with HS256"
  → Stores in ~/.claude-memory/

(IDE closes)

Session 2: New conversation about same project
  → Memento: "You previously decided on JWT with HS256"
  → Context restored!
```

This way, important architectural decisions, bug fixes, and patterns persist forever.

## The Full Memento System

Here's how everything fits together:

```
┌─────────────────────────────────────────────────────────────┐
│                   Your AI Coding IDE                        │
│              (Claude Code, Cursor, Windsurf)                │
│                  Your conversation here                     │
└────────────┬────────────────────────────────────────────────┘
             │
             │ MCP Protocol
             │ (Model Context Protocol)
             │
┌────────────▼────────────────────────────────────────────────┐
│           Memento MCP Server (Node.js process)              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   MCP Tools                          │  │
│  │  - /save          (manual save)                      │  │
│  │  - /recall        (get context)                      │  │
│  │  - /search        (find memories)                    │  │
│  │  - /forget        (delete memory)                    │  │
│  │  - /list          (show all memories)                │  │
│  │  - /health        (check status)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Auto-Capture Pipeline                      │  │
│  │  1. Hook: Listen for MCP tool calls                  │  │
│  │  2. Queue: Batch messages (30-second window)         │  │
│  │  3. Redact: Remove secrets, API keys, passwords      │  │
│  │  4. Tag: Add semantic categories                     │  │
│  │  5. Chunk: Split into 512-token pieces               │  │
│  │  6. Dedup: Skip if memory already exists             │  │
│  │  7. Embed: Convert to 384-dim vector                 │  │
│  │  8. Store: Save to storage backend                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Storage & Retrieval Layer                    │  │
│  │                                                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐        │  │
│  │  │ChromaDB  │  │ Neo4j    │  │ Other*     │        │  │
│  │  │(default) │  │(optional)│  │(future)    │        │  │
│  │  └──────────┘  └──────────┘  └────────────┘        │  │
│  │      ↓              ↓              ↓                │  │
│  │  Local JSON    Graph database   Custom store       │  │
│  │  files         with relations                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      Embedding Provider (384-dim vectors)            │  │
│  │                                                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐        │  │
│  │  │Local     │  │OpenAI    │  │Google      │        │  │
│  │  │Mini-LM   │  │GPT       │  │Gemini      │        │  │
│  │  │(default) │  │(optional)│  │(optional)  │        │  │
│  │  └──────────┘  └──────────┘  └────────────┘        │  │
│  │                                                      │  │
│  │  all-MiniLM-L6-v2: Free, offline, local, fast      │  │
│  └──────────────────────────────────────────────────────┘  │
│                         ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Resilience Layer                           │  │
│  │  - Circuit breaker (auto-disable on failures)       │  │
│  │  - Write-ahead log (crash recovery)                 │  │
│  │  - LRU cache (fast repeated access)                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
             ↓
  ~/.claude-memory/
  ├── memories/          (JSON files with memories)
  ├── chromadb/          (Vector database indices)
  ├── config.json        (Settings)
  └── wal/               (Crash recovery logs)
```

## Stage 1: Auto-Capture Pipeline

The auto-capture pipeline runs automatically whenever the AI agent uses an MCP tool. Here's what happens at each stage:

### 1. Hook: Listening for Activity

Memento registers a hook with the MCP server. Whenever any tool is called, the hook fires:

```javascript
// Pseudo-code: what happens internally
onToolCall((toolName, input, output) => {
  if (toolName === 'save' || toolName === 'recall') {
    // These are already explicit memory operations
    return;
  }

  // Capture this tool call for auto-processing
  queueForProcessing({
    tool: toolName,
    input: input,
    output: output,
    timestamp: Date.now()
  });
});
```

Example: You use a code analysis tool. The hook captures it:

```
Tool: code_analyzer
Input: "Analyze this React component"
Output: "Found 3 performance issues..."
Timestamp: 2026-03-23T10:30:00Z
```

### 2. Queue: Batching for Efficiency

Instead of processing immediately, Memento queues the event and waits 30 seconds. If more events come in, they're batched together. This:
- Reduces database writes
- Groups related events
- Improves performance

```
Time 10:30:00 - Event 1: tool call (queued)
Time 10:30:05 - Event 2: tool call (queued together)
Time 10:30:15 - Event 3: tool call (queued together)
Time 10:30:30 - FLUSH: Process all 3 events together
```

### 3. Redaction: Removing Secrets

Before storing anything, Memento scans for sensitive information and redacts it. This prevents API keys, passwords, and personal information from being stored.

**Patterns Memento detects:**

```
API Keys:     sk-abc123... → [REDACTED_API_KEY]
Passwords:    "password123" → [REDACTED_PASSWORD]
Tokens:       "eyJhbGci..." → [REDACTED_TOKEN]
Emails:       "user@example.com" → [REDACTED_EMAIL]
URLs:         "https://api.example.com/..." → [REDACTED_URL]
Credit cards: "4111-1111-1111-1111" → [REDACTED_CARD]
SSN:          "123-45-6789" → [REDACTED_SSN]
Phone:        "555-123-4567" → [REDACTED_PHONE]
```

**Example transformation:**

Before:
```
"Here's the API key: sk-abc123def456. Username is john@example.com, password is SecurePass123!"
```

After:
```
"Here's the API key: [REDACTED_API_KEY]. Username is [REDACTED_EMAIL], password is [REDACTED_PASSWORD]!"
```

The redacted text is what gets stored. Secrets are never written to disk.

### 4. Tagging: Semantic Categorization

Memento analyzes the text and automatically assigns semantic tags. These help with later filtering and search.

**Available tags:**

| Tag | Meaning | Example |
|-----|---------|---------|
| `decision` | Architectural choice made | "Using JWT instead of sessions" |
| `code` | Code pattern or example | "React hook for data fetching" |
| `architecture` | System design | "Database schema for multi-tenant" |
| `bug` | Issue or bug fix | "Fixed race condition in reducer" |
| `dependency` | Library or external tool | "Using axios for API calls" |
| `config` | Configuration approach | "Environment variables for secrets" |
| `conversation` | General chat | "Small talk with Claude" |
| `performance` | Speed or optimization | "Caching strategy for images" |
| `security` | Safety concern | "CORS policy setup" |

**How tagging works:**

The system scans for keywords:
```
Text: "We decided to use JWT tokens because they're stateless..."

Keywords found:
- "decided" → tag: decision
- "JWT tokens" → tag: dependency, security
- "stateless" → tag: architecture

Final tags: [decision, architecture, dependency, security]
```

User or system can also override tags manually.

### 5. Chunking: Breaking into Pieces

Long texts are split into chunks for better storage and retrieval. Default chunk size is 512 tokens (roughly 2,000 characters).

**Why chunking matters:**

A single 5,000-token article gets split into 10 chunks. Each chunk:
- Gets its own embedding
- Can be recalled independently
- Helps with precise search results

**Example:**

Original text (1,200 tokens):
```
# Building a React App
... 400 tokens about setup ...
... 400 tokens about components ...
... 400 tokens about state management ...
```

After chunking:
```
Chunk 1: Setup instructions (512 tokens)
Chunk 2: Component patterns (512 tokens)
Chunk 3: State management (remaining tokens)
```

Each chunk is embedded separately, allowing fine-grained search:
```
/search "React component patterns"
→ Returns Chunk 2 specifically
→ Not the whole article
```

### 6. Deduplication: Avoiding Repeats

Before storing, Memento checks if this memory already exists. If the same text or very similar text was captured before, it's skipped.

**Algorithm:**

```
New memory: "JWT tokens are stateless"
  ↓
Check ChromaDB for similar memories (vector similarity > 95%)
  ↓
Found existing: "JWT uses stateless architecture"
  ↓
Skip storage, update timestamp on existing memory
```

This prevents bloat and keeps your memory store clean.

### 7. Embedding: Converting to Vectors

Now comes the core of Memento: converting text to embeddings. An embedding is a list of numbers that represents the meaning of text.

**The all-MiniLM-L6-v2 Model:**

- **384 dimensions**: The embedding is a list of 384 floating-point numbers
- **Free and open-source**: No API calls needed
- **Runs locally**: Downloaded once (~100 MB), then offline
- **Fast**: Can embed 1,000 texts per second on modern machines

**What the embedding represents:**

```
Text: "JWT tokens are stateless"

Embedding:
[
  0.234,   // dimension 1: represents "JWT" concept
  -0.156,  // dimension 2: represents "stateless" concept
  0.892,   // dimension 3: represents "authentication" concept
  ...,     // 381 more dimensions
  0.045    // dimension 384: represents "security" concept
]
```

Two texts with similar embeddings have similar meaning:

```
Text A: "JWT tokens are stateless"
Embedding A: [0.234, -0.156, 0.892, ..., 0.045]

Text B: "Stateless JWT authentication uses tokens"
Embedding B: [0.235, -0.155, 0.891, ..., 0.046]
             ^^^^^^  ^^^^^^   ^^^^^^  ^^^^^^
             Very close! These embeddings are almost identical,
             meaning the texts are semantically similar.
```

This is how semantic search works—it finds texts with similar embeddings, which usually means similar meaning.

### 8. Storage: Persisting to Disk

Finally, the memory is written to disk:

```json
// ~/.claude-memory/memories/mem_1e4c2f8b.json
{
  "id": "mem_1e4c2f8b",
  "namespace": "my-auth-app",
  "content": "JWT tokens are stateless. Each token contains encoded claims and is verified by the server without storing sessions. Reduces server load for distributed systems.",
  "embedding": [0.234, -0.156, 0.892, ..., 0.045],
  "tags": ["decision", "architecture", "dependency"],
  "createdAt": "2026-03-23T10:30:45Z",
  "updatedAt": "2026-03-23T10:30:45Z",
  "source": "auto-capture",
  "confidence": 0.92,
  "tokens": 32
}
```

And indexed in ChromaDB for fast retrieval:

```
ChromaDB Index:
  Memory ID: mem_1e4c2f8b
  Embedding: [0.234, -0.156, 0.892, ...]
  Metadata: {namespace: "my-auth-app", tags: [...]}
```

## Stage 2: The Recall Pipeline

When you use `/recall` or `/search`, Memento retrieves relevant memories. Here's the process:

### Step 1: Embedding Your Query

Your search query gets embedded the same way as captured memories:

```
User: /recall
Context: "I'm implementing token refresh logic"

Embedding of context: [0.240, -0.150, 0.890, ..., 0.040]
(Very similar to the JWT memory from earlier!)
```

### Step 2: Vector Similarity Search

Memento finds all memories with embeddings close to your query. "Close" means small Euclidean distance:

```
Query embedding: [0.240, -0.150, 0.890, ..., 0.040]

Memory A: [0.234, -0.156, 0.892, ..., 0.045]
Distance: 0.02 (very close!) → Similarity: 98%

Memory B: [0.45, 0.12, -0.60, ..., 0.89]
Distance: 1.5 (far away) → Similarity: 12%

Memory C: [0.239, -0.151, 0.891, ..., 0.041]
Distance: 0.004 (extremely close!) → Similarity: 99%

Results (sorted by similarity):
1. Memory C (99%)
2. Memory A (98%)
3. Memory B (12%)
```

### Step 3: Re-ranking

The top results are re-ranked by:
- **Recency**: Recent memories rank higher
- **Namespace**: Current project prioritized
- **Tags**: Memories with matching tags rank higher
- **Confidence**: High-confidence memories rank higher

```
Memory A: 98% similarity
  ×0.95 (recent)
  ×1.0 (same namespace)
  ×1.2 (matching tags)
  = 111.6 final score

Memory C: 99% similarity
  ×0.85 (older)
  ×1.0 (same namespace)
  ×1.0 (no matching tags)
  = 84.15 final score

New ranking:
1. Memory A (111.6)
2. Memory C (84.15)
```

### Step 4: Return to User

The top 5-10 memories are formatted and shown:

```
📚 Recalling context...

[Decision] JWT Architecture (confidence: 98%)
> JWT tokens are stateless. Each token contains...
> Saved 2 hours ago in my-auth-app

[Architecture] Token Lifecycle (confidence: 94%)
> Token expiration: 1 hour. Refresh tokens: 7 days...
> Saved 3 days ago in my-auth-app

[Code] JWT Verification Middleware (confidence: 87%)
> export const verifyToken = (token) => {...}
> Saved 1 week ago in my-auth-app
```

## Stage 3: Search Modes

Memento offers three search modes, each with different strengths:

### Mode 1: Vector Search (Semantic)

**What it does:** Finds memories with similar meaning, even if words don't match exactly.

**Algorithm:**
```
Query: "How do I handle errors in async code?"
  ↓
Embed query to vector
  ↓
Find all memories with high similarity (cosine distance)
  ↓
Return top results
```

**Example:**

Your memory says: "Use try-catch blocks in async functions"
Your query says: "What about exceptions in Promise chains?"

Vector search finds this memory because the embeddings are similar, even though the exact words differ.

**Scoring:**
```
Similarity score: 0.0 to 1.0
  0.9+ : Excellent match
  0.7-0.9: Good match
  0.5-0.7: Decent match
  <0.5 : Poor match
```

### Mode 2: Keyword Search (Precise)

**What it does:** Finds memories containing exact keywords from your query.

**Algorithm:**
```
Query: "React hooks authentication"
  ↓
Extract keywords: ["react", "hooks", "authentication"]
  ↓
Find memories containing these keywords
  ↓
Score by keyword coverage
```

**Example:**

Your query: "React hooks"
Matches:
- Memory saying "React hooks": 2/2 keywords (100%)
- Memory saying "React components": 1/2 keywords (50%)
- Memory saying "Vue hooks": 1/2 keywords (50%)

**Scoring:**
```
Matches / Total Keywords = Score
  3/3: 100% (all keywords found)
  2/3: 67% (two keywords found)
  1/3: 33% (one keyword found)
  0/3: 0% (no keywords found)
```

### Mode 3: Hybrid Search (Best)

**What it does:** Combines vector and keyword searches for the best of both worlds.

**Default weights:**
- 70% vector search (semantic understanding)
- 20% keyword search (precision)
- 10% recency bonus (fresh memories ranked higher)

**Algorithm:**
```
Query: "React authentication"
  ↓
Vector search: [Memory A (95%), Memory B (80%), Memory C (60%)]
Keyword search: [Memory A (100%), Memory C (100%), Memory B (0%)]
  ↓
Combine scores:
  Memory A: 70%*95% + 20%*100% + 10% = 75.5%
  Memory B: 70%*80% + 20%*0% + 10% = 56%
  Memory C: 70%*60% + 20%*100% + 10% = 62%
  ↓
Final ranking: A (75.5%), C (62%), B (56%)
```

This catches both semantic matches and keyword matches, giving you the best results.

## Storage Backends

Memento supports multiple storage backends. Each has different strengths:

### ChromaDB (Default)

**What it is:** A lightweight vector database that runs locally.

**Pros:**
- No setup required
- Stores data as JSON files locally
- Instant search
- No external dependencies

**Cons:**
- Limited to vector search
- No graph relationships

**Storage layout:**
```
~/.claude-memory/
├── chromadb/
│   ├── chroma.db
│   └── uUIDs/
└── memories/
    ├── mem_1.json
    ├── mem_2.json
    └── ...
```

### Neo4j (Optional)

**What it is:** A graph database that stores relationships between memories.

**Pros:**
- Finds relationships (Memory A influenced Memory B)
- Advanced queries
- Scalable to millions of memories

**Cons:**
- Requires Neo4j installation
- More complex setup
- Overkill for most users

**Graph structure:**
```
Memory: "Use JWT"
  ├─ RELATED_TO → "Token refresh logic"
  ├─ INFLUENCES → "Middleware design"
  └─ DEPENDS_ON → "Secret key management"
```

## Embedding Providers

Memento supports multiple embedding models. Each converts text to vectors differently:

### Local (Default)

**Model:** all-MiniLM-L6-v2 by Microsoft

**Pros:**
- Free and open-source
- No API keys needed
- Works offline
- Fast (1000s of texts per second)
- Good quality for general use

**Cons:**
- 384-dimensional (vs 1536 for OpenAI)
- Lower accuracy than cloud models

**Usage:**
```bash
npx memento-memory setup  # Uses local by default
```

### OpenAI (Optional)

**Model:** text-embedding-3-large

**Pros:**
- Highest quality embeddings
- 3,072 dimensions (highly expressive)
- Better semantic understanding

**Cons:**
- Costs money ($0.02 per 1M tokens)
- Requires API key
- Internet connection required

**Setup:**
```bash
export OPENAI_API_KEY=sk-...
npx memento-memory setup --embeddings openai
```

### Google Gemini (Optional)

**Model:** embedding-001

**Pros:**
- High quality
- Affordable
- Good for semantic search

**Cons:**
- Requires API key
- Internet connection required

**Setup:**
```bash
export GOOGLE_API_KEY=...
npx memento-memory setup --embeddings gemini
```

## The Resilience Layer

Memento is built to survive failures and provide reliable memory:

### Circuit Breaker

If the database fails too many times, Memento "opens the circuit" and stops trying:

```
Attempt 1: FAIL (1 failure)
Attempt 2: FAIL (2 failures)
Attempt 3: FAIL (3 failures)
Attempt 4: FAIL (4 failures)
Attempt 5: FAIL (5 failures)

Circuit opens! Stop retrying.
Returns: "Memory temporarily unavailable"
        "Auto-recovery in 60 seconds"

(60 seconds pass)

Circuit re-tries connection
Success!
Circuit closes. Back to normal.
```

### Write-Ahead Log (WAL)

Every write is logged before it happens. If Memento crashes, it can recover:

```
WAL entry: "About to save mem_123"
Save memory
Remove WAL entry

(If crash happens between these steps,
 the memory can be recovered on restart)
```

### LRU Cache

Frequently accessed memories are cached in memory for instant retrieval:

```
Recall query 1: Fetch from DB (100ms), cache result
Recall query 2: Fetch from cache (1ms)
Recall query 3: Fetch from cache (1ms)
```

The cache holds 1,000 entries by default.

## Data Flow Example: End to End

Let's trace a complete example:

### Session 1: Day 1

```
User: "Let's use Redis for caching"
      ↓
Auto-capture hook fires
      ↓
Message queued: "Let's use Redis for caching"
      ↓
(30 seconds pass, queue flushed)
      ↓
Redaction: No secrets detected ✓
      ↓
Tagging: [decision, dependency]
      ↓
Chunking: 1 chunk (< 512 tokens)
      ↓
Dedup: No existing memory found ✓
      ↓
Embedding: [0.12, 0.45, -0.67, ..., 0.23]
      ↓
Storage: Saved to ~/.claude-memory/memories/mem_xyz.json
      ↓
ChromaDB: Indexed for fast search
```

### Session 2: Day 8 (New IDE session)

```
User: /recall
      ↓
Context embedded: "Setting up caching strategy"
      ↓
Vector search: Find Redis memory (94% similarity!)
      ↓
Re-ranking: Check recency (7 days old, still recent)
            Check namespace (same project)
            Check tags (matches "caching" topic)
      ↓
Return: "You previously decided on Redis for caching"
      ↓
User reads context, continues working
```

### Session 3: Day 30 (New project)

```
User: /search "caching strategies"
      ↓
Query embedded
      ↓
Vector search: Redis memory matches (semantic relevance)
               Other caching memories also match
      ↓
Keyword search: "caching" keyword found in Redis memory
      ↓
Hybrid blend: 70% vector + 20% keyword + 10% recency
      ↓
Return results: "Redis caching strategy" ranks highest
      ↓
User learns from past experience in new project!
```

## Namespace Isolation

Memento automatically groups memories by project using git folder names:

```
Project A (.git → project-a)
  └─ Memories tagged with namespace: "project-a"

Project B (.git → project-b)
  └─ Memories tagged with namespace: "project-b"

Global memories
  └─ Memories tagged with namespace: "global"
```

When you `/recall`, Memento prioritizes:
1. Current project namespace
2. Global namespace

This keeps concerns separated while allowing global knowledge to be reused.

## Performance Characteristics

Here's what to expect performance-wise:

| Operation | Time | Notes |
|-----------|------|-------|
| Save memory | 50-200ms | Includes embedding calculation |
| Recall (local cache hit) | 1-5ms | Blazing fast |
| Recall (database fetch) | 50-200ms | Still very fast |
| Search 1000 memories | 100-300ms | Vector similarity is efficient |
| Export all memories | 1-10s | Depends on count |

Memento is designed for low latency—you never have to wait for memory operations.

## Security & Privacy

Memento is built with privacy as the default:

**What's stored locally:**
- All memories (JSON files)
- All embeddings (384-dim vectors)
- All metadata (tags, timestamps)

**What leaves your computer:**
- Nothing, by default
- Only if you opt-in to cloud embeddings (OpenAI, Gemini)

**Secrets are handled:**
- Automatically detected and redacted
- API keys, passwords, tokens never stored
- Redaction happens before embedding

Your memories are completely under your control.

## Summary

Memento works by:

1. **Capturing**: Automatically listening to your coding conversations
2. **Processing**: Redacting secrets, tagging, chunking, deduplicating
3. **Embedding**: Converting text to 384-dimensional vectors representing meaning
4. **Storing**: Saving to local JSON files and indexing in ChromaDB
5. **Retrieving**: Using three search modes (vector, keyword, hybrid) to find relevant memories
6. **Recalling**: Showing you past decisions and context when you need them

All of this happens locally, with no external servers, complete privacy, and blazing-fast performance.

Now that you understand the architecture, you're ready to explore the [17 available tools](../reference/tools.md) or dive into [configuration](../guides/configuration.md).
