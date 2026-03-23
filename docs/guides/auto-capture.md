# Auto-Capture Guide

## What is Auto-Capture?

Auto-capture is Memento's background system that automatically saves conversation context and tool outputs into your memory store without requiring manual intervention. Instead of remembering to call `memory_save` after each important interaction, Memento watches what you do and intelligently captures the most valuable information.

This guide explains how auto-capture works, what it captures, and how to tune it for your workflow.

## How Auto-Capture Works: The Two Hooks

Memento uses two hooks to detect when important information appears:

### 1. PostToolUse Hook

The PostToolUse hook fires every time you use a Claude Code tool (Bash, Read, Write, Edit, Glob, Grep, etc.). It examines:
- What tool you used
- The output/result
- Whether the output is substantial enough to remember

### 2. Stop Hook

The Stop hook fires when your conversation session ends (or when you explicitly end a message). It captures:
- The final state of your work
- Summary-level context about what you accomplished
- Pending items or decisions

## What Gets Captured: The Smart Filter

**Not everything gets captured.** Memento applies intelligent filtering to avoid bloating your memory with noise.

### Tools That Trigger Capture

**YES, these tools' outputs are captured:**
- **Write** — New files are always worth remembering
- **Edit** — File modifications, especially bug fixes
- **Bash** — Command outputs (see size rules below)
- **NotebookEdit** — Jupyter notebook changes

**NO, these tools are ignored:**
- **Read** — File content is already on disk; capturing it duplicates storage
- **Glob** — File listings are temporary; the actual files matter more
- **Grep** — Search results are derivable; patterns matter more than matches

This prevents redundant storage while keeping decision-critical information.

### Size Filter: Minimum 50 Characters

An output must be at least 50 characters (roughly 10-15 words) to be captured. This filters out:
- Single-line confirmations: `"File created successfully."`
- Empty results: `"No matches found."`
- Noise

But captures:
- Error messages with context
- Multi-line terminal output
- Code snippets
- Decision rationales

### Memory Tools Are Never Captured

To prevent infinite loops, auto-capture ignores the memory tools themselves:
- `memory_save`
- `memory_recall`
- `memory_search`
- `memory_list`
- `memory_health`
- `memory_export`
- `memory_import`
- `memory_index`
- `memory_ingest`

You can safely use `memory_save` to manually capture things without triggering re-capture.

## The Capture Queue: Background Processing

When auto-capture detects something worth saving, it doesn't block your work. Instead, it writes to a **queue file**:

```
~/.claude-memory/capture-queue.jsonl
```

Each line is a JSON object describing an item to capture:

```json
{"id":"abc123","tool":"Write","path":"/Users/me/project/auth.ts","output":"Added JWT validation...","timestamp":"2026-03-23T14:30:00Z","sourceFile":"auth.ts","priority":"high"}
{"id":"abc124","tool":"Edit","path":"/Users/me/project/config.ts","output":"Fixed environment variable handling","timestamp":"2026-03-23T14:31:00Z","sourceFile":"config.ts","priority":"medium"}
```

### How the Background Worker Processes the Queue

A background worker runs periodically (every 5-10 seconds by default) and:

1. **Reads** the queue file
2. **Extracts** tags, entities, and relationships from each item
3. **Deduplicates** (avoids saving nearly-identical memories)
4. **Stores** in your vector database
5. **Removes** processed lines from the queue

This happens asynchronously, so your Claude session never waits for capture to complete.

### When the Queue Gets Stuck

If the background worker crashes or encounters errors:
- Items stay in the queue (safe, can be retried)
- You can manually trigger processing:
  ```bash
  # Check the queue
  cat ~/.claude-memory/capture-queue.jsonl

  # Manually trigger a capture worker run
  npm run worker:once
  ```

## Verifying Auto-Capture Is Working

### Step 1: Check the Queue

After doing some work, check the queue file:

```bash
tail -n 5 ~/.claude-memory/capture-queue.jsonl
```

You should see recent entries. Example:

```json
{"id":"item-001","tool":"Write","output":"Created database schema...","timestamp":"2026-03-23T14:30:00Z"}
{"id":"item-002","tool":"Edit","output":"Added error handling...","timestamp":"2026-03-23T14:31:00Z"}
```

If the queue is empty, either:
- No capture-eligible tools have been used yet
- The worker already processed everything

### Step 2: Check Memory Store Growth

Use the memory stats tool:

```bash
memento stats
```

Output:

```
Memory Store Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total entries:        47
Entries by tag:
  · code:             23
  · decision:         8
  · error:            4
  · todo:             3
  · other:            9

Recent additions:
  · 2026-03-23 14:30 Added JWT validation (from Write tool)
  · 2026-03-23 14:29 Fixed race condition (from Edit tool)
  · 2026-03-23 14:27 Bash output: npm run test results (from Bash tool)

Store size: 2.3 MB
Last compaction: 2026-03-20 09:15
```

### Step 3: Recall and Verify

Recall memory from your work:

```bash
memento recall "JWT authentication bug fix"
```

You should see captured items appear in results with recent timestamps.

## Adjusting Capture Behavior

### Enable/Disable Auto-Capture

In `~/.claude-memory/config.json`:

```json
{
  "capture": {
    "enabled": true,
    "minOutputLength": 50
  }
}
```

Set `enabled: false` to turn off auto-capture entirely.

### Change the Minimum Output Length

To capture even small outputs:

```json
{
  "capture": {
    "minOutputLength": 20
  }
}
```

Or to be more selective:

```json
{
  "capture": {
    "minOutputLength": 200
  }
}
```

### Ignore Specific Tools

To skip capturing from certain tools:

```json
{
  "capture": {
    "ignoredTools": ["Read", "Glob", "Grep", "Bash"]
  }
}
```

### Adjust Worker Frequency

To process the queue more or less often:

```json
{
  "capture": {
    "workerIntervalMs": 10000
  }
}
```

Default is 5000-10000 ms. Higher values = less frequent processing but less overhead.

## Real-World Scenario

**Your workflow:**

1. You use Claude Code to create a new authentication module
2. You write `auth.ts` with JWT logic
3. Auto-capture detects the Write tool and queues this:
   ```json
   {"tool":"Write","path":"auth.ts","output":"Implemented JWT validation..."}
   ```

4. You then use Edit to fix a bug in the module
5. Auto-capture queues this:
   ```json
   {"tool":"Edit","path":"auth.ts","output":"Fixed token expiration check..."}
   ```

6. You run tests with Bash, get output confirming all pass
7. Auto-capture checks: output is 300+ characters ✓, tool is Bash ✓, queues it:
   ```json
   {"tool":"Bash","output":"PASS: 47 tests passed in 2.3s"}
   ```

8. The background worker processes the queue automatically
9. Later, you recall: `memory_recall "JWT authentication"`
10. Results include all three captured items with relationships showing they're all about the same feature

Auto-capture just saved you from manually remembering to document your work!

## Troubleshooting

**Q: Queue keeps growing, never empties**
A: Check for background worker crashes. Run `memento health` to verify worker status. Restart with `npm run server`.

**Q: Small outputs are being captured when I don't want them**
A: Increase `minOutputLength` in config.json.

**Q: Too much noise is being captured**
A: Add tools to `ignoredTools` or enable more selective settings.

**Q: I want to prevent capturing sensitive outputs**
A: Use `memory_save` instead with a redacted version, or configure `capture.filter` to redact patterns.

---

Auto-capture is designed to run invisibly in the background, capturing what matters and letting you focus on coding. Check your memory store regularly with `memory_stats` to verify it's growing as expected.
