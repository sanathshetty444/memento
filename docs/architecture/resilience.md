# Resilience Patterns: Circuit Breaker, WAL, and LRU Cache

Memento uses three complementary resilience patterns to handle failures gracefully, ensure data consistency, and optimize for repeated access patterns.

---

## Circuit Breaker Pattern (circuit-breaker.ts)

**Purpose**: Prevent cascading failures when external services (storage, embeddings APIs) are slow or unavailable.

### State Machine

```
                    ┌──────────────┐
                    │   CLOSED     │ (normal operation)
                    │ (accepting)  │
                    └───────┬──────┘
                            │
                     failure_threshold
                     exceeded (5 failures
                     in 10s window)
                            │
                    ┌───────▼──────────┐
                    │     OPEN         │ (rejecting)
                    │ (fail fast)      │
                    └───────┬──────────┘
                            │
                     timeout_duration
                     elapsed (30s)
                            │
                    ┌───────▼──────────┐
                    │  HALF-OPEN       │ (testing)
                    │ (probe request)  │
                    └───┬──────────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
     success            failure (retry after 30s)
          │                           │
          ▼                           ▼
        CLOSED                      OPEN
```

### Configuration

```json
{
  "resilience": {
    "circuitBreaker": {
      "enabled": true,
      "failureThreshold": 5,
      "failureWindow": "10s",
      "successThreshold": 2,
      "timeout": "30s",
      "halfOpenRequests": 1,
      "onStateChange": "log"
    }
  }
}
```

### States and Transitions

#### CLOSED State (Normal Operation)

- **Behavior**: All requests pass through to underlying service
- **Tracking**: Records success/failure count in rolling window (10s)
- **Transition to OPEN**: 5+ failures in 10-second window
- **Recovery**: N/A

**Example**:
```
Timeline (seconds):
0s   - Request 1 SUCCESS (count: 1 success)
2s   - Request 2 SUCCESS (count: 2 success)
4s   - Request 3 FAIL (count: 2 success, 1 fail)
6s   - Request 4 FAIL (count: 2 success, 2 fail)
8s   - Request 5 FAIL (count: 2 success, 3 fail)
10s  - Request 6 FAIL (count: 2 success, 4 fail)
11s  - Request 7 FAIL (count: 2 success, 5 fail) → THRESHOLD MET
       → Transition to OPEN, reject further requests
```

#### OPEN State (Failing Fast)

- **Behavior**: All requests immediately rejected with CircuitBreakerError
- **Cost**: Prevents resource exhaustion from hammering failing service
- **Latency**: <1ms (instant rejection vs. timeout wait)
- **Visibility**: Metrics show circuit is open (alerts/dashboards)
- **Transition to HALF-OPEN**: After timeout duration (30s by default)

**Error Behavior**:
```typescript
if (circuitBreaker.state === 'open') {
  throw new CircuitBreakerError(
    'Circuit breaker is open. Service temporarily unavailable. ' +
    'Retrying in 30s. Cause: ' + circuitBreaker.lastError.message
  );
}
```

**Example Usage**:
```typescript
try {
  const result = await circuitBreaker.execute(
    () => embeddings.embed("text")
  );
} catch (e) {
  if (e instanceof CircuitBreakerError) {
    // Use cached embedding or fallback
    logger.warn(`Circuit breaker open: ${e.message}`);
    return getCachedEmbedding(text);
  }
  throw e;
}
```

#### HALF-OPEN State (Testing Recovery)

- **Behavior**: Allow single "probe" request to test if service recovered
- **Requests Allowed**: 1 request at a time (configurable via `halfOpenRequests`)
- **Success**: If probe succeeds, transition to CLOSED and resume normal operation
- **Failure**: If probe fails, transition back to OPEN and restart timeout
- **Timeout**: Probe request subject to same timeout as normal requests

**Transition Logic**:
```
Success: Requires 2 consecutive successes (successThreshold=2)
  - Request 1: Success → state=HALF-OPEN, attempt count=1
  - Request 2: Success → attempt count=2 → CLOSED

Failure: Single failure resets and goes back to OPEN
  - Request 1: Fail → OPEN, restart 30s timeout
```

