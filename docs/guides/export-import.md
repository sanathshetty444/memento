# Export and Import Guide

Memento's export and import tools let you:
- **Back up your memories** to external formats
- **Migrate** between storage backends
- **Share** memories with teammates
- **Analyze** your memory store in spreadsheets or custom tools
- **Integrate** memories from other systems

This guide covers all four export formats, import workflows, and practical scenarios.

## Memory Export: Four Formats

### JSONL Format (Default)

**What it is:** One JSON object per line (JSON Lines format)

```bash
memento export --format jsonl
```

**Output example:**
```json
{"id":"memory_001","content":"JWT token contains user ID and role","tags":["code","decision"],"importance":0.87,"createdAt":"2026-03-15T10:30:00Z","sourceTag":"claude-code"}
{"id":"memory_002","content":"Switched from JWT to OAuth2 for third-party integrations","tags":["decision","architecture"],"importance":0.92,"createdAt":"2026-03-20T14:45:00Z","supersedes":"memory_001"}
{"id":"memory_003","content":"PostgreSQL query optimization increased throughput 40%","tags":["performance","database"],"importance":0.78,"createdAt":"2026-03-22T09:15:00Z"}
```

**Why use JSONL:**
- One line per memory (easy to stream and process)
- Minimal overhead
- Perfect for piping to other tools
- Preserves all metadata including importance scores and relationships

**Example use:**
```bash
# Export to file
memento export --format jsonl > memories-backup.jsonl

# Process with other tools
memento export --format jsonl | jq '.[] | select(.importance > 0.8)'
```

### JSON Format

**What it is:** Structured JSON with metadata

```bash
memento export --format json
```

**Output example:**
```json
{
  "exportMetadata": {
    "timestamp": "2026-03-23T14:30:00Z",
    "totalMemories": 347,
    "exportVersion": "1.0"
  },
  "memories": [
    {
      "id": "memory_001",
      "content": "JWT token contains user ID and role",
      "tags": ["code", "decision"],
      "importance": 0.87,
      "createdAt": "2026-03-15T10:30:00Z",
      "updatedAt": "2026-03-15T10:30:00Z",
      "source": "claude-code",
      "namespace": "default",
      "relationships": [
        {
          "type": "contradicts",
          "targetId": "memory_042",
          "description": "Later decision to use OAuth2"
        }
      ]
    },
    ...
  ],
  "relationships": [
    {
      "sourceId": "memory_001",
      "targetId": "memory_042",
      "type": "contradicts",
      "description": "JWT vs OAuth2"
    }
  ]
}
```

**Why use JSON:**
- Machine-readable structure with all metadata
- Relationships and importance scores preserved
- Good for analysis and visualization
- Larger file size but more complete information

**Example use:**
```bash
# Export to file
memento export --format json > memories.json

# Analyze with tools
cat memories.json | jq '.memories | group_by(.importance) | map(length)'
# Output: [23, 67, 156, 101] (distribution of importance levels)
```

### CSV Format

**What it is:** Spreadsheet-friendly tabular format

```bash
memento export --format csv
```

**Output example:**
```csv
id,content,tags,importance,createdAt,updatedAt,source,namespace
memory_001,"JWT token contains user ID and role","code,decision",0.87,2026-03-15T10:30:00Z,2026-03-15T10:30:00Z,claude-code,default
memory_002,"Switched from JWT to OAuth2 for third-party integrations","decision,architecture",0.92,2026-03-20T14:45:00Z,2026-03-20T14:45:00Z,claude-code,default
memory_003,"PostgreSQL query optimization increased throughput 40%","performance,database",0.78,2026-03-22T09:15:00Z,2026-03-22T09:15:00Z,auto-capture,default
```

**Why use CSV:**
- Open in Excel, Google Sheets, or any spreadsheet tool
- Filter and sort memories visually
- Export to other analytics tools
- Easy for non-technical review

**Example workflow:**
```bash
# Export to CSV
memento export --format csv > memories.csv

# Open in Excel
open memories.csv

# Filter to high-importance memories
# Create pivot table by tags
# Identify trends in your memory store
```

