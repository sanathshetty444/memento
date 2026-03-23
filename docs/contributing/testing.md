# Testing Guide

This document explains how to write, run, and maintain tests for Memento. Testing is critical to reliability and is required for all contributions.

---

## Overview

**Test Framework**: Vitest (Vite's testing framework)
**Test Language**: TypeScript
**Target Coverage**: 80% (lines, functions, branches, statements)
**Test Files**: 12 files, 104 tests across all modules

---

## Vitest Setup

### Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,              // Use global describe/it/expect
    environment: 'node',        // Run in Node.js environment
    coverage: {
      provider: 'v8',           // Use V8 coverage
      reporter: ['text', 'html', 'lcov'],
      lines: 80,                // 80% line coverage threshold
      functions: 80,
      branches: 80,
      statements: 80,
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
      ],
    },
    include: ['tests/**/*.test.ts'],
    hookTimeout: 10000,         // 10s timeout for hooks
    testTimeout: 10000,         // 10s timeout per test
  },
});
```

### Running Tests

```bash
# Run all tests once
npm test

# Run in watch mode (re-run on file change)
npm run test:watch

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test -- tests/memory/chunker.test.ts

# Run tests matching pattern
npm test -- --grep "chunk boundary"

# Run with UI dashboard
npm test -- --ui
```

---

## Test File Structure

### Naming Convention

- **Location**: `tests/` directory (mirrors `src/`)
- **Naming**: `{module}.test.ts` (e.g., `chunker.test.ts`)
- **Pattern**: Each src file has corresponding test file

```
src/
  memory/
    chunker.ts          →  tests/memory/chunker.test.ts
    redactor.ts         →  tests/memory/redactor.test.ts
  storage/
    local.ts            →  tests/storage/local.test.ts
  tools/
    save.ts             →  tests/tools/save.test.ts
```

### Test File Template

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chunker } from '../../src/memory/chunker.js';
import type { Memory } from '../../src/types.js';

describe('Chunker', () => {
  describe('chunk boundary detection', () => {
    it('should split on paragraph boundaries', () => {
      // Arrange
      const text = 'First paragraph.\n\nSecond paragraph.';

      // Act
      const chunks = chunker.chunk(text);

      // Assert
      expect(chunks).toHaveLength(2);
      expect(chunks[0].text).toContain('First');
      expect(chunks[1].text).toContain('Second');
    });

    it('should handle edge cases', () => {
      // ...
    });
  });

  describe('error handling', () => {
    it('should throw on empty text', () => {
      expect(() => {
        chunker.chunk('');
      }).toThrow('Text cannot be empty');
    });
  });
});
```

---

## Test Organization

### Describe Blocks

Group related tests with `describe()`:

```typescript
describe('Memory Manager', () => {
  describe('save()', () => {
    it('should save memory with tags', () => {});
    it('should redact sensitive data', () => {});
    it('should deduplicate near-duplicates', () => {});
  });

  describe('recall()', () => {
    it('should find memories by vector similarity', () => {});
    it('should filter by tags', () => {});
    it('should filter by date range', () => {});
  });

  describe('error handling', () => {
    it('should throw on invalid input', () => {});
  });
});
```

### Test Structure: Arrange-Act-Assert

Each test follows AAA pattern:

```typescript
it('should chunk text on paragraph boundaries', () => {
  // ARRANGE: Set up test data
  const text = 'Paragraph 1.\n\nParagraph 2.';
  const chunker = new Chunker();

  // ACT: Call the function
  const chunks = chunker.chunk(text);

  // ASSERT: Verify the result
  expect(chunks).toHaveLength(2);
  expect(chunks[0].text).toMatch(/Paragraph 1/);
});
```

---

## Assertion Patterns

### Common Assertions

```typescript
// Equality
expect(value).toBe(5);
expect(obj).toEqual({ name: 'John' });
expect(text).toMatch(/pattern/);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();

// Collections
expect(array).toHaveLength(3);
expect(array).toContain('item');
expect(object).toHaveProperty('key');

// Exceptions
expect(() => { throw new Error(); }).toThrow();
expect(() => { throw new Error('msg'); }).toThrow('msg');
expect(async () => { await promise(); }).rejects.toThrow();

// Floating point
expect(number).toBeCloseTo(3.14159, 5); // 5 decimal places

// Snapshots
expect(largeObject).toMatchSnapshot();
```

