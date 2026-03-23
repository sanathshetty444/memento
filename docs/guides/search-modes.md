# Search Modes Guide: Vector, Keyword, and Hybrid

## The Three Search Modes

Memento offers three fundamentally different ways to search your memory. Each is optimized for different types of queries and reasoning patterns.

```
┌─────────────────────────────────────────────────────────────┐
│ Vector Search      │ Keyword Search    │ Hybrid Search      │
├────────────────────┼───────────────────┼────────────────────┤
│ Semantic meaning   │ Exact terminology │ Best of both       │
│ Fuzzy matching     │ Precise matching  │ Balanced accuracy  │
│ Context-aware      │ Pattern-focused   │ General purpose    │
└─────────────────────────────────────────────────────────────┘
```

## Vector Search: Semantic Understanding

### What It Does

Vector search converts your query into a mathematical vector (a list of 384 numbers) that represents its **semantic meaning**, not just the words. It then compares your query vector to all stored memory vectors and returns items with the highest **cosine similarity**.

### The Technical Foundation: HNSW Index

Under the hood, Memento uses an **HNSW (Hierarchical Navigable Small World)** index, which is a graph structure that enables fast approximate nearest-neighbor search:

```
Imagine you're searching for memories about "authentication bugs"

Without HNSW (brute force):
  Compare your query vector against ALL 10,000 memories
  Time: O(n) = slow with large stores

With HNSW:
  Navigate a multi-layer graph like a skiplist
  Start at top layer (few entries), descend toward matches
  Time: O(log n) = 100x faster!

The graph looks conceptually like:
  Layer 2: [Entry A] -----> [Entry B]
                      \    /
  Layer 1: [Entry A]-[Entry C]-[Entry D]-[Entry B]
           /          |        |          \
  Layer 0: [Memory vectors, densely connected]
```

Each memory vector is inserted into this graph. New queries use the graph to quickly navigate to nearby vectors, avoiding comparison with distant ones.

### Example: Vector Search in Action

**Your query:** `"How do I handle JWT token expiration?"`

**What happens:**
1. Your query gets embedded: `[0.12, 0.45, -0.23, 0.67, ...]` (384 dimensions)
2. HNSW navigates to nearby vectors
3. Cosine similarity is computed: `similarity = dot_product(query_vec, memory_vec) / (||query|| * ||memory||)`

   Formula: `cos(θ) = (A·B) / (||A|| × ||B||)` where result ranges from -1 to 1
   - `1.0` = identical meaning
   - `0.5` = somewhat related
   - `0.0` = unrelated
   - `-1.0` = opposite meaning

4. Results ranked by similarity (highest first):

```
Match 1: "JWT expiration and renewal logic" (similarity: 0.89)
  From: memory_id_457, created 2026-03-15
  Content: "Implemented token refresh endpoint with exponential backoff..."

Match 2: "Token validation middleware" (similarity: 0.76)
  From: memory_id_234, created 2026-03-10
  Content: "Checks token against blacklist, validates signature..."

Match 3: "OAuth2 flow implementation" (similarity: 0.61)
  From: memory_id_189, created 2026-03-05
  Content: "Added Google OAuth, handles redirect, stores refresh token..."
```

### When to Use Vector Search

**Use vector search when:**
- Your query is conceptual: `"How should I structure my authentication?"`
- You want fuzzy, semantically-related matches
- You're thinking in terms of ideas, not exact keywords
- Your memory contains diverse but related concepts

**Example queries:**
- `"Authentication security best practices"`
- `"How do I handle race conditions?"`
- `"Explain the architecture of this service"`
- `"What's the pattern for database migrations?"`

### Performance Characteristics

- **Speed:** Very fast (~10-50ms for 10K memories with HNSW)
- **Recall:** Excellent for semantic similarity; may miss exact terminology
- **Memory:** HNSW index adds ~10-20% overhead

## Keyword Search: Precise Terminology

### What It Does

Keyword search uses **BM25 scoring** (Best Matching 25), an algorithm originally designed for search engines like Elasticsearch. It:

