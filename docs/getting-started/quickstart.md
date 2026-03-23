# Quickstart: 5 Minutes to Persistent Memory

In this guide, you'll install Memento and experience its core workflow in about 5 minutes. By the end, you'll understand how to capture decisions, recall context across sessions, and search your entire coding history.

## The Scenario

You're working on a React authentication system. You discover an important architectural pattern, close your IDE, and come back a week later. Normally, you'd spend 15 minutes re-reading your code to remember why you made that design choice. With Memento, you'll have that context instantly.

## Step 1: Install Memento (1 minute)

Open your terminal and run:

```bash
npx memento-memory setup
```

You'll see:
```
✓ Detecting IDE... Claude Code
✓ Creating ~/.claude-memory directory
✓ Initializing local embeddings (all-MiniLM-L6-v2)
✓ Setting up ChromaDB database
✓ Registering with Claude Code
✓ Setup complete!
```

That's it. Memento is now running and will auto-capture memories during your session.

## Step 2: Start Coding and Let Auto-Capture Work (1 minute)

Open your IDE (Claude Code, Cursor, Windsurf, or OpenCode) and start a new conversation about your project:

```
User: Help me implement JWT-based authentication for a React app
```

Behind the scenes, Memento is automatically:
1. Listening to your conversation
2. Extracting important concepts (JWT, authentication, React patterns)
3. Redacting sensitive info (API keys, passwords)
4. Converting your words into embeddings (a 384-dimensional vector representation)
5. Storing everything in local JSON files

You don't need to do anything. Auto-capture is enabled by default.

## Step 3: Save an Explicit Memory (1 minute)

During your session, you discover a critical architectural insight. You want to remember this forever. Use the `/remember` slash command:

```
/remember JWT strategy: We're using HS256 symmetric keys for tokens because the backend validates all requests. This avoids the complexity of RS256 public key distribution while keeping tokens self-contained. Session duration: 1 hour, refresh token: 7 days.
```

Memento displays:

```
✓ Memory saved
  ID: mem_1e4c2f8b
  Namespace: my-auth-app (auto-detected from git)
  Tags: [decision, architecture, authentication]
  Text: "JWT strategy: We're using HS256..."
  Stored at: ~/.claude-memory/memories/mem_1e4c2f8b.json
```

This memory is now permanently stored and will be recalled in future sessions.

## Step 4: Close IDE and Return Later

You finish your work and close the IDE. Your memories are safe in `~/.claude-memory/`. A week passes.

## Step 5: Recall Context in New Session (1 minute)

You open Claude Code again and start a new conversation about the same project. Use the `/recall` slash command:

```
/recall
```

Memento analyzes the current conversation context and automatically finds relevant memories:

```
📚 Recalling context for project: my-auth-app

[Decision] JWT strategy (confidence: 98%)
> We're using HS256 symmetric keys because the backend validates all requests...

[Architecture] Token lifecycle design (confidence: 94%)
> Session tokens are short-lived (1 hour) with 7-day refresh tokens...

[Code Pattern] Token verification middleware (confidence: 87%)
> Middleware checks: expiration, signature, claims...

Found 7 relevant memories. 2 updated recently.
```

Now you have full context of your previous decisions without re-reading code!

## Step 6: Search Across All Projects (1 minute)

Let's say you're starting a new project and want to find how you've handled authentication before. Search globally:

```
/search authentication patterns
```

Memento searches across your entire coding history:

```
🔍 Searching: "authentication patterns"

Results (3 search modes combined):

1. JWT strategy (my-auth-app) [98% match]
   Decision made 7 days ago
   Keywords: JWT, HS256, tokens

2. OAuth2 with GitHub (my-portfolio) [92% match]
   Code pattern found 3 weeks ago
   Keywords: OAuth, third-party auth

3. Session-based auth (legacy-cms) [84% match]
   Architecture note from 2 months ago
   Keywords: sessions, cookies, CSRF

Search mode: hybrid (85% vector, 15% keyword matching)
```

Now you can copy patterns from your own history into new projects!

## What Just Happened? Behind the Scenes

Let's trace through the entire flow:

### The Auto-Capture Pipeline

When you type in your IDE, Memento runs this pipeline:

```
Your conversation
      ↓
[Hook] MCP tool executed → message captured
      ↓
[Queue] Batch messages (wait 30 seconds for more)
      ↓
[Redaction] Remove API keys, passwords, emails
      ↓
[Tagging] Add semantic tags (decision, code, architecture, etc.)
      ↓
[Chunking] Split long text into 512-token chunks
      ↓
[Deduplication] Compare with existing memories, skip if duplicate
      ↓
[Embedding] Convert text → 384-dimensional vector
      ↓
[Storage] Save to ~/.claude-memory/memories/
      ↓
[Index] Add to ChromaDB for fast searching
```

Each step is automatic and happens in the background.

### The Recall Pipeline

When you use `/recall`, here's what happens:

```
Current conversation context
      ↓
[Embedding] Convert to 384-dim vector (same as memories)
      ↓
[Vector Search] Find 20 nearest memories in semantic space
      ↓
[Re-ranking] Score by recency and relevance
      ↓
[Namespace Filter] Prioritize current project, include global
      ↓
[Formatting] Present top 5-10 memories with confidence scores
      ↓
[Display] Show in chat with clickable references
```

### The Search Pipeline

When you use `/search <query>`, Memento uses three search modes:

**1. Vector Search (70% weight by default)**
- Converts your query to a 384-dimensional embedding
- Finds memories with highest semantic similarity
- Catches meaning-based matches: "JWT" matches "token strategies"

