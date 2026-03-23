# Search Internals: HNSW, BM25, and Hybrid Scoring

Memento implements sophisticated search using three algorithms: HNSW for vector similarity, BM25 for keyword matching, and hybrid scoring that combines both. This document explains the internals at both conceptual and technical levels.

---

## HNSW Algorithm (Hierarchical Navigable Small World)

**Purpose**: Efficiently find semantically similar memories by approximate nearest neighbor search over embedding vectors.

### Layman's Explanation

Imagine a city with 10,000 buildings (memories), each with geographic coordinates. You want to find the 10 closest buildings to your current location.

**Naive Approach**: Compare your location to all 10,000 buildings (O(n) time, slow)

**HNSW Approach**:
1. Create a hierarchical map (like Google Maps zoom levels)
2. At zoom level 0 (zoomed out): Choose 5 distant landmarks
3. Find the closest landmark to you
4. At zoom level 1 (zoomed in): Choose 15 buildings near that landmark
5. Find the closest building in that cluster
6. At zoom level 2 (most zoomed in): Refine to 10 specific buildings
7. Done! Found your 10 closest buildings in ~25 comparisons instead of 10,000

**Vector Space Analogy**:
- Each memory has a 384-dimensional vector (like coordinates in hyperspace)
- Distance between vectors = semantic similarity (small distance = similar meaning)
- HNSW builds a hierarchical graph where edges point to nearby vectors
- Searching = "navigate the graph" from entry point to nearest neighbors

### Technical Details

#### Parameters

| Parameter | Default | Meaning |
|-----------|---------|---------|
| **M** | 16 | Max connections per node (higher = more connections, slower build, faster search) |
| **efConstruction** | 200 | Search scope during index building (higher = better quality, slower builds) |
| **efSearch** | 50 | Search scope during query (higher = better recall, slower queries) |
| **maxM** | M | Max number of neighbors at level 0 |
| **maxM0** | M*2 | Max number of neighbors at higher levels |
| **levelMultiplier** | 1/ln(2) | ~1.443, controls how many levels in hierarchy |

#### Layer Structure

HNSW builds a multi-level hierarchy (like skip lists):

```
Level 2:    A ─────── B              (top level, sparse)
            │         │
            │         │
Level 1:    A ─ C ─ B ─ D            (middle level)
            │ \ / \ / │
            │  X   X  │
Level 0:    A─C─E─B─F─D─G─H─I─J     (bottom level, dense)
            └─────────────────────────

Search for query vector Q:
1. Start at Level 2, point A: distance(Q, A) = 5.2
   - Check neighbors of A: B (distance=4.8)
   - Check neighbors of B: D (distance=3.1)
   - No closer neighbors at this level

2. Drop to Level 1, enter at D (or last best point)
   - Check neighbors: B, C, F
   - F is closest: distance(Q, F) = 2.1

3. Drop to Level 0 (complete data)
   - Explore around F: E, G
   - E is closest: distance(Q, E) = 1.8
   - Return top-k similar vectors
```

#### Distance Metrics

**Cosine Similarity** (used by default):
```
similarity(A, B) = (A · B) / (||A|| * ||B||)

Range: [-1, 1] where 1 = identical, 0 = orthogonal, -1 = opposite
Example:
  Vector A: [0.5, -0.2, 0.3, ...]  (all-MiniLM embedding of "login handler")
  Vector B: [0.48, -0.19, 0.31, ...] (all-MiniLM embedding of "authenticate user")
  Similarity: 0.96 (very similar, different wording)
```

**Euclidean Distance** (alternative):
```
distance(A, B) = sqrt(sum((A[i] - B[i])^2))

Pros: Exact geometric distance
Cons: Sensitive to dimensionality, slower to compute
```

We use cosine similarity because:
- Direction matters more than magnitude for text embeddings
- More stable across vector magnitudes (all-MiniLM normalizes to unit norm)
- Proven better for NLP tasks

### Building the HNSW Index