### Metrics and Observability

**Circuit Breaker exposes**:
```typescript
interface CircuitBreakerMetrics {
  state: 'closed' | 'open' | 'half-open';
  successCount: number;
  failureCount: number;
  lastError?: Error;
  lastErrorTime?: Date;
  transitionTime?: Date;
  uptime: number; // milliseconds
}
```

**Logging**:
```
[WARN] CircuitBreaker(embeddings): State transition CLOSED → OPEN
       Cause: 5 failures in 10s window
       Last error: "429 Rate Limited by Gemini API"
       Recovery will be attempted in 30s

[INFO] CircuitBreaker(embeddings): Probe request (half-open)
       Testing if service has recovered...

[INFO] CircuitBreaker(embeddings): State transition HALF-OPEN → CLOSED
       Service recovered. Resuming normal operation.
```

### Failure Types Handled

1. **API Rate Limiting** (HTTP 429)
   - Gemini/OpenAI API temporarily overloaded
   - Opens circuit, backs off 30s

2. **Network Timeout** (>5s latency)
   - Slow network or service degradation
   - Counted as failure if exceeds timeout

3. **Database Connection Loss**
   - ChromaDB/Neo4j unreachable
   - Opens circuit immediately

4. **Partial Failures**
   - Some batches succeed, some fail
   - Batch-level retries via WAL, circuit breaker for endpoints

---

## Write-Ahead Log (WAL) Pattern (wal.ts)

**Purpose**: Ensure no data loss on crash, enable recovery and replay on startup.

### Concept

Before writing to storage, write operation details to disk. On crash, replay log on startup to finish incomplete operations.

```
User Input
    ↓
[1] Write to WAL ← Data lost if crash here
    ↓
[2] Write to Storage ← Data persisted
    ↓
[3] Mark as Complete in WAL ← If crash here, replay sees incomplete
    ↓
[4] Delete/Prune WAL entry
```

### File Format

**Location**: `~/.claude-memory/wal/`

**Filename Pattern**: `{timestamp}-{operation}.log`
- Example: `2026-03-23T10-45-30Z-save.log`

**Content** (JSONL — one JSON object per line):

```jsonl
{"op":"save","memoryId":"mem-1","namespace":"project-a","timestamp":"2026-03-23T10:45:30.123Z","status":"pending"}
{"op":"delete","memoryId":"mem-2","namespace":"project-a","timestamp":"2026-03-23T10:45:31.234Z","status":"pending"}
{"op":"index","memoryId":"mem-1","entities":["func1","func2"],"timestamp":"2026-03-23T10:45:32.345Z","status":"pending"}
{"op":"save","memoryId":"mem-1","namespace":"project-a","timestamp":"2026-03-23T10:45:30.123Z","status":"completed"}
```

### Operations in WAL

| Operation | Fields | Example |
|-----------|--------|---------|
| `save` | memoryId, namespace, text, tags, timestamp | Save new memory |
| `delete` | memoryId, namespace, timestamp | Delete memory by ID |
| `index` | memoryId, entities, timestamp | Update entity index |
| `compact` | namespace, entryCount, timestamp | Merge duplicates |
| `import` | namespace, filePath, count, timestamp | Bulk import |

### Recovery Algorithm (Runs on Startup)

```typescript
async function recoverFromWAL() {
  const walFiles = fs.readdirSync('~/.claude-memory/wal/');

  for (const file of walFiles) {
    const entries = readJSONL(file);

    for (const entry of entries) {
      if (entry.status === 'pending') {
        // Incomplete operation → replay it
        try {
          switch (entry.op) {
            case 'save':
              await storage.save(entry.memoryId, entry.text, entry.tags);
              break;
            case 'delete':
              await storage.delete(entry.memoryId);
              break;
            case 'index':
              await indexer.updateEntities(entry.memoryId, entry.entities);
              break;
            // ... etc
          }
          // Mark complete
          entry.status = 'completed';
          appendToWAL(entry);
        } catch (e) {
          logger.error(`WAL recovery failed for ${entry.op}:`, e);
          // Retry on next startup
        }
      } else if (entry.status === 'completed') {
        // Already done, cleanup
        deleteWALEntry(file);
      }
    }
  }
}
```

