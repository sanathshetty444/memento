# Smart Memory Guide: Contradiction Detection, Importance Scoring, and Entity Extraction

## Overview

"Smart memory" means Memento doesn't just store raw information—it understands relationships, tracks importance over time, extracts meaningful entities, and detects when information contradicts previous knowledge. This turns your memory store from a simple database into an intelligent knowledge graph.

## Contradiction Detection

### What It Does

Contradiction detection automatically identifies when new memories conflict with old ones. When detected, Memento:
1. Flags the contradiction
2. Creates a `contradicts` relationship linking both memories
3. Marks the newer memory as superseding the older one
4. Adjusts search ranking to surface the current truth

### Pattern Recognition: How It Detects Contradictions

Contradiction detection looks for **negation patterns** and **temporal markers**:

#### Negation Patterns

Your system detects statements that explicitly deny or reverse previous ones:

**Pattern: "no longer"**
```
Old memory: "We use PostgreSQL for user data"
New memory: "We no longer use PostgreSQL, migrated to MongoDB"

Detection: Negation trigger "no longer"
Relationship created: new_memory → contradicts → old_memory
```

**Pattern: "switched from"**
```
Old memory: "Authentication via JWT tokens"
New memory: "Switched from JWT to OAuth2 after security audit"

Detection: Negation trigger "switched from"
Relationship created: new_memory → supersedes → old_memory
```

**Pattern: "deprecated"**
```
Old memory: "Use Vue.js for UI rendering"
New memory: "Vue.js is deprecated in favor of React"

Detection: Negation trigger "deprecated"
Relationship created: new_memory → references → old_memory (with note: deprecated)
```

**Pattern: "replaced"**
```
Old memory: "Database transactions use MySQL InnoDB"
New memory: "Replaced MySQL with PostgreSQL for ACID guarantees"

Detection: Negation trigger "replaced"
Relationship created: new_memory → supersedes → old_memory
```

**Pattern: "incorrect" / "wrong"**
```
Old memory: "Redis memory limit is 1GB"
New memory: "That's incorrect—we set Redis to 8GB last month"

Detection: Negation trigger "incorrect"
Relationship created: new_memory → contradicts → old_memory
Severity: HIGH (explicit error correction)
```

#### Temporal Markers

Contradiction detection also looks for explicit temporal statements indicating change:

**Pattern: "now using"**
```
Old memory: "Build system uses Webpack"
New memory: "As of March 2026, now using Vite for faster builds"

Detection: Temporal marker "now using"
Relationship created: new_memory → supersedes → old_memory
Timestamp: 2026-03-23 (captures when change occurred)
```

**Pattern: "as of [date]"**
```
Old memory: "Node.js LTS version is 18.x"
New memory: "As of March 2026, Node.js LTS is 20.x"

Detection: Temporal marker "as of March 2026"
Relationship created: new_memory → supersedes → old_memory
```

**Pattern: "updated"**
```
Old memory: "API endpoint: GET /users returns 50 items per page"
New memory: "Updated endpoint to return 100 items per page"

Detection: Temporal marker "updated"
Relationship created: new_memory → supersedes → old_memory
```

### How Search Results Reflect Contradictions

When you recall or search, contradictions affect ranking:

```
Query: "What database do we use?"

Results WITHOUT contradiction detection (outdated):
  1. "We use PostgreSQL for user data" (created 2026-01-15)
  2. "We use MongoDB for product catalog" (created 2026-02-20)
  3. "Switched from PostgreSQL to MongoDB" (created 2026-03-20)

Results WITH contradiction detection (correct):
  1. "Switched from PostgreSQL to MongoDB" (created 2026-03-20) ← SUPERSEDES others
  2. "We use MongoDB for product catalog" (created 2026-02-20)
  3. [MARKED AS CONTRADICTED] "We use PostgreSQL for user data" (created 2026-01-15)
```

The older, contradicted memory is still available but marked and de-ranked.

### Viewing Contradiction Relationships

Use `memory_related` to see contradictions:

```bash
memento related --id "memory_abc123"
```

