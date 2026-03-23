# Memory Compaction Guide

As your memory store grows with auto-capture, index operations, and manual savings, it will eventually accumulate:
- Duplicate or near-duplicate memories
- Low-importance historical notes
- Expired entries (very old memories approaching irrelevance)

**Memory compaction** is the process of cleaning up your store, keeping it lean and efficient while preserving what matters.

## Why Compaction Matters

### Problem: Store Growth Over Time

Starting from day 1:

```
Day 1:       10 KB (just indexed)
Week 1:      200 KB (auto-capture + new work)
Month 1:     2 MB (steady growth)
Month 3:     8 MB (significant accumulation)
Month 6:     25 MB (potential slowdown)
Month 12:    60+ MB (search performance degrades)
```

As your store grows:
- **Search becomes slower** (HNSW index gets larger)
- **Memory overhead increases** (embeddings take RAM)
- **Disk I/O increases** (larger files take longer to read)
- **Noise increases** (more low-quality memories to filter through)

### Solution: Regular Compaction

Compaction removes the 10-20% of least-important memories while keeping all high-value knowledge intact:

```
Before compaction:  100 memories, 8 MB
After compaction:    80 memories, 2.5 MB (68% size reduction)
Search performance:  5x faster
Memory usage:        3x less
```

## The memory_compact Command

### Basic Compaction

```bash
memento compact
```

This runs with defaults:
- Removes memories older than **180 days** (6 months)
- Deletes near-duplicates (similarity > 0.95)
- Removes low-importance entries (importance < 0.3)
- Keeps maximum **10,000** memories
- Preserves all high-importance memories (> 0.7)

### Preview Mode (Dry Run)

Before actually removing memories, preview what would be deleted:

```bash
memento compact --dryRun
```

Output:

```
Compaction Preview (No Changes Made)
═════════════════════════════════════════════════════════════════

Current store:
  Total memories: 347
  Store size: 8.2 MB
  Average importance: 0.62

Compaction would remove:
  Expired entries (older than 180 days): 23
  Near-duplicates: 7
  Low importance (< 0.3): 12
  Overflow (> 10,000): 0

After compaction:
  Total memories: 305
  Store size: 5.8 MB (29% reduction)
  Average importance: 0.71

Items to be deleted:
  1. "JavaScript debugging tips" (importance: 0.15, age: 198 days)
  2. "Node.js version check" (importance: 0.22, age: 201 days)
  3. "Typo in variable name line 42" (importance: 0.10, age: 167 days)
  ...

Are you sure? [y/n]
```

Review the list, then confirm to proceed.

## Compaction Configuration Options

### TTL (Time-To-Live): Remove Old Memories

Remove memories older than N days:

```bash
memento compact --ttlDays 180
```

**Recommended values:**

| Value | Use Case |
|-------|----------|
| 90 | Aggressive: Keep only recent work (3 months) |
| 180 | Standard: 6-month retention (default) |
| 365 | Conservative: Keep 1 year of history |
| 730 | Archival: Keep 2 years (rarely delete) |

**Example:**

```bash
# Keep only recent memories (90 days)
memento compact --ttlDays 90 --dryRun
```

Output:
```
Would expire: 67 memories older than 90 days
Storage saved: 2.1 MB
Example memories to expire:
  - "Vue.js performance optimization" (125 days old)
  - "Docker networking setup" (98 days old)
  - "Webpack configuration" (156 days old)
```

### Max Entries: Cap Store Size

Limit your memory store to maximum N entries:

```bash
memento compact --maxEntries 5000
```

**Recommended values:**

| Value | For Store Size | Search Speed |
|-------|---|---|
| 2,000 | < 1 MB | Instant (< 10ms) |
| 5,000 | < 3 MB | Very fast (10-20ms) |
| 10,000 | < 5-8 MB | Fast (20-50ms) |
| 50,000 | 20-40 MB | Acceptable (50-100ms) |
| 100,000+ | 50+ MB | Slow (100ms+) |

**Example:**

```bash
# Limit to 5,000 memories
memento compact --maxEntries 5000

# What gets removed (priority order):
#   1. Lowest importance scores
#   2. Oldest memories
#   3. Auto-captured items (less important than manual saves)
#   4. Broad tags (prefer specific expertise)
```

### Combined: TTL + MaxEntries

```bash
memento compact --ttlDays 180 --maxEntries 10000
```

This removes BOTH:
- Memories older than 180 days, AND
- Excess memories if total exceeds 10,000

### Understanding What Gets Removed

Compaction removes in this order:

```
Priority 1: Expired memories (older than TTL)
  └─ Age 400+ days (clearly historical)
  └─ Examples: old debugging notes, obsolete tool configs

Priority 2: Near-duplicates (similarity > 0.95)
  └─ Two memories with nearly identical content
  └─ Keeps the higher-importance version
  └─ Example: "Fixed bug X" captured twice accidentally

Priority 3: Low importance (importance < 0.30)
  └─ Memories with minimal value
  └─ Examples: typo fixes, one-off debugging notes
  └─ Keeps high-importance even if old

Priority 4: Overflow (if store exceeds maxEntries)
  └─ Lowest-importance memories removed first
  └─ Doesn't remove just because they're old
  └─ Only if your store gets too large
```

**Example removal order:**