1. Breaks your query and stored documents into words
2. Scores based on term frequency and importance
3. Returns exact matches or near-exact matches, ranked by relevance

### The Technical Foundation: BM25 Scoring

BM25 balances two competing needs:

**Term Frequency (TF):** How often does a word appear in this document?
- If you search `"JWT"` and a memory mentions it 5 times, it scores higher
- But there's a diminishing return: the 5th mention helps less than the 1st

**Inverse Document Frequency (IDF):** How rare is this word across all memories?
- If you search `"the"`, it appears in everything, so it's less useful
- If you search `"HNSW"`, it's rare, so it's very useful
- Rare matching terms boost the score significantly

**BM25 Formula (simplified):**
```
score = Σ IDF(term) × (TF(term) × (k1 + 1)) / (TF(term) + k1 × (1 - b + b × (doclen / avglen)))

where:
  k1 = 1.2 (term frequency saturation point)
  b = 0.75 (document length normalization)
  IDF(term) = log((N - df(term) + 0.5) / (df(term) + 0.5))
```

In plain English: **Reward documents where query terms appear frequently, but penalize documents that are exceptionally long, and boost rare terms.**

### Example: Keyword Search in Action

**Your query:** `"JWT token expiration"`

**What happens:**
1. Query is split: `["JWT", "token", "expiration"]`
2. Each memory is scanned for these terms
3. BM25 scores computed:

```
Memory 1: "JWT token expiration handling in Node.js"
  - "JWT": appears 3 times, IDF=2.8 (rare) → high contribution
  - "token": appears 2 times, IDF=1.2 (common) → medium contribution
  - "expiration": appears 4 times, IDF=3.1 (rare) → high contribution
  BM25 Score: 28.4

Memory 2: "User authentication with OAuth and JWT"
  - "JWT": appears 1 time, IDF=2.8 → medium contribution
  - "token": appears 1 time, IDF=1.2 → low contribution
  - "expiration": appears 0 times, IDF=3.1 → no contribution
  BM25 Score: 4.0

Memory 3: "Implemented token refresh..." (long document with many words)
  - "JWT": appears 0 times → no score
  - "token": appears 8 times, IDF=1.2 → contribution penalized because doc is long
  - "expiration": appears 0 times → no score
  BM25 Score: 2.1

Results ranked by score:
  1. Memory 1 (28.4)
  2. Memory 2 (4.0)
  3. Memory 3 (2.1)
```

### When to Use Keyword Search

**Use keyword search when:**
- You're looking for specific terminology: `"Implement JWT"`
- You want exact matches, not fuzzy semantic matches
- Your query contains proper nouns or technical terms: `"PostgreSQL migration"`
- You need predictable, explainable results
- You're searching code snippets, file names, or technical details

**Example queries:**
- `"PostgreSQL transactions"`
- `"Docker Compose setup"`
- `"React hooks implementation"`
- `"AWS Lambda environment variables"`

### Performance Characteristics

- **Speed:** Very fast (~5-20ms with inverted index)
- **Recall:** Perfect for exact terminology; may miss conceptual matches
- **Memory:** Minimal overhead; inverted index is compact

## Hybrid Search: The Best of Both Worlds

### What It Does

Hybrid search runs both vector search and keyword search, then blends their results using a weighted formula:

```
hybrid_score = (0.70 × vector_similarity) + (0.30 × normalized_bm25_score)
```

The default weighting is **70% vector, 30% keyword**, optimized for general-purpose retrieval that balances semantics with exact terminology.

### Formula Breakdown

1. **Normalize both scores to 0-1 range:**
   - Vector similarity is already 0-1
   - BM25 is unbounded, so normalize via percentile ranking

2. **Blend with weights:**
   - Vector similarity contributes 70%
   - BM25 contributes 30%

3. **Return merged, deduplicated results:**

### Example: Hybrid Search in Action

**Your query:** `"How do I implement JWT refresh tokens?"`