**Limitations:**
- Long content is truncated (shows first 500 characters)
- Relationships not included (use JSON for full relationship data)
- Multiple tags shown as comma-separated values

### Markdown Format

**What it is:** Human-readable documentation format

```bash
memento export --format markdown
```

**Output example:**
```markdown
# Memory Export
**Export Date:** 2026-03-23 at 14:30 UTC
**Total Memories:** 347

---

## Memory: JWT Token Implementation
- **ID:** memory_001
- **Importance:** 0.87 / 1.0
- **Created:** 2026-03-15
- **Tags:** code, decision
- **Source:** claude-code

JWT token contains user ID and role. Used for stateless authentication across microservices.

**Related Memories:**
- → contradicts → Switched from JWT to OAuth2 (memory_042)
- ← elaborates ← JWT refresh token rotation (memory_089)

---

## Memory: OAuth2 Implementation
- **ID:** memory_042
- **Importance:** 0.92 / 1.0
- **Created:** 2026-03-20
- **Tags:** decision, architecture
- **Source:** claude-code

Switched from JWT to OAuth2 for third-party integrations. Provides better delegation and revocation capabilities.

**Supersedes:** memory_001

---

## Memory Statistics
- **Total:** 347
- **Average Importance:** 0.71
- **Most Common Tags:** code (156), decision (89), architecture (67)
```

**Why use Markdown:**
- Human-readable in any text editor
- Preserves relationships and hierarchy
- Perfect for documentation and reviews
- Can be committed to version control
- Great for sharing with non-technical stakeholders

**Example use:**
```bash
# Export to file
memento export --format markdown > MEMORIES.md

# Commit to Git
git add MEMORIES.md
git commit -m "Back up memories at end of week"

# Share with team
# Push to repository, everyone can read
```

## Memory Import: Bringing Memories Back

### Basic Import

```bash
memento import memories-backup.jsonl
```

### Import with Tag Merging

When importing memories that already exist, you can:

1. **Replace** (default): New memories overwrite old ones
```bash
memento import memories.json --onDuplicate replace
```

2. **Merge**: Combine tags from both versions
```bash
memento import memories.json --onDuplicate merge
```

Old tags: `["code", "decision"]`
New tags: `["code", "refactoring"]`
Result: `["code", "decision", "refactoring"]`

3. **Skip**: Keep existing memories, ignore imported duplicates
```bash
memento import memories.json --onDuplicate skip
```

### Import to Different Namespace

Namespaces let you organize memories by project:

```bash
memento import memories.json --namespace project-2026
```

This creates all memories under `project-2026` namespace instead of `default`.

### Import Options

```bash
memento import <file> \
  --format json \
  --namespace default \
  --onDuplicate merge \
  --tags "imported,2026-q1"
```

**Options:**
- `--format` (json, jsonl, csv, markdown): Auto-detected if omitted
- `--namespace`: Import into specific project namespace
- `--onDuplicate`: How to handle duplicates (replace, merge, skip)
- `--tags`: Additional tags to add to all imported memories

## Round-Trip Workflow: Export → Edit → Import

A powerful pattern for bulk editing:

### Step 1: Export

```bash
memento export --format json > memories-edit.json
```

### Step 2: Edit in Your Editor

Open `memories-edit.json` in your text editor:

```json
{
  "memories": [
    {
      "id": "memory_001",
      "content": "OLD CONTENT",
      "tags": ["old-tag"]
      // ... edit this ...
    }
  ]
}
```

Change to:

```json
{
  "memories": [
    {
      "id": "memory_001",
      "content": "UPDATED CONTENT with new details",
      "tags": ["old-tag", "updated"]
      // ... done editing ...
    }
  ]
}
```

### Step 3: Import Back

```bash
memento import memories-edit.json --onDuplicate merge
```

**Use cases:**
- Bulk tag updates: Add a tag to 100 memories at once
- Fix typos in exported content
- Add relationships or updates
- Reorganize memories across namespaces

## Backup Strategy Recommendations

### Daily Backups

Automated backup script (`backup-memories.sh`):