```
Store has 12,000 memories with maxEntries: 10,000
Need to remove 2,000

Candidates for removal (scored by removal priority):
  1. memory_452: "Fixed typo in comment" (importance: 0.08, age: 200 days) ← FIRST
  2. memory_287: "Webpack build error" (importance: 0.12, age: 350 days) ← FIRST
  3. memory_156: "Database query optimization" (importance: 0.95, age: 100 days) ← SKIP (too important)
  4. memory_299: "Similar to memory_301" (similarity: 0.96, importance: 0.65) ← KEEP (less similar)
  ... (remove 1,998 more low-value items)
```

## Recommended Compaction Schedule

### For Active Development (Continuous Changes)

```bash
# Weekly compaction
memento compact --ttlDays 180 --maxEntries 10000
```

Add to cron (runs every Sunday at 2 AM):

```bash
0 2 * * 0 memento compact --ttlDays 180 --maxEntries 10000
```

### For Large Projects (Accumulates Fast)

```bash
# Bi-weekly aggressive compaction
memento compact --ttlDays 90 --maxEntries 5000
```

Add to cron (every other Monday):

```bash
0 3 * * 1 [ $(($(date +%w) % 2)) -eq 1 ] && memento compact --ttlDays 90 --maxEntries 5000
```

### For Archival Projects (Keep Everything)

```bash
# Quarterly light compaction
memento compact --ttlDays 730 --maxEntries 50000
```

Add to cron (first of every quarter):

```bash
0 4 1 1,4,7,10 * memento compact --ttlDays 730 --maxEntries 50000
```

## Monitoring Store Size with memory_stats

Before and after compaction, check statistics:

```bash
memento stats
```

**Output:**

```
Memory Store Statistics
═══════════════════════════════════════════════════════════════

Total entries:           347
Total embeddings size:   2.1 MB
Store size on disk:      3.4 MB

Entries by importance:
  High (0.7-1.0):       156 (45%)
  Medium (0.4-0.7):     124 (36%)
  Low (< 0.4):           67 (19%)

Entries by age:
  Recent (< 7 days):     34
  Current (7-90 days):  187
  Dated (90-180 days):   89
  Old (180+ days):       37

Entries by source:
  Auto-capture:         201 (58%)
  Manual save:           89 (26%)
  Project index:         47 (13%)
  Imported:              10 (3%)

Most common tags:
  code:                  156
  decision:               89
  architecture:           67
  error:                  45
  dependency:             34

Last compaction:         2026-03-15 02:00:00
Next recommended:        2026-03-22 02:00:00

Disk usage trend:
  Last week:    3.2 MB
  Last month:   2.8 MB
  Last 90 days: 1.9 MB ← Growing (weekly compaction recommended)
```

### Interpreting Statistics

**Store growing too fast?**
- Increase compaction frequency
- Lower `ttlDays` to remove old memories faster
- Check if auto-capture is capturing too much (increase `minOutputLength`)

**Store shrinking after compaction?**
- Compaction is working correctly
- Schedule compaction before store reaches 10MB

**High proportion of low-importance memories?**
- Consider raising `importance` threshold in compaction
- Or rely on `maxEntries` to cap size regardless

## Real-World Scenario: Year-Long Project

**Timeline:**

**Month 1 (Starting Out)**
```bash
memento stats
# Total: 47 memories, 200 KB
# No compaction needed yet
```

**Month 3**
```bash
memento stats
# Total: 287 memories, 2.1 MB
# Review with: memento compact --dryRun
```

**Month 6**
```bash
memento stats
# Total: 489 memories, 4.2 MB
# First compaction: memento compact --ttlDays 180
# Result: 412 memories, 3.1 MB (26% reduction)
```

**Month 9**
```bash
memento stats
# Total: 623 memories, 5.8 MB
# Compaction: memento compact --ttlDays 180 --maxEntries 500
# Result: 487 memories, 3.9 MB (33% reduction)
```

**Month 12**
```bash
memento stats
# Total: 1,024 memories, 8.9 MB
# Aggressive compaction: memento compact --ttlDays 120 --maxEntries 750
# Result: 742 memories, 4.5 MB (49% reduction)

# Archive before compaction
memento export --format json > annual-memories-2026.json
git add annual-memories-2026.json
git commit -m "Year 1 memory archive"
```

## Best Practices

### Before Compaction: Always Backup

```bash
# Export before compacting
memento export --format json > memories-pre-compaction-$(date +%Y-%m-%d).json

# Then compact
memento compact --ttlDays 180
```

### Review Dry-Run Results

Always use `--dryRun` first:

```bash
memento compact --ttlDays 180 --dryRun

# Review the list of what will be deleted
# If satisfied, run without --dryRun
memento compact --ttlDays 180
```

### Schedule During Off-Hours

Add to cron for 2-3 AM (when you're not coding):

```bash
0 2 * * 0 memento compact --ttlDays 180 --maxEntries 10000 2>&1 | mail -s "Memento Compaction" you@example.com
```

### Monitor Search Performance

Track search latency before and after:

```bash
# Before compaction
time memento search "authentication" --limit 10
# Result: real 0m0.045s

# After compaction
time memento search "authentication" --limit 10
# Result: real 0m0.012s (3.7x faster!)
```

## Troubleshooting Compaction

**Q: Compaction deleted important memories**
A: You can recover from the backup you exported before compacting. Use `memory_import` to restore them.

**Q: Compaction didn't remove as much as expected**
A: High-importance memories are protected. Increase `ttlDays` or lower the importance threshold in your compaction config.

**Q: Search is still slow after compaction**
A: If you have many low-importance memories, be more aggressive: `--ttlDays 90 --maxEntries 5000`.

---

Memory compaction is maintenance that keeps your memory store performant and focused on what matters. Regular compaction means faster searches, lower disk usage, and a knowledge base that stays signal-rich and noise-poor.