### Custom Matchers Example

```typescript
// Define custom matcher
expect.extend({
  toBeValidMemory(received) {
    const isValid = received.id && received.text && received.timestamp;
    return {
      pass: isValid,
      message: () => `expected ${JSON.stringify(received)} to be valid memory`,
    };
  },
});

// Use in test
it('should create valid memory', () => {
  const memory = memoryManager.create('text');
  expect(memory).toBeValidMemory();
});
```

---

## Async Testing

### Testing Promises

```typescript
// Good: Return promise
it('should save memory', () => {
  return memoryManager.save('text').then(id => {
    expect(id).toBeDefined();
  });
});

// Better: Async/await
it('should save memory', async () => {
  const id = await memoryManager.save('text');
  expect(id).toBeDefined();
});

// Testing rejection
it('should reject on empty text', async () => {
  await expect(
    memoryManager.save('')
  ).rejects.toThrow('Text cannot be empty');
});
```

### Async Hooks

```typescript
describe('Storage', () => {
  let storage: Storage;

  beforeEach(async () => {
    // Runs before each test
    storage = new Storage();
    await storage.initialize();
  });

  afterEach(async () => {
    // Runs after each test
    await storage.cleanup();
  });

  it('should save and retrieve', async () => {
    // storage is initialized and ready
  });
});
```

---

## Mocking

### Mocking Modules

```typescript
import { vi } from 'vitest';
import { manager } from '../../src/memory/manager.js';

// Mock entire module
vi.mock('../../src/storage/local.js', () => ({
  LocalStore: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue('mem-id'),
    search: vi.fn().mockResolvedValue([]),
  })),
}));

describe('Manager', () => {
  it('should call storage.save()', async () => {
    await manager.save('text', []);
    expect(mockStorage.save).toHaveBeenCalled();
  });
});
```

### Mocking Functions

```typescript
it('should call embeddings provider', async () => {
  const mockEmbed = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
  const embeddings = { embed: mockEmbed };

  await manager.embed('text', embeddings);

  expect(mockEmbed).toHaveBeenCalledWith('text');
});
```

### Mocking Return Values

```typescript
const mockFetch = vi.fn();

// First call returns one value
mockFetch.mockResolvedValueOnce({ ok: true, data: [1, 2, 3] });

// Second call returns another
mockFetch.mockResolvedValueOnce({ ok: false, error: 'timeout' });

// All subsequent calls
mockFetch.mockResolvedValue({ ok: true, data: [] });

expect(await mockFetch()).toEqual({ ok: true, data: [1, 2, 3] });
expect(await mockFetch()).toEqual({ ok: false, error: 'timeout' });
expect(await mockFetch()).toEqual({ ok: true, data: [] });
```

---

## Unit vs Integration Tests

### Unit Tests

Test a single function or module in isolation:

```typescript
// tests/memory/chunker.test.ts — UNIT TEST
describe('Chunker', () => {
  it('should split on paragraph boundaries', () => {
    // Test chunker alone, mock nothing (no dependencies)
    const chunks = chunker.chunk('Para1.\n\nPara2.');
    expect(chunks).toHaveLength(2);
  });
});
```

### Integration Tests

Test multiple modules working together:

```typescript
// tests/integration/save-workflow.test.ts — INTEGRATION TEST
describe('Save Workflow', () => {
  let manager: MemoryManager;
  let storage: VectorStore;
  let embeddings: EmbeddingProvider;

  beforeEach(async () => {
    // Create real instances (or close to real)
    storage = new LocalStore();
    embeddings = new LocalEmbeddings();
    manager = new MemoryManager(storage, embeddings);
    await manager.initialize();
  });

  it('should save, chunk, embed, and store memory', async () => {
    const id = await manager.save('text', ['code']);
    const result = await manager.recall('similar text');

    // Check end-to-end flow worked
    expect(result).toBeDefined();
    expect(result[0].id).toBe(id);
  });
});
```

### When to Use Each

