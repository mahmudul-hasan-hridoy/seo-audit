---
name: Monorepo workspace scripts
description: Correct npm workspace script syntax for the root package.json.
---

## Rule
Root `package.json` must have a `"workspaces"` field listing the package directories, and cross-package scripts must use `npm run <cmd> --workspace=<path>`:

```json
{
  "workspaces": ["packages/core", "packages/cli"],
  "scripts": {
    "typecheck": "npm run typecheck --workspace=packages/core && npm run typecheck --workspace=packages/cli"
  }
}
```

**Why:** `npm -r` (recursive) and `npm --filter` are pnpm flags and are invalid in npm without a declared workspaces field. Without the field, npm reports "No workspaces found" and the commands silently fail.

**How to apply:** When adding new workspace scripts, always use `--workspace=packages/<name>` and ensure the `workspaces` array in root `package.json` includes the new package path.
