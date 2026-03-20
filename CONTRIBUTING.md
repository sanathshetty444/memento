# Contributing to Memento

Thanks for your interest in contributing! This guide covers how to set up your development environment and submit changes.

## Getting Started

```bash
git clone https://github.com/sanathshetty444/memento.git
cd memento
npm install
npm run build
npm test
```

## Development Workflow

1. **Branch from `main`** using the naming convention: `<version>-<feat|bug>-<name>` (e.g., `v0.4.0-feat-add-redis-adapter`)
2. Write tests first, then implement
3. Run `npm test` and `npm run lint` before pushing
4. Keep commits focused and well-described

## Pull Requests

- All PRs must pass CI (lint, typecheck, test, build)
- Include tests for new features and bug fixes
- Update `CHANGELOG.md` for user-facing changes
- Document breaking changes in the PR description
- One feature/fix per PR

## Code Style

Code style is enforced automatically:
- **ESLint** — catches bugs and enforces TypeScript best practices
- **Prettier** — consistent formatting
- **Pre-commit hooks** — auto-fix on commit via husky + lint-staged

Just write code and commit — hooks handle formatting.

## Reporting Issues

Use the [issue templates](https://github.com/sanathshetty444/memento/issues/new/choose) for bug reports and feature requests. Include reproduction steps for bugs.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE).