### Configuration

```json
{
  "resilience": {
    "wal": {
      "enabled": true,
      "path": "~/.claude-memory/wal/",
      "maxFileSize": "10MB",
      "pruneInterval": "1h",
      "compressionFormat": "gzip"
    }
  }
}
```

### Latency Impact

- **Before Write**: Write to WAL (~1-2ms on fast disk)
- **After Actual Store**: Mark complete in WAL (~0.5ms)
- **Total Overhead**: ~2-3ms per operation

### Example Recovery Scenario

```
Timeline:
09:45:30 - User saves memory M1 (write to WAL)
09:45:31 - Begin storing M1 in DB
09:45:32 - CRASH! Power loss, process killed
          - M1 may or may not be in storage

On Restart (09:46:00):
09:46:01 - Load WAL files
09:46:02 - Find M1 with status='pending'
09:46:03 - Replay: Save M1 to storage
09:46:04 - Mark M1 as status='completed' in WAL
09:46:05 - Cleanup: Remove WAL entry for M1
09:46:06 - System ready, M1 guaranteed saved
```

---

## LRU Cache (lru-cache.ts)

**Purpose**: Reduce latency for repeated searches and recalls, implement stale-while-revalidate for better UX.

### Cache Configuration

```json
{
  "resilience": {
    "lruCache": {
      "enabled": true,
      "maxSize": 1000,
      "ttl": "5m",
      "staleWhileRevalidate": "1m",
      "keyFormat": "{operation}:{namespace}:{query}"
    }
  }
}
```

### Cache Eviction Policy (LRU)

- **Max Entries**: 1000 (default)
- **Eviction**: When adding entry and cache full, remove least-recently-used
- **Access Pattern**: Searching for entity "handleLogin" → move to MRU position
- **Replacement**: Old entry with fewer accesses → evicted first

```
Initial: [A, B, C, D, E] (E is most recent)

Access E:  [A, B, C, D, E] (E stays MRU)
Access A:  [B, C, D, E, A] (A moves to MRU)
Add F:     [B, C, D, E, A, F] (now size=6)
Add G:     [C, D, E, A, F, G] (B evicted, was LRU)
```

### Stale-While-Revalidate (SWR)

**Pattern**: Return cached result instantly even if stale, update cache in background.

```
TTL=5m, Stale-While-Revalidate=1m

Query at 09:45:00:  MISS → fetch → cache (expires at 09:50:00)
Query at 09:46:00:  HIT  → return cached (still fresh)
Query at 09:51:00:  STALE (expired at 09:50:00, within 1m SWR window)
                    → return cached immediately
                    → schedule background refresh
Query at 09:52:30:  HIT  → return refreshed result

Timeline:
0s:  Fresh result cached (09:45:00 + 5m = 09:50:00 expiry)
60s: Fresh
120s: Fresh
300s (5m): EXPIRED but within 1m SWR window → return stale, revalidate in bg
360s (6m): SWR window passed (09:50:00 + 1m = 09:51:00)
       → return fresh (background refresh completed)
```

### Cache Key Generation

```typescript
// Search operation
const key = `search:${namespace}:${query}:${JSON.stringify(filters)}`;
// Result: "search:my-project:redis:caching:{tags:['code']}"

// Recall operation
const key = `recall:${namespace}:${queryText}:${limit}`;
// Result: "recall:my-project:session:store:10"

// List operation
const key = `list:${namespace}:${tag}:${sort}`;
// Result: "list:my-project:code:modified-date"
```

### Cache Hit/Miss Metrics

```typescript
interface CacheMetrics {
  hits: number;        // Requests served from cache
  misses: number;      // Cache misses (fetched fresh)
  staleHits: number;   // Stale-while-revalidate hits
  evictions: number;   // Entries removed due to size limit
  hitRate: number;     // hits / (hits + misses)
  avgLatency: number;  // Average response time (cached)
}

// Example:
{
  hits: 847,
  misses: 153,
  staleHits: 23,
  evictions: 12,
  hitRate: 0.847,      // 84.7% of requests served from cache
  avgLatency: 0.3      // 0.3ms vs 15ms for fresh fetch
}
```