| Type | Use When | Example |
|------|----------|---------|
| **Unit** | Testing single function | Chunker splits text correctly |
| **Integration** | Testing module interaction | Save + embed + storage flow |
| **E2E** | Testing whole system | CLI command works end-to-end |

Memento focuses on unit + integration tests. E2E is done manually.

---

## Test Coverage

### Checking Coverage

```bash
npm test -- --coverage

# Output:
# File                     | % Stmts | % Branch | % Funcs | % Lines
# -------------------------|---------|----------|---------|--------
# All files                |    82.4 |    79.2  |   85.1  |   82.1
# src/memory/chunker.ts    |    95.2 |    92.1  |   100   |   95.2
# src/storage/local.ts     |    71.3 |    65.4  |   68.9  |   71.3
```

### Coverage Goals

- **Target**: 80% across all metrics
- **Lines**: 80% of code lines executed
- **Functions**: 80% of functions called
- **Branches**: 80% of conditional branches taken
- **Statements**: 80% of statements executed

### Improving Coverage

**Identify gaps**:
```bash
npm test -- --coverage --reporter=html
# Opens HTML report in browser
```

**Add missing tests**:
```typescript
// Before: 75% coverage
it('should handle edge case', () => {
  expect(chunker.chunk('')).toThrow(); // Now 80%
});
```

**When to Exclude**:
```typescript
// Exclude non-essential code
// @vitest-ignore
export function debugLog(msg: string) {
  console.log('DEBUG:', msg);
}
```

---

## Common Test Scenarios

### Testing Error Handling

```typescript
it('should validate input', () => {
  expect(() => {
    save('');
  }).toThrow(ValidationError);
});

it('should handle network errors gracefully', async () => {
  const mockStorage = {
    save: vi.fn().mockRejectedValue(new NetworkError('timeout')),
  };

  await expect(
    manager.save('text', mockStorage)
  ).rejects.toThrow(NetworkError);
});
```

### Testing Async Operations

```typescript
it('should timeout after 5 seconds', async () => {
  vi.useFakeTimers();

  const promise = manager.search('query', { timeout: 5000 });

  // Fast-forward 5 seconds
  vi.advanceTimersByTime(5000);

  await expect(promise).rejects.toThrow(TimeoutError);

  vi.useRealTimers();
});
```

### Testing Complex Objects

```typescript
it('should create valid memory', () => {
  const memory = manager.create('text', ['code']);

  expect(memory).toMatchObject({
    id: expect.any(String),
    text: 'text',
    tags: ['code'],
    timestamp: expect.any(Date),
  });
});

// Or use snapshot
it('should maintain memory structure', () => {
  const memory = manager.create('text', ['code']);
  expect(memory).toMatchSnapshot();
});
```

### Testing Callbacks

```typescript
it('should call callback on completion', async () => {
  const callback = vi.fn();

  await manager.save('text', [], { onComplete: callback });

  expect(callback).toHaveBeenCalledWith('mem-id');
});
```

---

## Test Fixtures and Factories

### Reusable Test Data

```typescript
// tests/fixtures.ts
export function createMemory(overrides?: Partial<Memory>): Memory {
  return {
    id: 'mem-1',
    text: 'Test memory text',
    tags: ['test'],
    namespace: 'test-ns',
    timestamp: new Date(),
    accessCount: 0,
    ...overrides,
  };
}

export function createStorage(): VectorStore {
  return {
    save: vi.fn().mockResolvedValue('mem-id'),
    search: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
    health: vi.fn().mockResolvedValue(true),
  };
}

// Usage in tests
it('should process memory', () => {
  const memory = createMemory({ tags: ['code'] });
  const storage = createStorage();

  manager.save(memory, storage);
  expect(storage.save).toHaveBeenCalled();
});
```

---

## Before/After Hooks

### Setup and Teardown

```typescript
describe('Memory Manager', () => {
  let manager: MemoryManager;
  let storage: VectorStore;

  beforeAll(async () => {
    // Runs once before all tests in this describe block
    console.log('Starting test suite');
  });

  beforeEach(async () => {
    // Runs before each test
    storage = createStorage();
    manager = new MemoryManager(storage);
  });

  afterEach(async () => {
    // Runs after each test
    await manager.cleanup();
  });

  afterAll(async () => {
    // Runs once after all tests
    console.log('Test suite complete');
  });

  it('test 1', () => {});
  it('test 2', () => {});
});
```