**2. Keyword Search (20% weight)**
- Splits query into words: ["authentication", "patterns"]
- Finds memories containing these exact words
- Fast and precise for specific terms

**3. Hybrid Search (10% weight)**
- Combines both approaches
- Best for mixed queries: "Show me React auth examples"

The final results blend all three modes, with scores combined:

```
Memory A (all three modes match): 70% + 20% + 10% = 100% (top result!)
Memory B (vector + keyword match):  70% + 20% + 0% = 90%
Memory C (only keyword match):      0% + 20% + 0% = 20%
```

## The Storage Model

Everything is stored locally as JSON. Here's what one memory looks like:

```json
{
  "id": "mem_1e4c2f8b",
  "namespace": "my-auth-app",
  "content": "JWT strategy: We're using HS256 symmetric keys...",
  "embedding": [0.234, -0.156, 0.892, ..., 0.045],
  "tags": ["decision", "architecture", "authentication"],
  "createdAt": "2026-03-16T10:30:00Z",
  "updatedAt": "2026-03-16T10:30:00Z",
  "source": "user",
  "confidence": 1.0,
  "tokens": 45
}
```

**What each field means:**

- `id`: Unique identifier
- `namespace`: Project name (auto-detected from git folder)
- `content`: The actual memory text
- `embedding`: 384 floating-point numbers representing the meaning
- `tags`: Semantic categories (auto-generated or user-specified)
- `createdAt/updatedAt`: Timestamps for sorting
- `source`: "user" (manually saved), "auto-capture" (automatic), or "system"
- `confidence`: How sure Memento is about this memory (0-1 scale)
- `tokens`: Word count estimate

All memories are stored at `~/.claude-memory/memories/` in separate JSON files, indexed by ChromaDB for instant retrieval.

## The Three Search Modes Explained

### Vector Search (Semantic)

**When to use:** Finding conceptually similar memories

```bash
/search "How do I structure error handling in Express?"
```

Vector search understands that your query is about architecture patterns, even if it doesn't match keywords exactly. It will find memories about:
- Error handling strategies
- Middleware patterns
- Validation approaches
- Request/response wrapping

**Example matching:**
```
Query embedding: [0.45, -0.12, 0.78, ...]
Memory A embedding: [0.44, -0.13, 0.79, ...]  ← Very close! 98% match
Memory B embedding: [0.12, 0.45, -0.60, ...] ← Far away. 34% match
```

### Keyword Search (Precise)

**When to use:** Finding memories with specific terms

```bash
/search "Express middleware authentication"
```

Keyword search finds memories containing "Express", "middleware", or "authentication". It's fast and works offline (no embeddings needed).

**Example matching:**
```
Query: ["express", "middleware", "authentication"]
Memory A: Contains all 3 words → 100% match
Memory B: Contains 2 words → 67% match
Memory C: Contains 0 words → 0% match
```

### Hybrid Search (Both)

**When to use:** Best general-purpose search

```bash
/search everything
```

Hybrid combines semantic understanding with keyword precision. Default scoring:
- 70% vector search
- 20% keyword search
- 10% recency bonus

This is the most robust and gives the best real-world results.

## Key Concepts You Should Know

### Namespaces

Memento automatically groups memories by project using git folder name. This keeps auth memories separate from your blog memories, which stay separate from your e-commerce memories.

```
~/.claude-memory/
├── memories/
│   ├── mem_1e4c2f8b.json (my-auth-app)
│   ├── mem_2f5c3a9d.json (my-blog)
│   ├── mem_4g8d5b1e.json (global)
│   └── ...
└── config.json
```

When you `/recall`, it prioritizes your current project's memories, then includes global ones.

### Tags

Every memory gets semantic tags automatically:
- `decision`: Architectural choices
- `code`: Code patterns and examples
- `architecture`: System design
- `bug`: Issues and fixes
- `dependency`: External libraries used
- `config`: Configuration approaches
- `conversation`: General chat context

Use tags to filter searches:

```bash
/search --tags decision,architecture "authentication"
```

### Embeddings

Memento converts text to 384-dimensional vectors using all-MiniLM-L6-v2, a free, open-source model that runs locally. You don't send anything to the cloud.

Each dimension represents something about the meaning:
- Dimensions 1-50: Technical concepts
- Dimensions 51-150: Code patterns
- Dimensions 151-250: Architecture decisions
- Dimensions 251-384: Context and relationships

Two memories with similar embeddings have similar meaning, enabling semantic search.

## Troubleshooting This Quick Start

### "I don't see /remember command"

Make sure Memento is registered with your IDE:
```bash
npx memento-memory status
```

Should show your IDE. If not:
```bash
npx memento-memory setup --ide claude-code --force
```

### "Auto-capture isn't working"

Check if the MCP server started:
```bash
ps aux | grep memento
```

You should see a process. If not, restart your IDE.

### "Search results don't seem relevant"

Try using `/search --mode vector` to debug. You can also:
1. Check your namespace: `/recall` with `--namespace global` to search everywhere
2. Export your memories to inspect them: `npx memento-memory export --format json`

## Next Steps

You're now ready to:

1. **Learn the architecture** in [How It Works](./how-it-works.md) to understand vector databases, embeddings, and semantic search
2. **Explore all 17 tools** in the [Tools Reference](../reference/tools.md)
3. **Configure advanced features** like Neo4j storage or custom embedding models
4. **Set up automated exports** to back up your memories

Congratulations on setting up persistent memory for your AI coding! 🎉
