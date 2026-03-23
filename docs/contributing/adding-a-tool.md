# Adding a New MCP Tool to Memento

This guide walks through adding a new tool from start to finish. We'll use a real example: adding a hypothetical `stats` tool that returns memory statistics.

---

## Overview

A tool is an MCP-compliant function that:
1. Takes Zod-validated parameters
2. Executes a business operation (e.g., save, search, delete)
3. Returns a structured result
4. Is registered with the MCP server

**Process**:
```
1. Create tool file (src/tools/stats.ts)
2. Define Zod parameter schema
3. Implement handler function
4. Register in src/tools/index.ts
5. Add tests (tests/tools/stats.test.ts)
6. Update documentation
7. Update CHANGELOG.md
```

---

## Step 1: Create Tool File

Create `src/tools/stats.ts`:

```typescript
import { z } from 'zod';
import type { MemoryManager } from '../memory/manager.js';

/**
 * Zod schema for the stats tool parameters.
 * Defines what inputs the tool accepts and validates them.
 */
export const statsSchema = z.object({
  namespace: z
    .string()
    .optional()
    .describe('Project namespace (default: current project)'),
  includeDetails: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include breakdown by tag'),
});

export type StatsParams = z.infer<typeof statsSchema>;

/**
 * Returns memory statistics for a namespace.
 *
 * Shows:
 * - Total memory count
 * - Count by tag (code, error, decision, etc.)
 * - Total storage size
 * - Oldest and newest memory dates
 * - Average importance score
 *
 * @param manager - MemoryManager instance
 * @param params - Tool parameters
 * @returns Statistics object
 * @throws {MemoryError} If namespace doesn't exist
 *
 * @example
 * const stats = await handleStats(manager, { namespace: 'my-project' });
 * console.log(`Total memories: ${stats.totalMemories}`);
 */
export async function handleStats(
  manager: MemoryManager,
  params: StatsParams,
): Promise<{
  totalMemories: number;
  totalSize: string;
  byTag: Record<string, number>;
  oldestMemory: string | null;
  newestMemory: string | null;
  avgImportance: number;
  successRate: number;
}> {
  const namespace = params.namespace || 'default';

  try {
    // Get statistics from manager
    const stats = await manager.getStats(namespace);

    return {
      totalMemories: stats.count,
      totalSize: formatBytes(stats.sizeBytes),
      byTag: params.includeDetails ? stats.tagCounts : {},
      oldestMemory: stats.oldestDate?.toISOString() || null,
      newestMemory: stats.newestDate?.toISOString() || null,
      avgImportance: Math.round(stats.avgImportance * 100) / 100,
      successRate: stats.successRate,
    };
  } catch (error) {
    throw new Error(`Failed to get stats: ${error.message}`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
```

### Key Points

1. **Zod Schema**: Validates all inputs
   - `.optional()` for optional parameters
   - `.default()` for default values
   - `.describe()` for help text

2. **Type Export**: `StatsParams = z.infer<typeof statsSchema>`
   - Provides TypeScript type from schema

3. **Docstring**: Explains what tool does, parameters, return value

4. **Error Handling**: Catch and wrap errors with context

5. **Helper Functions**: `formatBytes()` for presentation logic

---

## Step 2: Register Tool in tools/index.ts

Add to `src/tools/index.ts`:

```typescript
import { z } from 'zod';
import {
  handleStats,
  statsSchema,
  type StatsParams,
} from './stats.js';
// ... other imports ...

/**
 * Register all MCP tools with the server.
 *
 * This function is called once at startup and wires up:
 * - Tool name and description
 * - Parameter schema
 * - Handler function
 * - Error handling
 */
export async function registerAllTools(server: Server) {
  // ... existing tools ...

  /**
   * Memory statistics tool
   */
  server.setRequestHandler(Tool.StatsMembersRequest, async (request) => {
    try {
      const params = statsSchema.parse(request.arguments);
      const result = await handleStats(manager, params);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleToolError('stats', error);
    }
  });

  // List the tool (returned when LLM asks what tools are available)
  server.addTool({
    name: 'stats',
    description:
      'Get memory statistics for a namespace. Shows counts, sizes, ' +
      'and metadata about stored memories.',
    inputSchema: {
      type: 'object',
      properties: {
        namespace: {
          type: 'string',
          description: 'Project namespace (default: current)',
        },
        includeDetails: {
          type: 'boolean',
          description: 'Include breakdown by tag',
        },
      },
      required: [],
    },
  });
}
```

### Registration Pattern

1. **Tool Handler**: Catches requests, validates inputs, calls handler
2. **Error Handling**: Wrap in try/catch, use `handleToolError()`
3. **Tool Definition**: Register with MCP server so it shows up in `/list`