```typescript
// Simplified pseudocode
class HNSW {
  nodes: Map<string, Node> = new Map();
  layers: Map<number, Set<string>> = new Map(); // level → node IDs

  build(vectors: Vector[]): void {
    for (const vector of vectors) {
      const nodeId = generateId();
      const level = this.randomLevel(); // exponential decay: mostly level 0

      let entryPoint = this.getEntryPoint(); // Start at top of graph

      // Insert at each level
      for (let lc = level; lc >= 0; lc--) {
        const searchScope = (lc === level) ? 1 : this.efConstruction;
        const candidates = this.searchLevel(vector, entryPoint, searchScope, lc);
        const m = (lc === 0) ? this.maxM0 : this.maxM;
        const neighbors = this.selectNeighbors(candidates, m);

        this.addNode(nodeId, neighbors, lc);
        entryPoint = nodeId;
      }
    }
  }

  randomLevel(): number {
    // Exponential decay: most nodes at level 0
    // P(level >= k) = (1 - 1/e)^k
    let level = 0;
    while (Math.random() < 0.5 && level < MAX_LEVEL) {
      level++;
    }
    return level;
  }
}
```

### Searching HNSW

```typescript
search(query: Vector, k: number = 10, efSearch: number = 50): SearchResult[] {
  let entryPoint = this.getEntryPoint();
  let nearestNode = entryPoint;

  // Navigate through layers (top to bottom)
  for (let lc = entryPoint.level; lc > 0; lc--) {
    nearestNode = this.searchLevel(query, nearestNode, 1, lc)[0];
  }

  // Detailed search at level 0 with scope efSearch
  const candidates = this.searchLevel(query, nearestNode, efSearch, 0);

  // Return top-k by distance
  return candidates
    .map(id => ({
      id,
      distance: cosineSimilarity(query, this.getVector(id))
    }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, k);
}

searchLevel(query: Vector, entryPoint: string, scope: number, level: number) {
  const candidates = new PriorityQueue(); // min-heap by distance
  const visited = new Set([entryPoint]);
  candidates.add(entryPoint, distance(query, entryPoint));

  while (candidates.size() > 0) {
    const current = candidates.pop();

    if (distance(query, current) > distance(query, candidates.peek())) {
      break; // Explored enough
    }

    for (const neighbor of this.getNeighbors(current, level)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        const d = distance(query, neighbor);

        if (d < candidates.maxDistance() || candidates.size() < scope) {
          candidates.add(neighbor, d);

          // Prune: keep only closest scope items
          if (candidates.size() > scope) {
            candidates.pop(); // Remove farthest
          }
        }
      }
    }
  }

  return candidates.toArray();
}
```

### Performance Characteristics

| Operation | Time Complexity | Space | Notes |
|-----------|-----------------|-------|-------|
| Build index | O(n log n) | O(n * M) | M ≈ 16 connections/node |
| Search k-neighbors | O(log n) | O(efSearch) | ~50 distance computations |
| Insert new vector | O(log n) | O(M) | Incremental update |
| Delete vector | O(log n) | — | Graph repair required |

**Latency Benchmarks** (for 100k memories with 384-dim vectors):
- Build: ~30 seconds (parallel)
- Single search: 2-5ms
- Batch search (10 queries): 15-20ms

### Tuning Parameters

**Faster Searches, Slower Builds** (optimize for query performance):
```json
{"hnsw": {"M": 16, "efConstruction": 400, "efSearch": 100}}
```

**Balanced**:
```json
{"hnsw": {"M": 16, "efConstruction": 200, "efSearch": 50}}
```

**Smaller Memory Footprint, Slightly Slower Searches**:
```json
{"hnsw": {"M": 8, "efConstruction": 100, "efSearch": 30}}
```

---

## BM25 Algorithm (Okapi BM25)

**Purpose**: Rank documents based on keyword frequency, handling natural language term weighting.

### Formula

