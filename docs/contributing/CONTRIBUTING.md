# Contributing to Memento

Welcome to Memento! We're excited you want to contribute to persistent semantic memory for AI coding agents.

This guide will help you get started with development, understand our processes, and make meaningful contributions.

---

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our [Code of Conduct](https://github.com/sanathshetty444/memento/blob/main/CODE_OF_CONDUCT.md).

**TL;DR**: Be respectful, inclusive, and constructive. Harassment, discrimination, and bad faith are not tolerated.

---

## Getting Started

### Prerequisites

- **Node.js**: 20.x or 22.x (not older versions)
- **npm**: 10.x or later
- **Git**: Latest version
- **Text Editor**: VS Code recommended (with ESLint + Prettier extensions)

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone git@github.com-work:sanathshetty444/memento.git
   cd memento
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify build**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

Expected output: All tests pass, no type errors.

5. **Set up Git identity** (for commits):
   ```bash
   git config --local user.email "sanathshetty444@gmail.com"
   git config --local user.name "Your Name"
   ```

### Development Workflow

```
1. Create feature branch
2. Make changes
3. Run tests & lint
4. Commit with descriptive message
5. Push branch
6. Create pull request
7. Address review feedback
8. Merge when approved
```

---

## Branch Naming Convention

All feature branches must follow the naming pattern:

```
`<version>`-`<type>`-`<name>`
```

**Format Breakdown**:
- `<version>`: Current version (e.g., `v0.2.0`)
- `<type>`: `feat` (feature), `bug` (bug fix), `chore` (maintenance), `docs` (documentation)
- `<name>`: Kebab-case description (e.g., `add-export-tool`)

**Examples**:
```
v0.2.0-feat-add-export-tool
v0.2.0-bug-fix-circular-deps
v0.2.0-chore-update-dependencies
v0.2.0-docs-improve-examples
```

**Branching off main**:
```bash
git checkout main
git pull origin main
git checkout -b v0.2.0-feat-your-feature-name
```

---

## Making Changes

### Code Changes

1. **Create a new branch** (see naming above)
2. **Edit files** in `src/`, `tests/`, or `docs/`
3. **Run linter** before committing:
   ```bash
   npm run lint
   ```
4. **Format code** with Prettier:
   ```bash
   npm run format
   ```
5. **Type check**:
   ```bash
   npx tsc --noEmit
   ```

### Key Guidelines

- **ESM Imports**: Always use `.js` extensions
  ```typescript
  // ✓ Correct
  import { save } from './tools/save.js';

  // ✗ Wrong
  import { save } from './tools/save';
  ```

- **No CommonJS**: Don't use `require()` or `module.exports`
  ```typescript
  // ✗ Wrong
  const express = require('express');
  module.exports = handler;

  // ✓ Correct
  import express from 'express';
  export { handler };
  ```

- **Async/Await**: Prefer async/await over Promise chains
  ```typescript
  // ✓ Good
  async function save() {
    const data = await storage.fetch();
    return data;
  }

  // ⚠️ Acceptable but less preferred
  function save() {
    return storage.fetch().then(data => data);
  }
  ```

- **Error Handling**: Always handle errors
  ```typescript
  try {
    await storage.save(memory);
  } catch (error) {
    logger.error(`Failed to save: ${error.message}`);
    throw new MemoryError('Save failed', { cause: error });
  }
  ```

---

## Pull Requests

### Creating a PR

1. **Push your branch**:
   ```bash
   git push origin v0.2.0-feat-your-feature-name
   ```

2. **Create PR** via GitHub CLI (recommended):
   ```bash
   gh pr create \
     -t "v0.2.0-feat-your-feature-name" \
     -b "## Summary\n\nShort description of changes\n\n## Test Plan\n\n- [ ] Ran tests\n- [ ] Verified new feature"
   ```

   Or use the GitHub web interface.

3. **PR Title**: Must match branch name exactly
   ```
   v0.2.0-feat-add-export-tool
   ```

### PR Description Template

```markdown
## Summary

Brief description of the problem and solution (1-2 sentences).

## Changes

- Added X functionality
- Fixed Y bug
- Updated Z test

## Test Plan

- [ ] Ran `npm test` — all tests pass
- [ ] Ran `npm run lint` — no violations
- [ ] Verified locally: [describe what you tested]
- [ ] Updated docs at [path]
- [ ] Updated CHANGELOG.md

## Notes

Any additional context or decisions made.
```

### Review Process

1. **CI must pass**: Lint, typecheck, tests on Node 20 and 22
2. **At least one approval** from maintainers
3. **All comments resolved** before merge
4. **Merge** via GitHub (using "Squash and merge" if multiple commits)

### Common Review Feedback

**"Please add a test"**
- Add test file in `tests/` with `.test.ts` suffix
- Follow existing test patterns (see `TESTING.md`)
- Run `npm test` to verify

**"Update CHANGELOG.md"**
- Add entry under `[Unreleased]` section
- Format: `- [TYPE] brief description (PR #123)`
- Types: Features, Bug Fixes, Changed, Deprecated, Removed

**"Type this parameter"**
- Add TypeScript type annotations
- Use `strict` mode (enabled in `tsconfig.json`)
- Extract to interfaces if complex

---

## Testing Requirements

All contributions must include tests. See [TESTING.md](./testing.md) for detailed guide.

**Quick Checklist**:
- [ ] New feature has unit tests
- [ ] New feature has integration test (if relevant)
- [ ] Test covers happy path and error cases
- [ ] Test file named `feature.test.ts` in `tests/`
- [ ] Coverage doesn't drop below 80%

**Running Tests**:
```bash
npm test                 # Run all tests once
npm run test:watch      # Watch mode
npm test -- --ui        # Web UI (requires @vitest/ui)
```

---

## Documentation

All public APIs must be documented.

### Documentation Checklist

- [ ] Docstring on exported functions/classes
- [ ] Parameters documented with types
- [ ] Return value described
- [ ] Example usage included (if helpful)
- [ ] README.md updated if user-facing
- [ ] Architecture docs updated if necessary

### Docstring Example

```typescript
/**
 * Saves a memory to storage with automatic tagging and deduplication.
 *
 * Performs the following steps:
 * 1. Redacts sensitive information
 * 2. Auto-tags memory based on content
 * 3. Chunks memory for embedding
 * 4. Deduplicates against existing memories
 * 5. Persists to storage with vector embeddings
 *
 * @param text - The memory text to save
 * @param tags - Optional semantic tags
 * @param namespace - Project namespace for isolation
 * @returns Promise resolving to the saved memory ID
 * @throws MemoryError if save fails or memory is invalid
 *
 * @example
 * const id = await memoryManager.save(
 *   "Implemented Redis caching for sessions",
 *   ["code", "architecture"],
 *   "my-project"
 * );
 */
export async function save(
  text: string,
  tags?: string[],
  namespace?: string
): Promise<string> {
  // implementation
}
```

---

## Git Commit Guidelines

Write clear, descriptive commit messages. Follow conventional commits format:

```
`<type>`(`<scope>`): `<subject>`

`<body>`

`<footer>`
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `chore`: Maintenance, dependencies

**Example Commits**:
```
feat(storage): add neo4j adapter support

Implement Neo4j vector store with graph relationship
tracking. Enables querying memories by entity relationships.

Closes #45

feat(tools): add memory-related-to tool
fix(dedup): handle edge case in similarity calculation
docs(architecture): improve HNSW explanation
test(chunker): add boundary detection tests
```

**Commit Guidelines**:
- Commits should be atomic (one logical change per commit)
- Use imperative mood: "add feature", not "added feature"
- Keep subject line under 50 characters
- Reference issues/PRs in footer: `Closes #123`

---

## Issues and Bug Reports

### Reporting a Bug

1. **Search existing issues** to avoid duplicates
2. **Use the bug template** (auto-filled on GitHub)
3. **Include**:
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Reproduction steps (minimal example)
   - Expected vs actual behavior
   - Error messages and stack traces
   - Screenshots if applicable

**Example**:
```markdown
## Bug Report

### Description
Auto-tagging incorrectly identifies code as error.

### Reproduction
1. Save memory: "The code compiled successfully"
2. Check tags assigned
3. See: ["error"] instead of ["code"]

### Expected
Should tag as ["code"] since it mentions code compilation.

### Actual
Tags as ["error"] because of "error" pattern in heuristic.

### Environment
- Node 20.10.0
- npm 10.2.0
- memento 0.1.5

### Error Log
[no error, just incorrect tagging]
```

### Feature Requests

1. **Describe the use case** — why you need this feature
2. **Propose a solution** (optional) — how it should work
3. **Alternatives considered** — what you tried instead
4. **Additional context** — mockups, examples, references

**Example**:
```markdown
## Feature Request: Multi-Device Sync

### Use Case
I use memento on my laptop and iPad. Currently I have to
manually export/import to keep memories in sync.

### Proposed Solution
Add optional iCloud/Dropbox sync that:
- Watches for local file changes
- Uploads to cloud storage
- Syncs down to other devices

### Alternative Considered
Manual export/import works but is tedious.

### Additional Context
Many other tools (Obsidian, Apple Notes) do this well.
```

---

## Questions and Discussion

### Asking Questions

**Before asking**:
1. Check README.md and docs/
2. Search GitHub issues
3. Check Discord/Slack community

**How to ask**:
1. Open a GitHub Discussion (preferred)
2. Or ask in community Discord
3. Provide context and have tried troubleshooting

**Good question example**:
```
Title: How to use custom embeddings provider?

I want to use my own embedding model. I've read the docs
at docs/storage-backends.md and embeddings docs, but I'm
not sure how to implement the EmbeddingProvider interface.

Can someone point me to an example or guide?

My use case: Private on-premise model for sensitive code.

What I've tried:
- Reviewed src/embeddings/local.ts
- Looked at Gemini adapter
```

---

## Development Commands

**Quick Reference**:

```bash
# Setup
npm install                    # Install dependencies

# Development
npm run build                  # Compile TypeScript
npm run lint                   # Check code style
npm run format                 # Auto-format code
npm test                       # Run all tests
npm run test:watch            # Tests in watch mode

# Cleanup
npm run clean                  # Remove dist/ and build artifacts

# Type checking
npx tsc --noEmit              # Check types without emitting

# Git
git log --oneline -10         # Recent commits
gh pr list                     # Open PRs
gh issue list                  # Open issues
```

---

## Release Process

(For maintainers)

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with all changes
3. **Commit**: `git commit -m "chore: bump version to X.Y.Z"`
4. **Tag**: `git tag vX.Y.Z`
5. **Push**: `git push origin main --tags`
6. GitHub Actions automatically publishes to npm

---

## Getting Help

### Resources

- **Documentation**: `docs/` directory
- **Issues**: GitHub Issues (search first!)
- **Discussions**: GitHub Discussions
- **Community**: Discord channel (link in README)
- **Direct**: Email maintainers

### Before You Get Stuck

1. **Read the error message carefully** — often has the answer
2. **Check the docs** relevant to your issue
3. **Search GitHub issues** for similar problems
4. **Look at tests** for examples of how features work
5. **Ask in Discussions** if stuck for more than 30 minutes

---

## Code Review Etiquette

### For Authors

- **Respond to feedback** promptly
- **Ask clarifying questions** if feedback unclear
- **Don't take it personally** — review is about the code
- **Apply suggested changes** if they make sense
- **Push follow-up commits** (don't force-push, makes history clearer)

### For Reviewers

- **Be constructive** — explain the "why", not just the problem
- **Praise good work** — acknowledge effort
- **Ask questions** rather than making demands
- **Suggest, don't command** — use "consider" language
- **Review promptly** — don't let PRs sit for days

---

## Maintainers and Owners

**Project Lead**: [@sanathshetty444](https://github.com/sanathshetty444)

**Maintainers**:
- Code quality and testing
- Documentation accuracy
- Issue triage
- Release management

**How to Become a Maintainer**:
- 10+ merged PRs
- Consistent code quality
- Community engagement
- Good judgment on design decisions

---

## Summary

1. **Read this guide** before contributing
2. **Use branch naming convention** for all branches
3. **Write tests** for new code
4. **Keep PRs focused** — one feature per PR
5. **Update CHANGELOG.md** and docs
6. **Respond to feedback** constructively
7. **Ask questions** if stuck

Thank you for contributing to Memento!