Output:
```
Memory: "We use PostgreSQL for user data"
Created: 2026-01-15
Relationships:

  → contradicts → "Switched from PostgreSQL to MongoDB"
                  Created: 2026-03-20 (5 days after)
                  Status: SUPERSEDED

  ← references ← "Database migration plan"
                 Created: 2026-02-01

  ← elaborates ← "PostgreSQL connection pooling"
                 Created: 2026-02-10
```

## Importance Scoring: The 0-1 Scale

### The Purpose

Not all memories are equally important. A quick debugging note about a typo is less important than architectural decisions. Memento automatically assigns each memory an **importance score from 0.0 to 1.0** that affects:
- Search ranking (higher importance bubbles up)
- Recall suggestions
- Compaction (low importance gets pruned first if store grows too large)

### The Formula: Multiple Weighted Factors

Importance is calculated as a weighted blend of several factors:

```
importance = (0.30 × source_weight) + (0.20 × tag_weight) +
             (0.25 × priority_weight) + (0.25 × recency_weight)
```

#### 1. Source Weight (30%)

Where did the memory come from? Some sources are inherently more important:

| Source | Weight | Reasoning |
|--------|--------|-----------|
| Auto-captured from Write tool | 0.9 | New code is important |
| Auto-captured from Edit tool | 0.8 | Modifications matter |
| Auto-captured from Bash output | 0.7 | Command results are useful |
| Manual memory_save | 0.85 | User explicitly saved it |
| Auto-captured from Read tool | 0.4 | Already on disk, redundant |
| Imported from file | 0.6 | External knowledge, moderate importance |

#### 2. Tag Weight (20%)

Tags influence importance. High-value tags boost the score:

| Tag | Weight | Reasoning |
|-----|--------|-----------|
| decision | 0.95 | Decisions shape architecture |
| error | 0.80 | Error patterns prevent regressions |
| architecture | 0.90 | Architecture decisions are foundational |
| dependency | 0.75 | Dependencies affect stability |
| config | 0.70 | Configuration is critical to operation |
| todo | 0.50 | Todos are temporal and low priority |
| conversation | 0.40 | Lightweight conversational context |

Multiple tags average their weights.

#### 3. Priority Weight (25%)

Explicit priority (if you set it):

| Priority | Weight |
|----------|--------|
| high | 0.95 |
| medium | 0.65 |
| low | 0.35 |
| none (default) | 0.55 |

#### 4. Recency Weight with Exponential Decay (25%)

Newer memories are more important, but older memories don't become worthless. Memento uses **exponential decay with a 347-day half-life**:

```
recency_weight = 2^(-age_in_days / 347)

Examples:
  Age 0 days:   weight = 1.0 (brand new)
  Age 7 days:   weight = 0.99 (still recent)
  Age 30 days:  weight = 0.94 (somewhat dated)
  Age 90 days:  weight = 0.83 (getting old)
  Age 347 days: weight = 0.50 (half-life)
  Age 694 days: weight = 0.25 (very old)
  Age 1000+ days: weight ≈ 0.10 (archival)
```

The 347-day half-life is chosen to keep memories relevant for about a year while slowly deprioritizing ancient history.

### Example: Calculating Importance

**Scenario:** You manually save a decision about switching to TypeScript

```
Memory saved with:
  - content: "Decided to adopt TypeScript for type safety"
  - tags: ["decision", "architecture"]
  - priority: "high"
  - timestamp: 2026-03-23 (just created)

Calculation:

source_weight = 0.85 (manual memory_save)
tag_weight = average(0.95, 0.90) = 0.925 (decision + architecture)
priority_weight = 0.95 (high priority)
recency_weight = 1.0 (age 0 days)

importance = (0.30 × 0.85) + (0.20 × 0.925) + (0.25 × 0.95) + (0.25 × 1.0)
           = 0.255 + 0.185 + 0.2375 + 0.25
           = 0.9275 ← VERY IMPORTANT

Result: This memory ranks near the top of all searches
```

**Compare with:** A simple debugging note

```
Memory auto-captured from Read tool:
  - content: "Line 42 has a typo in variable name"
  - tags: ["none"]
  - priority: none (default)
  - timestamp: 2026-03-23 (just created)

source_weight = 0.40 (Read tool, already on disk)
tag_weight = 0.0 (no tags)
priority_weight = 0.55 (default)
recency_weight = 1.0 (age 0 days)

importance = (0.30 × 0.40) + (0.20 × 0.0) + (0.25 × 0.55) + (0.25 × 1.0)
           = 0.12 + 0 + 0.1375 + 0.25
           = 0.5075 ← LOW IMPORTANCE

Result: This memory ranks low in searches
```