---

## Step 3: Add Tests

Create `tests/tools/stats.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleStats, statsSchema } from '../../src/tools/stats.js';
import type { MemoryManager } from '../../src/memory/manager.js';

describe('Stats Tool', () => {
  let mockManager: MemoryManager;

  beforeEach(() => {
    mockManager = {
      getStats: vi.fn().mockResolvedValue({
        count: 42,
        sizeBytes: 1024 * 100, // 100 KB
        tagCounts: { code: 20, error: 10, decision: 12 },
        oldestDate: new Date('2026-01-01'),
        newestDate: new Date('2026-03-23'),
        avgImportance: 0.75,
        successRate: 0.99,
      }),
    } as unknown as MemoryManager;
  });

  describe('statsSchema', () => {
    it('should validate namespace parameter', () => {
      const result = statsSchema.parse({ namespace: 'my-project' });
      expect(result.namespace).toBe('my-project');
    });

    it('should default includeDetails to false', () => {
      const result = statsSchema.parse({});
      expect(result.includeDetails).toBe(false);
    });

    it('should reject invalid parameters', () => {
      expect(() => {
        statsSchema.parse({ namespace: 123 }); // Wrong type
      }).toThrow();
    });
  });

  describe('handleStats()', () => {
    it('should return statistics', async () => {
      const result = await handleStats(mockManager, {
        namespace: 'my-project',
      });

      expect(result).toMatchObject({
        totalMemories: 42,
        totalSize: '100 KB',
        avgImportance: 0.75,
        successRate: 0.99,
      });
    });

    it('should include tag breakdown when requested', async () => {
      const result = await handleStats(mockManager, {
        namespace: 'my-project',
        includeDetails: true,
      });

      expect(result.byTag).toEqual({
        code: 20,
        error: 10,
        decision: 12,
      });
    });

    it('should exclude tag breakdown by default', async () => {
      const result = await handleStats(mockManager, {
        namespace: 'my-project',
      });

      expect(result.byTag).toEqual({});
    });

    it('should format dates as ISO strings', async () => {
      const result = await handleStats(mockManager, {});

      expect(result.oldestMemory).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.newestMemory).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle missing dates', async () => {
      mockManager.getStats = vi.fn().mockResolvedValue({
        count: 0,
        sizeBytes: 0,
        tagCounts: {},
        oldestDate: null,
        newestDate: null,
        avgImportance: 0,
        successRate: 1,
      });

      const result = await handleStats(mockManager, {});

      expect(result.oldestMemory).toBeNull();
      expect(result.newestMemory).toBeNull();
    });

    it('should throw on manager error', async () => {
      mockManager.getStats = vi
        .fn()
        .mockRejectedValue(new Error('Namespace not found'));

      await expect(
        handleStats(mockManager, { namespace: 'nonexistent' }),
      ).rejects.toThrow('Failed to get stats');
    });
  });

  describe('byte formatting', () => {
    it('should format bytes correctly', async () => {
      mockManager.getStats = vi
        .fn()
        .mockResolvedValue({
          count: 1,
          sizeBytes: 1536, // 1.5 KB
          tagCounts: {},
          oldestDate: null,
          newestDate: null,
          avgImportance: 0,
          successRate: 1,
        });

      const result = await handleStats(mockManager, {});
      expect(result.totalSize).toBe('1.5 KB');
    });

    it('should format MB correctly', async () => {
      mockManager.getStats = vi
        .fn()
        .mockResolvedValue({
          count: 1000,
          sizeBytes: 1024 * 1024 * 5, // 5 MB
          tagCounts: {},
          oldestDate: null,
          newestDate: null,
          avgImportance: 0,
          successRate: 1,
        });

      const result = await handleStats(mockManager, {});
      expect(result.totalSize).toBe('5 MB');
    });
  });
});
```

### Test Coverage

- **Schema validation**: Valid and invalid inputs
- **Happy path**: Normal operation
- **Options**: Test each option flag
- **Edge cases**: Empty data, null values
- **Error cases**: Manager throws error
- **Formatting**: Bytes, dates, numbers

Run tests: `npm test tests/tools/stats.test.ts`

---

## Step 4: Update Documentation

### Add to README.md

In the tools table:

```markdown
| Tool | Purpose | Example |
|------|---------|---------|
| stats | Get memory statistics | `memento stats --namespace my-project` |
```

### Create docs/reference/tools.md entry

Add section:

