# Memento Benchmarks

Performance and relevance benchmarks for the Memento memory system.

## Prerequisites

- Node.js >= 20
- Memento built (`npm run build`)
- Memento server running (`memento serve` or `npx memento serve`)

## Running Benchmarks

```bash
# Start the server in one terminal
npx memento serve

# Run benchmarks in another terminal
npx tsx benchmarks/run.ts
```

You can override the server URL with the `MEMENTO_URL` environment variable:

```bash
MEMENTO_URL=http://127.0.0.1:9000 npx tsx benchmarks/run.ts
```

## What Gets Benchmarked

### Ingestion

Measures time to save N memories (10, 100, 1000) sequentially via the HTTP API. Reports total time, average per operation, and operations per second.

### Search

Pre-populates N memories, then runs 5 search queries. Measures total search time, average latency per query, and queries per second.

### Relevance

Seeds 5 known facts plus 50 noise memories. For each fact, queries using a natural-language question and checks whether the correct result appears in the top 3 results. Reports a hit rate percentage.

## MemoryBench Provider Interface

The `MementoProvider` class in `memento-provider.ts` implements the `MemoryBenchProvider` interface, which can be used by any compatible benchmark harness:

```typescript
export interface MemoryBenchProvider {
  addMemory(content: string, metadata?: { tags?: string[] }): Promise<string>;
  searchMemory(
    query: string,
    limit?: number,
  ): Promise<Array<{ content: string; score: number; id: string }>>;
  getProfile(): Promise<{ totalMemories: number; topTags: string[] }>;
  reset(): Promise<void>;
}
```

### Method Mapping

| Method         | HTTP Endpoint                  | Description                              |
|----------------|-------------------------------|------------------------------------------|
| `addMemory`    | `POST /api/save`              | Save a memory with optional tags         |
| `searchMemory` | `POST /api/recall`            | Semantic search, returns scored results  |
| `getProfile`   | `GET /api/list` (aggregated)  | Count all memories, compute top tags     |
| `reset`        | `GET /api/list` + `DELETE /api/:id` | Remove all memories                |

## Notes

- The first run may be slower due to embedding model download (~30MB for all-MiniLM-L6-v2).
- Benchmarks use a `benchmark` tag on all test data for easy identification.
- The `reset()` method deletes all memories in the store, so do not run benchmarks against a production instance.