### Re-ranking: Post-Search Adjustments

After returning initial search results, Memento applies re-ranking based on:

1. **Recency boost** (5-10% boost for memories created in last 7 days)
2. **Source quality** (bump memories from Write/Edit tools above Read outputs)
3. **Tag relevance** (if your query matches a tag, boost that memory)

This ensures you see the most relevant, high-quality results first.

## Entity Extraction: Semantic Understanding

### What It Detects

Memento automatically extracts **entities**—meaningful concepts and references—from your memories:

#### File Paths

```
Content: "Modified src/components/Button.tsx to fix styling"

Extracted entities:
  - entity_type: "file_path"
  - entity_value: "src/components/Button.tsx"
  - context: "modified"
```

#### Function and Method Names

```
Content: "The handleSubmit function now validates email format"

Extracted entities:
  - entity_type: "function"
  - entity_value: "handleSubmit"
  - context: "validates"
```

#### Class Names

```
Content: "User class inherits from BaseModel"

Extracted entities:
  - entity_type: "class"
  - entity_value: "User"
  - context: "inherits"
```

#### Package Names and Dependencies

```
Content: "Added Express.js middleware for rate limiting"

Extracted entities:
  - entity_type: "package"
  - entity_value: "express"
  - version: "latest"
  - context: "middleware"
```

#### URLs and Domains

```
Content: "Check the API documentation at https://api.example.com/docs"

Extracted entities:
  - entity_type: "url"
  - entity_value: "https://api.example.com/docs"
  - domain: "api.example.com"
```

#### Environment Variables

```
Content: "Set DATABASE_URL in .env to postgres://localhost"

Extracted entities:
  - entity_type: "env_var"
  - entity_value: "DATABASE_URL"
  - context: "database connection"
```

#### Code Comments and Notes

```
Content: "TODO: add password reset flow"

Extracted entities:
  - entity_type: "code_note"
  - entity_value: "password reset flow"
  - priority: "todo"
```

### Querying via memory_related

Use `memory_related` to find all memories mentioning a specific entity:

```bash
memento related --entity "handleSubmit"
```

Output:
```
Found 12 memories mentioning handleSubmit:

1. "The handleSubmit function now validates email format"
   Created: 2026-03-20
   Context: function definition

2. "Fixed race condition in handleSubmit called by form onSubmit"
   Created: 2026-03-18
   Context: bug fix

3. "Refactored handleSubmit to use async/await"
   Created: 2026-03-10
   Context: refactoring

...

Timeline visualization:
  2026-03-10: Refactored to async/await
  2026-03-18: Fixed race condition
  2026-03-20: Added validation

Evolution: Functional → Bug-free → Validated
```

## Relationship Types

Memento automatically creates **relationships** between memories to build a knowledge graph:

### similar

Memories with very similar meaning or content. Created when:
- Vector similarity > 0.85
- Same entity or topic mentioned
- Within 7 days of each other

```
Memory A: "JWT token contains user ID and role"
Memory B: "Access tokens include user ID and permissions"

Relationship: similar
Reason: Discuss the same concept (token content) with 0.87 similarity
```

### supersedes

A newer memory replaces an older one. Created when:
- Temporal marker detected: "now using", "updated", "switched to"
- Explicit contradiction: "no longer", "replaced"
- Timestamp shows newer memory is intentionally replacing older

```
Old: "Use Redux for state management"
New: "Switched to Zustand for simpler state management"

Relationship: new → supersedes → old
Effect: Old memory de-ranked in search results
```

### references

A memory builds on or refers to another. Created when:
- One memory cites or mentions the other
- Same entity discussed with different context
- Follow-up discussion or elaboration planned

```
Memory A: "PostgreSQL ACID properties"
Memory B: "Using PostgreSQL ACID guarantees for financial transactions"

Relationship: B → references → A
Effect: When viewing B, A is automatically suggested
```

### contradicts

A memory directly conflicts with another. Created when:
- Explicit negation: "that's wrong", "incorrect"
- Opposite conclusions from same data
- Conflicting decisions or approaches