**Vector search results:**
```
- "JWT token lifecycle" (0.88) ← near-perfect semantic match
- "Refresh token rotation strategy" (0.82)
- "OAuth2 token management" (0.71)
```

**Keyword search results:**
```
- "Implement JWT refresh tokens in Node.js" (BM25: 45.2 → 0.95 normalized)
- "JWT best practices" (BM25: 18.1 → 0.60 normalized)
- "Token rotation patterns" (BM25: 12.4 → 0.40 normalized)
```

**Hybrid blending (70% vector + 30% keyword):**
```
"Implement JWT refresh tokens in Node.js":
  Vector: not in top results, estimated 0.50
  Keyword: 0.95
  Hybrid: (0.70 × 0.50) + (0.30 × 0.95) = 0.64 ← boosted by keyword match!

"JWT token lifecycle":
  Vector: 0.88
  Keyword: 0.45
  Hybrid: (0.70 × 0.88) + (0.30 × 0.45) = 0.751

Final ranking:
  1. "JWT token lifecycle" (0.751) ← semantic similarity wins
  2. "Implement JWT refresh tokens in Node.js" (0.64) ← exact terminology helps
  3. "Refresh token rotation strategy" (0.78) ← strong on both axes
```

### When to Use Hybrid Search

**Use hybrid search when:**
- You don't know whether you want exact terminology or fuzzy semantics
- You're asking complex questions: `"What's the pattern for handling concurrent requests in Node.js?"`
- You want balanced, reliable results
- You're building a general search interface

**Hybrid is the safe default** for most use cases.

## Configuring Search Mode

### In memory_recall

```bash
memento recall "JWT implementation" --searchMode vector
memento recall "JWT implementation" --searchMode keyword
memento recall "JWT implementation" --searchMode hybrid
```

### In memory_search

```bash
memento search "authentication patterns" --searchMode vector
memento search "authentication patterns" --searchMode keyword
memento search "authentication patterns" --searchMode hybrid
```

### Default Configuration

In `~/.claude-memory/config.json`:

```json
{
  "search": {
    "defaultMode": "hybrid",
    "vectorWeight": 0.70,
    "keywordWeight": 0.30,
    "limit": 10
  }
}
```

## Quick Decision Tree

Use this chart to pick the right search mode:

```
What are you searching for?

├─ "Conceptual or fuzzy ideas?"
│  └─ Use VECTOR
│     Examples: "architecture patterns", "best practices", "how should I..."
│
├─ "Specific technical terms?"
│  └─ Use KEYWORD
│     Examples: "PostgreSQL transaction", "JWT implementation", "Docker Compose"
│
└─ "Not sure / general query?"
   └─ Use HYBRID
      Examples: "How do I improve performance?", "Debugging database issues"
```

## Performance Comparison

| Metric | Vector | Keyword | Hybrid |
|--------|--------|---------|--------|
| Speed | 10-50ms | 5-20ms | 15-70ms (both + blend) |
| Semantic accuracy | Excellent | Poor | Excellent |
| Exact match accuracy | Fair | Excellent | Excellent |
| Recall (finds relevant) | High | Medium | High |
| Precision (not noisy) | High | Very high | High |
| Index size | +15% | +5% | +20% |
| Best for | Ideas, concepts | Terminology | Everything |

## Real-World Scenario

**You're debugging a permission issue in your app:**

1. **Try vector:** `memory recall "permission denied errors"` (searchMode: vector)
   - Gets back semantic matches: "authorization", "access control", "roles"
   - Good for understanding patterns, but might miss the specific error message

2. **Try keyword:** `memory recall "permission denied errors"` (searchMode: keyword)
   - Gets back exact matches: "PermissionError: Access denied", "403 Forbidden"
   - Precise, but might miss related concepts

3. **Use hybrid:** `memory recall "permission denied errors"` (searchMode: hybrid)
   - Gets back both semantic AND exact matches, ranked intelligently
   - Perfect! Finds the specific error AND related patterns

---

Memento's three search modes let you adapt to how you think. Start with hybrid for reliability, then use vector for big-picture questions and keyword for precise technical lookups.