### Invalidation Strategies

**On Save/Delete**:
```typescript
// When user saves new memory in namespace "my-project"
// Invalidate all search/recall caches for that namespace
cacheInvalidate(pattern: `*:my-project:*`);
```

**Time-Based Expiry**:
```typescript
// Cache entry expires after 5 minutes
// Stale-while-revalidate extends for 1 more minute
// After 6 minutes total, cache entry removed
```

**Manual Invalidation**:
```typescript
// User requests explicit cache clear
await cache.clear(namespace: "my-project");
// Or clear all caches
await cache.clear();
```

### Example: Search with SWR

```typescript
// Search for "redis" in "my-project" namespace
async function search(query: string, namespace: string) {
  const cacheKey = `search:${namespace}:${query}`;

  // Check cache
  const cached = cache.get(cacheKey);

  if (cached) {
    if (cached.isExpired && !cached.isExpiredWithinSWR) {
      // Stale-while-revalidate: return immediately, refresh in background
      scheduleBackground(async () => {
        const fresh = await vectorStore.search(query);
        cache.set(cacheKey, fresh, { ttl: '5m' });
      });
      return cached.value;  // Stale result returned immediately
    } else if (!cached.isExpired) {
      // Fresh cache hit
      return cached.value;
    }
  }

  // Cache miss: fetch fresh
  const result = await vectorStore.search(query);
  cache.set(cacheKey, result, { ttl: '5m' });
  return result;
}
```

---

## Resilience Pattern Interaction

All three patterns work together:

```
User Request
    ↓
[LRU Cache] → HIT? Return cached result (latency: 0.3ms)
    ↓ MISS
[Circuit Breaker] → OPEN? Return error or fallback
    ↓ CLOSED/HALF-OPEN
[WAL] → Write operation to disk before proceeding
    ↓
[Storage] → Persist data
    ↓
[WAL] → Mark operation complete
    ↓
[LRU Cache] → Populate cache for future queries
    ↓
Return result to user
```

### Failure Scenario: Storage Service Unavailable

```
1. Request arrives
2. Cache miss (first query)
3. Circuit breaker CLOSED (normal)
4. Attempt to write to storage
5. Storage unreachable → Network error → failure count++
6. WAL written (pending) for recovery later
7. Retry logic attempts storage 3x
8. All attempts fail → Circuit breaker opens
9. Subsequent requests fail-fast without storage attempts
10. Background service recovery monitor detects outage
11. After 30s timeout, circuit breaker half-open → probe request
12. Probe succeeds → circuit breaker CLOSED
13. WAL recovery replays pending operations
14. User queries resolved from cache (SWR) in interim
```

---

## Configuration and Monitoring

### Combined Resilience Config

```json
{
  "resilience": {
    "circuitBreaker": {
      "enabled": true,
      "failureThreshold": 5,
      "failureWindow": "10s",
      "successThreshold": 2,
      "timeout": "30s",
      "halfOpenRequests": 1
    },
    "wal": {
      "enabled": true,
      "path": "~/.claude-memory/wal/",
      "maxFileSize": "10MB",
      "pruneInterval": "24h"
    },
    "lruCache": {
      "enabled": true,
      "maxSize": 1000,
      "ttl": "5m",
      "staleWhileRevalidate": "1m"
    }
  }
}
```

### Health Check Output

```json
{
  "status": "healthy",
  "components": {
    "circuitBreaker": {
      "embeddings": {"state": "closed", "lastError": null},
      "storage": {"state": "closed", "failureCount": 0}
    },
    "wal": {
      "path": "~/.claude-memory/wal/",
      "pendingEntries": 0,
      "totalSize": "2.3MB",
      "lastRecovery": "2026-03-23T09:30:00Z"
    },
    "cache": {
      "hitRate": 0.847,
      "size": 247,
      "maxSize": 1000,
      "evictions": 12
    }
  }
}
```