```
BM25(D, Q) = Σ over terms in Q: IDF(term) * (f(term, D) * (k1 + 1)) / (f(term, D) + k1 * (1 - b + b * (|D| / avgdl)))

Where:
  D = document (memory)
  Q = query
  IDF(term) = log((N - df(term) + 0.5) / (df(term) + 0.5))
  f(term, D) = term frequency in document
  |D| = length of document in words
  avgdl = average document length in corpus
  k1 = 1.2 (controls term frequency saturation)
  b = 0.75 (controls length normalization)
```

### Step-by-Step Example

**Corpus**: 3 memories
- Doc 1: "Redis caching improved performance"
- Doc 2: "Database performance tuning" (8 words avg)
- Doc 3: "Redis cache layer for sessions"

**Query**: "redis performance"

**Step 1: Calculate IDF for each query term**

```
N = 3 total documents
term "redis": appears in 2 docs (Doc 1, Doc 3)
  IDF = log((3 - 2 + 0.5) / (2 + 0.5)) = log(1.5 / 2.5) = log(0.6) = -0.511

term "performance": appears in 2 docs (Doc 1, Doc 2)
  IDF = log((3 - 2 + 0.5) / (2 + 0.5)) = log(0.6) = -0.511
```

(Negative IDF? This occurs when term is very common. It's normalized in practice.)

**Step 2: Calculate TF for each document**

```
Doc 1: "Redis caching improved performance" (4 words)
  f("redis", Doc1) = 1 / 4 = 0.25
  f("performance", Doc1) = 1 / 4 = 0.25

Doc 2: "Database performance tuning" (3 words)
  f("redis", Doc2) = 0 (not in document)
  f("performance", Doc2) = 1 / 3 = 0.33

Doc 3: "Redis cache layer for sessions" (5 words)
  f("redis", Doc3) = 1 / 5 = 0.20
  f("performance", Doc3) = 0 (not in document)
```

**Step 3: Apply BM25 formula with length normalization**

```
k1 = 1.2, b = 0.75, avgdl = 4 (average of 4, 3, 5)

Doc 1 BM25:
  term "redis": 1.0 * (0.25 * 2.2) / (0.25 + 1.2*(1 - 0.75 + 0.75*4/4))
              = 1.0 * 0.55 / (0.25 + 1.2) = 0.55 / 1.45 = 0.379
  term "performance": 1.0 * 0.55 / 1.45 = 0.379
  Total: 0.758

Doc 2 BM25:
  term "redis": 0 (not in doc)
  term "performance": 1.0 * (0.33 * 2.2) / (0.33 + 1.2*(...))
                    = 0.433
  Total: 0.433

Doc 3 BM25:
  term "redis": 1.0 * (0.20 * 2.2) / (0.20 + 1.2*(...))
              = 0.352
  term "performance": 0 (not in doc)
  Total: 0.352

Ranking:
  1. Doc 1: 0.758 ✓ (has both query terms)
  2. Doc 2: 0.433 (has one query term)
  3. Doc 3: 0.352 (has one query term)
```

### Key Parameters

| Parameter | Value | Meaning |
|-----------|-------|---------|
| **k1** | 1.2 | Controls term frequency saturation (diminishing returns) |
| **b** | 0.75 | Controls impact of document length (0=ignore, 1=full impact) |

**k1 Tuning**:
- k1=0: TF doesn't matter, only presence/absence
- k1=1.2 (default): Balanced, good for most texts
- k1=2.0: TF matters more, favors longer docs with high term frequency

**b Tuning**:
- b=0: Ignore document length (all docs treated equally)
- b=0.75 (default): Longer docs penalized somewhat
- b=1.0: Longer docs penalized fully by their length

### Implementation

```typescript
interface BM25Index {
  documentFrequency: Map<string, number>;  // term → count of docs containing it
  termFrequency: Map<string, Map<string, number>>; // term → doc → frequency
  docLength: Map<string, number>;  // memory ID → word count
  avgDocLength: number;
  totalDocs: number;
  k1: number;
  b: number;
}

function buildBM25Index(memories: Memory[]): BM25Index {
  const index: BM25Index = {
    documentFrequency: new Map(),
    termFrequency: new Map(),
    docLength: new Map(),
    avgDocLength: 0,
    totalDocs: memories.length,
    k1: 1.2,
    b: 0.75
  };

  let totalLength = 0;

  for (const memory of memories) {
    const tokens = tokenize(memory.text); // split into words, lowercase
    const docId = memory.id;

    index.docLength.set(docId, tokens.length);
    totalLength += tokens.length;

    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      // Document frequency
      index.documentFrequency.set(
        term,
        (index.documentFrequency.get(term) ?? 0) + 1
      );
    }

    // Term frequency per doc
    for (const term of tokens) {
      if (!index.termFrequency.has(term)) {
        index.termFrequency.set(term, new Map());
      }
      const termMap = index.termFrequency.get(term)!;
      termMap.set(docId, (termMap.get(docId) ?? 0) + 1);
    }
  }

  index.avgDocLength = totalLength / memories.length;
  return index;
}

function scoreBM25(query: string, index: BM25Index): Map<string, number> {
  const scores = new Map<string, number>();
  const queryTerms = tokenize(query);

  for (const memoryId of Array.from(index.docLength.keys())) {
    let score = 0;

    for (const term of queryTerms) {
      const idf = calculateIDF(term, index);
      const tf = index.termFrequency.get(term)?.get(memoryId) ?? 0;
      const docLength = index.docLength.get(memoryId)!;

      const numerator = tf * (index.k1 + 1);
      const denominator =
        tf +
        index.k1 *
          (1 - index.b + index.b * (docLength / index.avgDocLength));

      score += idf * (numerator / denominator);
    }

    scores.set(memoryId, score);
  }

  return scores;
}

function calculateIDF(term: string, index: BM25Index): number {
  const df = index.documentFrequency.get(term) ?? 0;
  return Math.log((index.totalDocs - df + 0.5) / (df + 0.5));
}
```

### BM25 vs Vector Search

| Aspect | BM25 | Vector (HNSW) |
|--------|------|---------------|
| **What it finds** | Exact keyword matches | Semantic meaning |
| **Query** | "redis performance" | "redis performance" → vector |
| **Finds** | Docs with both words | Docs about caching, even if words differ |
| **Strength** | Technical jargon, code keywords | Paraphrased meaning, synonyms |
| **Example** | Finds "Redis" + "perf" | Finds "caching", "fast", "response times" |

---

## Hybrid Search: Combining HNSW + BM25

**Purpose**: Leverage strengths of both algorithms for best recall and relevance.

### Scoring Normalization

Both algorithms produce scores on different scales:
- **Cosine Similarity**: [0, 1] range
- **BM25**: [0, ∞) unbounded

**Normalization Strategy**:

```typescript
// Normalize BM25 scores to [0, 1] range
function normalizeBM25(scores: Map<string, number>): Map<string, number> {
  const values = Array.from(scores.values());
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  const normalized = new Map<string, number>();
  for (const [docId, score] of scores) {
    normalized.set(docId, (score - min) / range);
  }
  return normalized;
}

// Cosine similarity already in [0, 1]
function normalizeVector(scores: Map<string, number>): Map<string, number> {
  return scores; // Already normalized
}
```

### Weighted Combination

**Default weights**:
- Vector similarity: 70% (semantic understanding)
- BM25: 30% (keyword precision)

```typescript
function hybridScore(
  vectorScores: Map<string, number>,
  bm25Scores: Map<string, number>,
  vectorWeight: number = 0.7,
  bm25Weight: number = 0.3
): Map<string, number> {
  const normalized_vector = normalizeVector(vectorScores);
  const normalized_bm25 = normalizeBM25(bm25Scores);

  const hybrid = new Map<string, number>();

  // Combine scores for all documents
  const allDocs = new Set([
    ...normalized_vector.keys(),
    ...normalized_bm25.keys()
  ]);

  for (const docId of allDocs) {
    const v_score = normalized_vector.get(docId) ?? 0;
    const b_score = normalized_bm25.get(docId) ?? 0;

    hybrid.set(docId, vectorWeight * v_score + bm25Weight * b_score);
  }

  return hybrid;
}
```

### Example: Hybrid Search

**Query**: "how to optimize redis caching"

**Vector Search** (HNSW):
- "redis caching for sessions" — cosine=0.89
- "cache invalidation strategy" — cosine=0.76
- "performance improvement tips" — cosine=0.62

**BM25 Search**:
- "redis caching for sessions" — BM25=8.2
- "redis configuration guide" — BM25=7.1
- "cache invalidation strategy" — BM25=3.5

**Normalize**:
- BM25 max=8.2, min=3.5, range=4.7
  - "redis caching for sessions" → (8.2-3.5)/4.7 = 1.0
  - "redis configuration guide" → (7.1-3.5)/4.7 = 0.77
  - "cache invalidation strategy" → (3.5-3.5)/4.7 = 0.0

**Hybrid Score** (70% vector, 30% BM25):
```
"redis caching for sessions":
  0.7 * 0.89 + 0.3 * 1.0 = 0.623 + 0.3 = 0.923 ✓ #1

"cache invalidation strategy":
  0.7 * 0.76 + 0.3 * 0.0 = 0.532 + 0 = 0.532 ✓ #2

"performance improvement tips":
  0.7 * 0.62 + 0.3 * 0 = 0.434 ✓ #3

"redis configuration guide":
  0.7 * 0 + 0.3 * 0.77 = 0 + 0.231 = 0.231
```

### Weight Tuning

**High Vector Weight (90% vector, 10% BM25)**: Use when semantic understanding matters most
```json
{"search": {"vectorWeight": 0.9, "bm25Weight": 0.1}}
```
Ideal for: Conceptual questions, paraphrased queries, finding related work

**Balanced (70% vector, 30% BM25)**: Default, good for most use cases
```json
{"search": {"vectorWeight": 0.7, "bm25Weight": 0.3}}
```
Ideal for: General code/documentation search, mixed conceptual + keyword queries

**High BM25 Weight (40% vector, 60% BM25)**: Use when exact keywords matter
```json
{"search": {"vectorWeight": 0.4, "bm25Weight": 0.6}}
```
Ideal for: Function names, specific technical terms, precision-focused search

---

## Performance and Benchmarking

### Latency Measurements

**Corpus**: 10,000 memories with 384-dim vectors, BM25 index built

| Operation | Latency | Notes |
|-----------|---------|-------|
| Vector search (k=10) | 2-5ms | HNSW with efSearch=50 |
| BM25 search (k=10) | 1-3ms | In-memory BM25 index |
| Hybrid search (k=10) | 4-8ms | Vector + BM25 combined |
| Hybrid with reranking | 8-15ms | LLM reranking enabled |

### Memory Usage

| Component | Size (10k memories) |
|-----------|-------------------|
| HNSW graph (M=16) | ~50MB (16 * 4 bytes per node) |
| BM25 index | ~8MB (term → docid map) |
| Vectors cache | ~15MB (384 * 4 bytes each) |
| Total | ~73MB |

### Scaling Characteristics

| Metric | Linear | O(log n) | O(n) |
|--------|--------|----------|------|
| Index build | — | HNSW | BM25 |
| Query latency | — | HNSW | BM25 |
| Memory | Vectors | HNSW graph | BM25 index |

For 1M memories:
- HNSW build: ~5 minutes (parallel)
- HNSW search: ~3-5ms (unchanged)
- BM25 search: ~10-20ms (grows slightly)

---

## Advanced Topics

### Query Expansion

Before searching, expand user query with synonyms:
```
Query: "auth handler"
Expanded: ["auth", "handler", "authentication", "login", "credential check"]
```

### Multi-field Search

BM25 can search across multiple fields with weights:
```
Score = 3.0 * BM25(title) + 1.5 * BM25(tags) + 1.0 * BM25(body)
```

### Personalization

Re-weight results by user profile:
```
FinalScore = hybridScore * userProfile.affinity[entity]
```

Example: User who works on auth code gets higher scores for authentication-related memories.