```
Memory A: "Caching reduces database load by 50%"
Memory B: "Caching caused stale data issues and reduced accuracy"

Relationship: B → contradicts → A
Effect: Both visible, but B marked as current truth
```

### elaborates

A memory expands on concepts from another. Created when:
- Detailed follow-up to a higher-level memory
- Same topic, but with more depth or specifics
- Answers a question posed in another memory

```
Memory A: "Need to optimize API response time"
Memory B: "Implemented query caching and connection pooling, reduced latency 60%"

Relationship: B → elaborates → A
Effect: When searching for "optimization", both appear together
```

## Viewing the Knowledge Graph

### Using memory_related

```bash
memento related --id "memory_abc123" --depth 2
```

Output shows the relationship network:

```
Central memory: "JWT authentication implementation"

1-hop relationships:
  → references → "JWT specification RFC 7519"
  → contradicts → "Session-based authentication"
  → elaborates ← "Refresh token rotation"
  → similar → "OAuth2 token flow"

2-hop relationships:
  → references → "RSA cryptography"
  → elaborates ← "Rate limiting for token endpoint"
```

### Graph Visualization

Use `memento status --visualize` to see a text-based graph:

```
                    ┌─────────────────────┐
                    │ JWT Specification   │
                    │ RFC 7519            │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ JWT Implementation  │ ← central memory
                    └──────────┬──────────┘
                    ┌──────────┴──────────┐
       ┌────────────▼──┐    ┌──────────────▼──────┐
       │ Token Refresh │    │ Session-based Auth  │
       │ (elaborates)  │    │ (contradicts)       │
       └───────────────┘    └─────────────────────┘
```

## Practical Examples

### Example 1: Tracking Architecture Evolution

You start with a memory:
```
Memory 1: "Using MVC architecture with separate models and views"
Created: 2026-01-15
Importance: 0.87 (architecture tag)
```

Two months later, you decide to refactor:
```
Memory 2: "Migrated from MVC to domain-driven design with aggregates"
Created: 2026-03-20
Importance: 0.92 (architecture tag + decision tag)
Tags: [architecture, decision]
```

**What Memento does automatically:**
- Detects "migrated from ... to ..." pattern
- Creates: Memory 2 → `supersedes` → Memory 1
- De-ranks Memory 1 in future searches
- Marks both as related in the knowledge graph
- Stores 347-day decay, so Memory 1 is available for historical context but Memory 2 takes precedence

### Example 2: Contradictions Flagged Automatically

```
Memory A: "Docker reduces deployment issues by 80%"
Created: 2026-02-01
Importance: 0.75

Memory B: "Docker added complexity and network issues aren't worth it"
Created: 2026-03-15
Tags: [decision, error]
Importance: 0.88
```

**Automatic detection:**
- "isn't worth it" contradicts earlier "reduces issues"
- Memory B is newer and tagged as "decision"
- Creates: B → `contradicts` → A
- When searched for "Docker benefits", B appears first
- A is still available under "Docker history" or full memory list

### Example 3: Entity-Based Knowledge Discovery

Over 6 months, you've saved 30 memories:

```
memory_001: "Button component styling uses Tailwind"
memory_042: "Button component has accessibility issues"
memory_156: "Fixed Button component click handler race condition"
memory_203: "Refactored Button component to use hooks"
```

**Using `memory_related --entity "Button"`:**
```
Found 4 memories about Button component

Evolution timeline:
  2026-01-15: Initial Tailwind styling
  2026-02-03: Accessibility issues discovered
  2026-03-01: Fixed race condition
  2026-03-20: Refactored to hooks

Entities extracted:
  - file: src/components/Button.tsx
  - functions: onClick, render, accessibilityProps
  - tags: [code, bug, refactoring]

Relationships:
  - memory_042 → references → memory_001
  - memory_156 → elaborates → memory_042
  - memory_203 → supersedes → memory_001, memory_156
```

This gives you the complete evolution of a component without manually searching!

---

Smart memory transforms your knowledge store from static notes into a living, evolving knowledge base that understands contradictions, importance, and relationships automatically. As you work and add memories, the graph becomes more valuable, helping you discover insights you didn't know you had.
