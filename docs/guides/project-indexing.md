# Project Indexing Guide

Project indexing is how you bootstrap Memento with existing knowledge from your codebase. Instead of starting with empty memory, indexing scans your project, extracts key information, and pre-populates your memory store with foundational context.

## Why Index Your Project?

When you start a new project with Memento:
- Your memory store is empty
- Auto-capture only works on future work
- You lack context about existing architecture, patterns, and decisions

Indexing solves this by creating memories from:
- README and documentation files
- Configuration files (package.json, .env, etc.)
- Key source files (main entry points, core modules)
- Architecture diagrams or design documents

This gives you instant context and a reference point for new work.

## What memory_index Does

`memory_index` is your project's indexing command:

```bash
memento index
```

It scans your project directory and:

1. **Identifies key files** by name and importance:
   - `README.md`, `CONTRIBUTING.md` (documentation)
   - `package.json`, `pyproject.toml` (metadata)
   - `.env.example`, `docker-compose.yml` (configuration)
   - `src/index.ts`, `main.py` (entry points)

2. **Extracts content** from identified files:
   - Reads files into memory
   - Filters out binary/large content
   - Preserves structure and comments

3. **Creates memories** with metadata:
   - Tags: `[code, config, architecture, dependency, todo]`
   - Priority: High for README, medium for config, low for code
   - Source: Marked as "project_index"

4. **Records the marker file** at:
   ```
   ~/.claude-memory/.indexed
   ```

   Contains:
   ```json
   {
     "projectPath": "/Users/me/myproject",
     "timestamp": "2026-03-23T14:30:00Z",
     "version": "0.1.0",
     "filesIndexed": 47,
     "memoriesCreated": 23
   }
   ```

### Incremental Indexing

Subsequent calls to `memento index` are incremental:

```bash
# First run: indexes all files
memento index

# Second run: only re-indexes changed files
memento index --incremental
```

This is faster and avoids duplicate memories.

### Force Re-indexing

To re-index everything:

```bash
memento index --force
```

This:
1. Deletes the `.indexed` marker file
2. Re-scans all files
3. Creates new memories (or updates existing ones)

## Using memory_ingest for File and URL Content

`memory_ingest` is a manual ingestion tool for specific files or URLs you want to remember:

```bash
memento ingest /path/to/file.md
memento ingest https://example.com/api-docs
```

Unlike `memory_index` (which is automatic and project-wide), `memory_ingest`:
- Operates on single files or URLs
- Supports more formats (PDF, images, websites)
- Creates high-importance memories by default
- Useful for external documentation or one-off resources

## Content Extractors: Format Support

Memento automatically detects file format and applies the appropriate extractor:

### Markdown Extractor

**Files:** `.md`, `.markdown`

```bash
memento ingest docs/architecture.md
```

**What it extracts:**
- Headings (create section memories)
- Code blocks (labeled by language)
- Lists and nested structures
- Inline links

**Example memory created:**
```json
{
  "content": "# Architecture Overview\nOur system uses microservices...",
  "tags": ["architecture", "documentation"],
  "source": "project_index",
  "entity": "docs/architecture.md"
}
```

### Code Extractor

**Files:** `.js`, `.ts`, `.py`, `.go`, `.rust`, etc.

```bash
memento ingest src/auth.ts
```

**What it extracts:**
- Function and class definitions
- Important comments and docstrings
- Imports and dependencies
- Type definitions

**Example memory created:**
```json
{
  "content": "export function validateJWT(token: string): boolean { ... }",
  "tags": ["code", "function"],
  "entity": "validateJWT",
  "source": "project_index"
}
```

### Configuration Extractor

**Files:** `package.json`, `tsconfig.json`, `.env.example`, `docker-compose.yml`, `Dockerfile`

```bash
memento ingest package.json
```

**What it extracts:**
- Dependencies and versions
- Scripts and build commands
- Configuration options
- Environment variables

**Example memory created:**
```json
{
  "content": "project: memento-memory, version: 0.1.0, main: dist/index.js",
  "tags": ["config", "dependency"],
  "entity": "package.json",
  "source": "project_index"
}
```

### PDF Extractor

**Files:** `.pdf`

```bash
memento ingest docs/specification.pdf
```

**What it extracts:**
- Text content (page-by-page)
- Headings and structure
- Tables converted to markdown

**Note:** Requires optional dependency `pdf-parse`. Install with:
```bash
npm install pdf-parse
```

### Image Extractor

**Files:** `.png`, `.jpg`, `.jpeg`, `.gif`

```bash
memento ingest docs/architecture-diagram.png
```

**What it extracts:**
- Image metadata (dimensions, format)
- Embedded text (OCR if available)
- File path and name as context

**Use case:** Save screenshots of documentation or diagrams for later reference.

### URL Extractor

**URLs:** Any web page

```bash
memento ingest https://docs.example.com/api-reference
```

**What it extracts:**
- Page title and meta description
- Main content text
- Headings and structure
- Links within the page

**Example memory created:**
```json
{
  "content": "API Reference for Example Service v2.0. Endpoints: GET /users, POST /users, ...",
  "tags": ["documentation", "external"],
  "source": "url_ingest",
  "url": "https://docs.example.com/api-reference",
  "domain": "docs.example.com"
}
```

## Onboarding Workflow: Getting Started with a New Project

Here's a recommended flow for onboarding a new project into Memento:

### Step 1: Initialize Configuration

```bash
cd /path/to/myproject
memento init
```

Creates `~/.claude-memory/config.json` if it doesn't exist, with your project path.

### Step 2: Index the Project

```bash
memento index
```