```markdown
## stats

Returns memory statistics for a namespace.

**Parameters**:
- `namespace` (string, optional): Project namespace
- `includeDetails` (boolean, optional): Include tag breakdown

**Returns**:
- `totalMemories` (number): Total memory count
- `totalSize` (string): Formatted storage size
- `byTag` (object): Count by tag type
- `oldestMemory` (ISO 8601): Oldest memory date
- `newestMemory` (ISO 8601): Newest memory date
- `avgImportance` (number): Average importance score
- `successRate` (number): Percentage successful operations

**Example**:
\`\`\`bash
memento recall "stats" --namespace my-project --details
\`\`\`

**Output**:
\`\`\`json
{
  "totalMemories": 42,
  "totalSize": "2.3 MB",
  "byTag": {
    "code": 20,
    "error": 10,
    "decision": 12
  },
  "oldestMemory": "2026-01-01T00:00:00Z",
  "newestMemory": "2026-03-23T10:45:30Z",
  "avgImportance": 0.75,
  "successRate": 0.99
}
\`\`\`
```

---

## Step 5: Update CHANGELOG.md

Add to `[Unreleased]` section:

```markdown
## [Unreleased]

### Added
- [FEATURE] New `stats` tool returns memory statistics per namespace
  - Shows counts, sizes, dates, and importance scores
  - Optional detailed breakdown by tag type
  - Helps users understand memory storage usage (PR #156)
```

---

## Step 6: Verification Checklist

Before submitting PR:

- [ ] Tool file created: `src/tools/stats.ts`
- [ ] Handler function implemented with docstring
- [ ] Zod schema validates all parameters
- [ ] Tool registered in `src/tools/index.ts`
- [ ] MCP tool definition added with description
- [ ] Error handling wraps errors with context
- [ ] Tests cover happy path and error cases
- [ ] Tests cover all parameter options
- [ ] Coverage >= 80%
- [ ] Documentation added to README.md
- [ ] Tool reference added to docs/reference/tools.md
- [ ] CHANGELOG.md updated
- [ ] Code style: `npm run lint` passes
- [ ] Types: `npx tsc --noEmit` passes
- [ ] Tests: `npm test` passes

---

## Real Example: Recall Tool

Here's how the existing `recall` tool is implemented:

**File**: `src/tools/recall.ts`

```typescript
export const recallSchema = z.object({
  query: z.string().describe('Search query (semantic or keywords)'),
  limit: z
    .number()
    .int()
    .default(10)
    .describe('Max results to return'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Filter by tags'),
  namespace: z.string().optional().describe('Project namespace'),
  startDate: z
    .string()
    .datetime()
    .optional()
    .describe('Filter: memories after date'),
  endDate: z
    .string()
    .datetime()
    .optional()
    .describe('Filter: memories before date'),
});

export async function handleRecall(
  manager: MemoryManager,
  params: RecallParams,
): Promise<SearchResult[]> {
  const filters = {
    tags: params.tags,
    namespace: params.namespace,
    startDate: params.startDate ? new Date(params.startDate) : undefined,
    endDate: params.endDate ? new Date(params.endDate) : undefined,
  };

  return manager.recall(params.query, params.limit, filters);
}
```

This tool:
- Takes 6 parameters (1 required, 5 optional)
- Validates date format with `.datetime()`
- Converts date strings to Date objects
- Passes filters to manager
- Returns SearchResult[]

---

## Common Patterns

### Tools That Create Data

```typescript
export const createSchema = z.object({
  text: z.string().min(1, 'Text required'),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function handleCreate(manager, params) {
  // Validation happens automatically via schema
  const id = await manager.save(
    params.text,
    params.tags,
    params.metadata,
  );
  return { id, created: true };
}
```

### Tools That List Data

```typescript
export const listSchema = z.object({
  namespace: z.string().optional(),
  tag: z.string().optional(),
  sort: z.enum(['created', 'modified', 'accessed']).optional(),
  limit: z.number().default(50),
});

export async function handleList(manager, params) {
  return manager.list({
    namespace: params.namespace,
    filter: { tag: params.tag },
    sort: params.sort,
    limit: params.limit,
  });
}
```

### Tools That Delete Data

```typescript
export const deleteSchema = z.object({
  id: z.string().describe('Memory ID to delete'),
  confirm: z.boolean().describe('Confirm deletion'),
});

export async function handleDelete(manager, params) {
  if (!params.confirm) {
    throw new Error('Deletion not confirmed');
  }

  const deleted = await manager.delete(params.id);
  return { id: params.id, deleted };
}
```

---

## Summary

1. **Create tool file** (`src/tools/stats.ts`) with handler function
2. **Define Zod schema** for parameter validation
3. **Register tool** in `src/tools/index.ts`
4. **Add tests** covering all paths and edge cases
5. **Document** in README and docs/reference
6. **Update CHANGELOG** with feature description
7. **Verify** with lint, type-check, and test commands

Tools are the user-facing API of Memento. Make them well-tested, well-documented, and consistent with existing tools!