```bash
#!/bin/bash
BACKUP_DIR="$HOME/.claude-memory-backups"
DATE=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR"

# Create compressed backup
memento export --format json | gzip > "$BACKUP_DIR/memories-$DATE.json.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "memories-*.json.gz" -mtime +30 -delete

echo "Backup created: memories-$DATE.json.gz"
```

Run daily with cron:

```bash
# Add to crontab
0 2 * * * /path/to/backup-memories.sh
```

### Weekly Archive Backups

```bash
# Weekly comprehensive backup (all formats)
memento export --format json > memories-archive-$(date +%Y-w%V).json
memento export --format markdown > memories-archive-$(date +%Y-w%V).md
memento export --format csv > memories-archive-$(date +%Y-w%V).csv

# Commit to version control
git add memories-archive-*.{json,md,csv}
git commit -m "Weekly memory export"
```

### Cloud Backup

Sync to cloud storage:

```bash
# Using iCloud (macOS)
memento export --format json > ~/Library/Mobile\ Documents/com~apple~CloudDocs/memento-backup.json

# Using Google Drive
memento export --format json > ~/Google\ Drive/My\ Drive/memento-backup.json

# Using Dropbox
memento export --format json > ~/Dropbox/memento-backup.json

# Using S3
memento export --format json | aws s3 cp - s3://my-bucket/memento-backup.json
```

## Migrating from Other Tools

### From Obsidian Vault

If you use Obsidian for notes, migrate to Memento:

```bash
# 1. Export your Obsidian vault as JSON or markdown
# (Use Obsidian's "Export notes" plugin or export manually)

# 2. Ingest Obsidian notes into Memento
for file in ~/Obsidian/vault/**/*.md; do
  memento ingest "$file"
done

# 3. Verify import
memento stats
```

### From Notion Database

Export from Notion as CSV or JSON, then import:

```bash
# 1. Export Notion database as JSON

# 2. Create mapping script (notion-to-memento.js):
const notion = require('./notion-export.json');
const memento = notion.data.map(item => ({
  content: item.content,
  tags: item.tags.split(','),
  importance: item.importance || 0.5,
  createdAt: item.created
}));

// 3. Import
memento import --format json < memento-converted.json
```

### From Text Files

If you have memories in scattered text files:

```bash
# Bulk ingest all markdown files
find ~/notes -name "*.md" -exec memento ingest {} \;

# Or create a script to parse and import
for file in ~/notes/*.txt; do
  content=$(cat "$file")
  tags=$(basename "$file" .txt | tr '-' ',')
  memento save "$content" --tags "$tags"
done
```

## Example: Team Memory Sharing

**Scenario:** Your team wants to share a common knowledge base

### Step 1: Export Shared Memories

```bash
# Export only high-importance architecture memories
memento export --format markdown \
  --filter 'tags:architecture AND importance > 0.8' \
  > team-architecture-knowledge.md
```

### Step 2: Share File

```bash
# Commit to team repository
git add docs/architecture-knowledge.md
git commit -m "Document shared architectural decisions"
git push
```

### Step 3: Team Members Import

Each team member imports into their local Memento:

```bash
memento import docs/architecture-knowledge.md \
  --namespace team-shared \
  --tags "team,shared,2026-q1"
```

### Step 4: Personal Additions

Each member continues using their own memories locally, while always having access to shared architectural decisions.

## Performance During Export

**Export times by store size:**
- 100 memories: < 1 second
- 1,000 memories: 1-2 seconds
- 10,000 memories: 5-10 seconds

**File sizes:**
- JSONL (most compact): ~2KB per memory
- JSON: ~3KB per memory
- CSV: ~1KB per memory
- Markdown: ~4KB per memory (most verbose)

For large exports, consider:
```bash
# Export in chunks
memento export --format jsonl --limit 1000 --offset 0 > chunk-1.jsonl
memento export --format jsonl --limit 1000 --offset 1000 > chunk-2.jsonl
```

---

Export and import turn Memento into a flexible tool that integrates with your broader knowledge management system. Whether you're backing up, sharing with teammates, or migrating from other tools, these formats ensure your memories stay portable and accessible.
