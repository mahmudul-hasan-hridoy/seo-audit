---
name: robots-parser CJS interop
description: How to correctly import and call the robots-parser package (CJS) from ESM TypeScript.
---

## Rule
`robots-parser` is a CommonJS module. Its type declaration uses `export default function robotsParser(...)`, but the runtime ships `module.exports = function(...)`. This causes two problems:
1. `ReturnType<typeof robotsParser>` fails with TS2344 (not callable).
2. `import robotsParser from 'robots-parser'` with `esModuleInterop: false` may not bind the callable at runtime.

## Fix
Use a **dynamic import** and cast to bypass the interop gap:

```ts
interface RobotsChecker { isAllowed(url: string, ua?: string): boolean | undefined; }

const mod = await import('robots-parser');
const parser: (url: string, content: string) => RobotsChecker = (mod as any).default ?? mod;
this.robots = parser(robotsUrl, text);
```

**Why:** Dynamic import defers resolution to runtime where Node.js handles CJS→ESM wrapping correctly. The `(mod as any).default ?? mod` fallback covers both interop modes.

**How to apply:** Any time you see `Cannot find name 'robotsParser'` or `Type … has no call signatures` with robots-parser, use this pattern.
