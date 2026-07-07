---
name: CLI typecheck setup
description: How the CLI package resolves seo-auditor types at compile time in this monorepo.
---

## Rule
The CLI (`packages/cli`) consumes `seo-auditor` via TypeScript **project references**, not a `paths` alias.

## Setup
- `packages/core/tsconfig.json` has `"composite": true` — required for the referenced project to emit declarations.
- `packages/cli/tsconfig.json` has `"references": [{ "path": "../core" }]` — no `paths` entry.
- Before the CLI typecheck can succeed, the core **must be built first** (`npm run build --workspace=packages/core`) so that `packages/core/dist/*.d.ts` exist.

**Why:** A `paths` alias pointing outside `rootDir` causes TS6059 errors. Project references are the standard TS monorepo solution; they also enable incremental builds.

**How to apply:** Any time you touch the core types and need to verify the CLI compiles, run `npm run build --workspace=packages/core` first.
