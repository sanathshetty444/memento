# Code Style Guide

This document describes Memento's coding standards, conventions, and style guidelines. Following these ensures consistency across the codebase and makes it easier for everyone to collaborate.

---

## Overview

**Style Tool**: ESLint 9 + Prettier
**Language**: TypeScript (strict mode)
**Module System**: ESM only (with `.js` extensions)
**Format on Save**: Enabled via Prettier (recommended)

---

## Setup

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "eslint.validate": ["typescript"],
  "eslint.format.enable": true
}
```

### Running Linters

```bash
# Check style (don't fix)
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Format code with Prettier
npm run format

# Type check
npx tsc --noEmit
```

---

## ESLint Configuration (eslint.config.js)

Key rules enforced:

| Rule | Config | Purpose |
|------|--------|---------|
| `no-var` | error | Use `const`/`let` only |
| `prefer-const` | error | Use `const` for non-reassigned |
| `semi` | error | Require semicolons |
| `quotes` | error | Use single quotes |
| `indent` | error | 2 spaces indentation |
| `import/extensions` | error | Require `.js` in ESM imports |
| `no-unused-vars` | error | Flag unused variables |
| `no-console` | warn | Minimize console.log in prod |
| `no-debugger` | error | Remove debugger statements |
| `eqeqeq` | error | Use `===` not `==` |

---

## Prettier Configuration (.prettierrc)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
```

### Key Settings

- **Semi**: Always add semicolons
- **Trailing Commas**: Add in ES5-valid places (arrays, objects, not functions)
- **Single Quotes**: Use single quotes, not double
- **Print Width**: 100 characters per line (long lines break to multiple)
- **Tab Width**: 2 spaces (not 4, not tabs)
- **Arrow Parens**: Always: `(x) => x`, not `x => x`

---

## TypeScript Style

### Strict Mode

`tsconfig.json` enables strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

This means:

1. **No implicit `any`**: Always type parameters
   ```typescript
   // ✗ Wrong: x type is any
   function add(x, y) { return x + y; }

   // ✓ Correct
   function add(x: number, y: number): number { return x + y; }
   ```

2. **Null checks**: Handle null/undefined explicitly
   ```typescript
   // ✗ Wrong: doesn't check for null
   function getName(user) { return user.name; }

   // ✓ Correct
   function getName(user: User | null): string {
     if (!user) throw new Error('User is null');
     return user.name;
   }
   ```

3. **No unused variables**: Remove unreferenced declarations
   ```typescript
   // ✗ Wrong
   const config = loadConfig(); // never used
   const result = compute();

   // ✓ Correct
   const result = compute();
   ```

---

## Import/Export Conventions

### ESM Imports (Mandatory)

**Always use `.js` extension in imports**:

```typescript
// ✓ Correct
import { save } from './tools/save.js';
import { Memory } from '../types.js';
import config from '../config.js';

// ✗ Wrong (no extension)
import { save } from './tools/save';
import { Memory } from '../types';

// ✗ Wrong (CommonJS)
const { save } = require('./tools/save');
```

### Import Organization

Order imports by category, alphabetically within category:

```typescript
// 1. Node.js built-ins
import fs from 'fs';
import path from 'path';

// 2. Third-party packages
import express from 'express';
import { z } from 'zod';

// 3. Local imports (src/)
import { Memory } from '../types.js';
import { createLogger } from '../logger.js';

// 4. Local imports (same directory or below)
import { chunker } from './chunker.js';
import { redactor } from './redactor.js';
```

### Export Patterns

**Named exports** (preferred):
```typescript
// src/tools/save.ts
export async function save(text: string): Promise<string> {
  // implementation
}

// src/tools/recall.ts
export async function recall(query: string): Promise<Memory[]> {
  // implementation
}

// src/tools/index.ts
export { save } from './save.js';
export { recall } from './recall.js';
```

**Default exports** (use rarely, only for main entry points):
```typescript
// src/server.ts
export default app; // OK: this is the main server

// src/storage/local.ts
export default class LocalStore { } // Avoid: use named export instead
```

### Import Aliases

Avoid import aliases. Use relative imports:

```typescript
// ✗ Avoid
import { save } from '@tools/save';
import { Memory } from '@types';

// ✓ Prefer relative
import { save } from '../tools/save.js';
import { Memory } from '../types.js';
```

---

## Naming Conventions

### Variables and Functions

Use **camelCase**:

```typescript
// ✓ Correct
const userEmail = 'user@example.com';
const isValidEmail = true;
const computeHash = () => {};

// ✗ Wrong
const user_email = 'user@example.com';
const UserEmail = 'user@example.com';
const IsValidEmail = true;
```

### Classes and Types

Use **PascalCase**:

```typescript
// ✓ Correct
class MemoryManager {}
interface Memory {}
type SearchResult = { id: string; score: number };

// ✗ Wrong
class memoryManager {}
interface memory {}
type searchResult = {};
```

### Constants

Use **UPPER_SNAKE_CASE** for true constants:

```typescript
// ✓ Correct (true constant)
const MAX_CHUNK_SIZE = 1024;
const DEFAULT_TTL_SECONDS = 3600;
const EMBEDDING_DIMENSION = 384;

// ✓ Also OK (runtime-determined, not truly constant)
const config = loadConfig();
const logger = createLogger();
```

### Private Members

Prefix with underscore:

```typescript
class Memory {
  private _id: string;
  private _cached: Map<string, any>;

  constructor(id: string) {
    this._id = id;
    this._cached = new Map();
  }

  get id(): string { return this._id; }
}
```

### File Names

Use **kebab-case**:

```
src/
  tools/
    save.ts              ✓
    recall.ts            ✓
    save-memory.ts       ✗ (too long)
    saveMemory.ts        ✗ (camelCase)

  memory/
    chunk-manager.ts     ✓
    chunker.ts           ✓
```

---

## Async/Await Patterns

### Prefer async/await

```typescript
// ✓ Good: async/await
async function fetchMemory(id: string): Promise<Memory> {
  const data = await storage.get(id);
  return parseMemory(data);
}

// ⚠️ Acceptable but less preferred: Promise chains
function fetchMemory(id: string): Promise<Memory> {
  return storage.get(id).then(data => parseMemory(data));
}

// ✗ Bad: callback hell
function fetchMemory(id, callback) {
  storage.get(id, (err, data) => {
    if (err) callback(err);
    else parseMemory(data, callback);
  });
}
```

### Error Handling in Async

Always wrap in try/catch:

```typescript
// ✓ Good
async function save(memory: Memory): Promise<void> {
  try {
    await storage.save(memory);
  } catch (error) {
    logger.error(`Save failed: ${error.message}`);
    throw new MemoryError('Failed to save', { cause: error });
  }
}

// ✗ Bad: unhandled error
async function save(memory: Memory): Promise<void> {
  await storage.save(memory); // error ignored
}
```

### Parallel Operations

Use `Promise.all()` for independent async operations:

```typescript
// ✓ Good: Runs in parallel
const [vectors, tags] = await Promise.all([
  embeddings.embed(text),
  tagger.tag(text),
]);

// ⚠️ Sequential: Slower if independent
const vectors = await embeddings.embed(text);
const tags = await tagger.tag(text);
```

### Race Conditions

Use `Promise.race()` with timeout fallback:

```typescript
// ✓ Good: Times out after 5 seconds
const result = await Promise.race([
  storage.fetch(id),
  sleep(5000).then(() => {
    throw new TimeoutError('Storage timeout');
  }),
]);
```

---

## Optional Dependencies Pattern

For optional packages (chromadb, neo4j, openai):

```typescript
// ✓ Correct: Dynamic import with helpful error
async function loadChromaDB() {
  try {
    return await import('chromadb');
  } catch (error) {
    throw new Error(
      'ChromaDB not installed. Install with:\n' +
      '  npm install chromadb'
    );
  }
}

// Usage in factory
async function createStore(type: string): Promise<VectorStore> {
  switch (type) {
    case 'chromadb': {
      const chromadb = await loadChromaDB();
      return new ChromaDBStore(chromadb);
    }
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}

// ✗ Wrong: Import at top level (fails on missing optional dep)
import chromadb from 'chromadb'; // Fails if not installed

// ✗ Wrong: Lazy loading without error handling
export async function createStore() {
  const chromadb = await import('chromadb'); // Silent failure
}
```

### Type Stubs for Optional Dependencies

In `src/optional-deps.d.ts`:

```typescript
declare module 'chromadb' {
  export interface Client {
    getOrCreateCollection(options: any): Promise<any>;
  }
  export class HttpClient implements Client {
    constructor(host: string, port: number);
  }
}
```

---

## Error Handling

### Custom Error Classes

Define custom errors for different scenarios:

```typescript
// src/errors.ts
export class MemoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MemoryError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Usage
try {
  if (!memory.text) throw new ValidationError('Text required', 'text');
  await storage.save(memory);
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn(`Invalid ${error.field}: ${error.message}`);
  } else if (error instanceof MemoryError) {
    logger.error(`Memory operation failed: ${error.message}`);
  } else {
    logger.error(`Unexpected error: ${error}`);
  }
}
```

### Logging Errors

```typescript
// ✓ Good: Include context
logger.error('Failed to save memory', {
  memoryId: memory.id,
  namespace: memory.namespace,
  error: error.message,
  stack: error.stack,
});

// ✗ Bad: No context
logger.error(error);
console.log('error happened');
```

---

## Comments and Documentation

### Docstrings

Document all public functions:

```typescript
/**
 * Saves a memory with automatic deduplication and embedding.
 *
 * The function performs:
 * 1. Redaction of sensitive patterns
 * 2. Auto-tagging based on content
 * 3. Chunking for embedding
 * 4. Deduplication against existing memories
 * 5. Vector embedding and storage
 *
 * @param text - The memory text to save (non-empty string)
 * @param tags - Optional semantic tags for filtering
 * @param namespace - Project namespace for isolation (default: "default")
 * @returns Promise resolving to the saved memory ID
 * @throws {ValidationError} If text is empty
 * @throws {MemoryError} If save operation fails
 *
 * @example
 * const id = await manager.save(
 *   'Implemented Redis caching',
 *   ['code', 'architecture'],
 *   'my-project'
 * );
 *
 * @see {recall} for retrieving memories
 * @see docs/architecture/memory-pipeline.md for pipeline details
 */
export async function save(
  text: string,
  tags?: string[],
  namespace?: string,
): Promise<string> {
  // implementation
}
```

### Inline Comments

Use sparingly. Prefer self-explanatory code:

```typescript
// ✓ Good: Self-explanatory code, comment explains why
// Phase 2 dedup: cosine similarity expensive, only run if phase 1 miss
if (dedupePhase1Result.isDuplicate) {
  return dedupePhase1Result;
}

// ✗ Bad: Comment repeats what code already says
// Check if x is greater than 10
if (x > 10) { }

// ✓ Good: Comment explains complex algorithm
// HNSW navigation: Start at top layer, greedy descent to nearest neighbor
for (let layer = maxLayer; layer > 0; layer--) {
  nearestNode = searchLayer(vector, nearestNode, 1, layer);
}
```

### TODO Comments

Format consistently:

```typescript
// TODO(user): description
// FIXME(user): what's broken
// HACK(user): explain why this is hacky
// NOTE: important information

// ✓ Correct
// TODO(sanath): Add reranking using LLM scores
// FIXME(jane): Handle memory deletion cascade

// ✗ Wrong
// todo: add reranking
// TODO add reranking
```

---

## Trailing Commas and Line Length

### Trailing Commas

Enable for better diffs:

```typescript
// ✓ Good: Trailing comma on multiline
const config = {
  host: 'localhost',
  port: 3000,
  timeout: 5000,
};

// ✓ OK: Single line, no comma needed
const config = { host: 'localhost', port: 3000 };

// ✗ Bad: No trailing comma on multiline
const config = {
  host: 'localhost',
  port: 3000,
  timeout: 5000
};
```

### Line Length

Max 100 characters (enforced by Prettier):

```typescript
// ✓ Good: Wraps at 100 chars
const memory = await manager.save(
  'Long memory text that exceeds the line limit',
  ['tag1', 'tag2'],
  'namespace'
);

// ✗ Bad: Exceeds 100 chars (Prettier auto-fixes)
const memory = await manager.save('Long memory text', ['tag1', 'tag2'], 'namespace');
```

---

## Type Annotations

### Always Annotate

```typescript
// ✓ Good: Types explicit
function compute(x: number, y: number): number {
  return x + y;
}

async function save(memory: Memory): Promise<string> {
  return storage.save(memory);
}

// ✗ Bad: Inferred (acceptable only in obvious cases)
function compute(x, y) { return x + y; }
async function save(memory) { return storage.save(memory); }
```

### Complex Types

Extract to interfaces:

```typescript
// ✓ Good: Extracted interface
interface SaveOptions {
  tags?: string[];
  namespace?: string;
  skipDedup?: boolean;
}

export async function save(
  text: string,
  options?: SaveOptions
): Promise<string> {
  // implementation
}

// ✗ Bad: Complex type inline
export async function save(
  text: string,
  options?: { tags?: string[]; namespace?: string; skipDedup?: boolean }
): Promise<string> {
  // implementation
}
```

---

## Linting Rules Summary

| Category | Do | Don't |
|----------|----|----|
| Variables | `const`/`let` | `var` |
| Equality | `===` / `!==` | `==` / `!=` |
| Strings | Single quotes | Double quotes |
| Semicolons | Always | Never omit |
| Commas | Trailing on multiline | None on single-line |
| Imports | `.js` extensions | No extension |
| Comments | Explain why | Repeat what code says |
| Errors | Custom error classes | Generic Error |
| Async | async/await | Promise chains |
| Strict | Enable strict mode | Disable checks |

---

## Pre-commit Hooks

Husky + lint-staged runs on every commit:

1. Lints staged files
2. Type-checks
3. Formats with Prettier
4. Runs tests

If any step fails, commit is blocked. Fix issues and commit again.

```bash
# Install hooks
npx husky install

# Bypass hooks (not recommended)
git commit --no-verify
```

---

## Summary

- **ESLint + Prettier** handle formatting automatically
- **TypeScript strict** catches type errors at compile time
- **ESM imports** with `.js` extensions (no CJS)
- **Async/await** over Promise chains
- **Custom errors** for different scenarios
- **Docstrings** on all public APIs
- **camelCase** for vars/functions, **PascalCase** for classes/types
- **100-char line length**, trailing commas, semicolons
- **2-space indentation**, single quotes
- Run `npm run lint` and `npm run format` before committing

These standards keep the codebase clean, readable, and maintainable!