---

## Performance Testing

### Timing Tests

```typescript
it('should chunk 1000 items in < 100ms', () => {
  const items = Array(1000).fill('text');
  const start = performance.now();

  const chunks = items.flatMap(t => chunker.chunk(t));

  const elapsed = performance.now() - start;
  expect(elapsed).toBeLessThan(100);
});
```

### Benchmark Suite

```typescript
import { bench } from 'vitest';

describe('Benchmarks', () => {
  bench('chunking 10KB text', () => {
    chunker.chunk(largeText);
  });

  bench('embedding 384-dim vector', () => {
    storage.saveVector(vector);
  });
});

// Run: npm test -- benchmarks
```

---

## Debugging Tests

### Logging in Tests

```typescript
it('should process memory', () => {
  const memory = createMemory();

  console.log('Memory:', memory);
  const result = manager.save(memory);
  console.log('Result:', result);

  expect(result).toBeDefined();
});
```

### Interactive Debugging

```bash
# Run tests with Node debugger
node --inspect-brk ./node_modules/vitest/vitest.mjs run

# Then open chrome://inspect in Chrome
```

### Focused Tests

```typescript
// Run only this test
it.only('focused test', () => {
  expect(true).toBe(true);
});

// Skip this test
it.skip('skipped test', () => {
  // not run
});

// Mark as todo
it.todo('not yet implemented', () => {
  // skipped, reminder to implement
});
```

---

## Best Practices Checklist

- [ ] Test file mirrors source file structure
- [ ] Each test has Arrange-Act-Assert sections
- [ ] Tests have descriptive names (what is being tested)
- [ ] Test both success and failure paths
- [ ] Mock external dependencies
- [ ] Use fixtures for reusable test data
- [ ] Async tests use proper async/await
- [ ] Error tests verify specific error types
- [ ] Coverage is above 80%
- [ ] Tests run in < 5 seconds
- [ ] No console.log in final code
- [ ] No hardcoded timeouts (use fake timers)

---

## Example Test File

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { chunker } from '../../src/memory/chunker.js';
import type { Chunk } from '../../src/types.js';

describe('Chunker', () => {
  describe('chunk()', () => {
    it('should split on paragraph boundaries', () => {
      const text = 'Paragraph 1.\n\nParagraph 2.';
      const chunks = chunker.chunk(text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].text).toContain('Paragraph 1');
      expect(chunks[1].text).toContain('Paragraph 2');
    });

    it('should add overlap between chunks', () => {
      const text = 'Sentence 1. Sentence 2. Sentence 3.';
      const chunks = chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);
      const overlap = chunks[0].text.split(' ').slice(-5);
      expect(chunks[1].text).toContain(overlap[0]);
    });

    it('should throw on empty text', () => {
      expect(() => {
        chunker.chunk('');
      }).toThrow('Text cannot be empty');
    });

    it('should preserve special characters', () => {
      const text = 'Code: `const x = 5;`\n\nMore text.';
      const chunks = chunker.chunk(text);

      expect(chunks[0].text).toContain('`const x = 5;`');
    });
  });

  describe('getChunkSize()', () => {
    it('should calculate size in tokens', () => {
      const chunk: Chunk = {
        id: 'chunk-1',
        text: 'Hello world',
        startChar: 0,
        endChar: 11,
        chunkIndex: 0,
        totalChunks: 1,
        overlapFromPrevious: false,
      };

      const size = chunker.getChunkSize(chunk);
      expect(size).toBeGreaterThan(0);
    });
  });
});
```

---

## Summary

1. **Organize tests** with `describe()` blocks
2. **Use Arrange-Act-Assert** structure
3. **Test both success and error paths**
4. **Mock external dependencies**
5. **Async tests** use async/await
6. **Coverage target**: 80% minimum
7. **Run tests** before committing: `npm test`
8. **Integration tests** verify module interaction
9. **Fixtures** for reusable test data
10. **Descriptive names** explain what's tested

Writing good tests is as important as writing good code. Tests document behavior, catch bugs early, and enable confident refactoring!