Output:
```
Indexing /Users/me/myproject...

Scanning project structure...
  Files found: 127
  Candidate key files: 47

Creating memories...
  README.md → memory_123
  package.json → memory_124
  src/index.ts → memory_125
  docs/architecture.md → memory_126
  ...

Indexing complete!
  ✓ 23 memories created
  ✓ Marker file saved to ~/.claude-memory/.indexed
  ✓ Project context ready
```

### Step 3: Ingest Key External Documentation

For important external docs (APIs, frameworks, etc.):

```bash
# Public API documentation
memento ingest https://api.example.com/docs

# Your company's internal docs
memento ingest /Users/me/docs/company-standards.md

# Architecture decision records
memento ingest https://github.com/mycompany/adr/blob/main/README.md
```

### Step 4: Verify Memories Are Ready

```bash
memento list --limit 5
```

Output:
```
Recent Memories (total: 47)
═════════════════════════════════════════════════════════════════

1. [2026-03-23] README.md overview
   Tags: [documentation, project]
   Importance: 0.92

2. [2026-03-23] Project dependencies (package.json)
   Tags: [config, dependency]
   Importance: 0.85

3. [2026-03-23] Architecture overview
   Tags: [architecture, documentation]
   Importance: 0.88

...
```

### Step 5: Start Coding

Your IDE now has context! When you write code:

```bash
# Auto-capture works from here
# Bash, Write, Edit outputs are saved
# memory_recall pulls from both indexed + new memories
```

## Real-World Examples

### Example 1: Node.js Project Onboarding

```bash
# 1. Start in your project
cd ~/projects/my-api

# 2. Index the project
memento index

# This automatically finds and indexes:
#   - README.md (project overview)
#   - package.json (dependencies, scripts)
#   - src/index.ts (main entry point)
#   - docker-compose.yml (service configuration)
#   - .env.example (env variables)

# 3. Ingest external docs
memento ingest https://docs.expressjs.com/
memento ingest https://www.postgresql.org/docs/14/

# 4. Start working
# When you edit src/auth.ts, auto-capture saves it
# When you run tests, Bash output is captured
# memento recall "JWT" now returns indexed README + new work
```

### Example 2: Python Data Science Project

```bash
# 1. Index the project
memento index

# Auto-finds:
#   - README.md (project description)
#   - requirements.txt (dependencies)
#   - src/train.py (main script)
#   - docs/data_pipeline.md (architecture)
#   - notebooks/eda.ipynb (analysis)

# 2. Ingest specialized docs
memento ingest https://scikit-learn.org/stable/user_guide.html
memento ingest https://pandas.pydata.org/docs/

# 3. Ingest your data schema
memento ingest docs/schema.md

# Now when you recall "feature engineering", you get:
#   - Indexed docs about your pipeline
#   - Auto-captured code changes
#   - External best practices from scikit-learn docs
```

### Example 3: Migrating Existing Project with Technical Debt

```bash
# 1. Index current state
memento index

# Creates memories for current code, config, docs

# 2. Ingest "lessons learned" document
memento ingest docs/technical-debt.md

# 3. Ingest ADRs (Architecture Decision Records)
memento ingest adr/001-migration-strategy.md
memento ingest adr/002-deprecation-timeline.md

# 4. Start refactoring
# Auto-capture tracks all changes
# memory_related --entity "OldComponent" shows evolution
# memory_recall "migration strategy" pulls all relevant context

# After 3 months, run:
memento stats

# See growth of memories capturing your migration journey
```

## Managing Indexed Memories

### View Indexed Memories

```bash
memento list --filter source:project_index
```

Lists only memories created by project indexing.

### Update Indexed Memories

If your README or architecture docs change:

```bash
# Re-index the changed file
memento ingest docs/architecture.md --force

# Or re-index everything
memento index --force
```

### Delete Indexed Content

To remove all indexed memories:

```bash
memento list --filter source:project_index --format json | \
  jq -r '.[] | .id' | \
  xargs -I {} memento forget {}
```

Or manually:

```bash
memento forget memory_abc123
```

## Recommended Indexing Schedule

**Initial indexing:** Once when starting with a project

**Periodic re-indexing:**
- After major architecture changes
- When onboarding new team members
- After significant documentation updates
- Monthly (as part of memory maintenance)

**Trigger-based re-indexing:**
```bash
# After updating README
memento ingest README.md

# After changing config
memento ingest package.json

# After architecture decisions
memento ingest adr/
```

## Performance Considerations

### Indexing Time

- **Small project (< 50 files):** 2-5 seconds
- **Medium project (50-500 files):** 10-30 seconds
- **Large project (500+ files):** 30-120 seconds

To optimize, exclude directories:

```json
{
  "index": {
    "excludePatterns": [
      "node_modules/",
      ".git/",
      "dist/",
      "build/",
      ".next/",
      "__pycache__/"
    ]
  }
}
```

### Memory Store Growth

Indexing a medium project typically adds:
- 20-50 memories
- 500KB-2MB to store
- Minimal impact on search speed (HNSW indexes efficiently)

## Troubleshooting

**Q: Indexing finds no files**
A: Check that your working directory is the project root. Verify files aren't in excluded patterns.

**Q: Content looks truncated**
A: Files are capped at ~50KB by default. Edit config to increase:
```json
{
  "index": {
    "maxFileSizeKB": 100
  }
}
```

**Q: External URLs don't extract properly**
A: Some sites block scrapers. Manually copy content to `.md` and ingest the file instead.

**Q: Duplicate memories from re-indexing**
A: Use `memory_index --incremental` to skip unchanged files. Or use `--force` to update existing memories.

---

Project indexing is the one-time investment that turns Memento from a capture tool into a project-aware knowledge system. Spend 5-10 minutes indexing on day one, and every subsequent search and recall operation draws from both your project's foundation and your ongoing work.
