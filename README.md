# seo-auditor

A professional-grade, production-ready SEO site auditing toolkit for Node.js. Crawl any website, run 8 parallel analyzer modules per page, and generate scored reports in HTML, Markdown, or JSON — all from a single npm package or CLI command.

```
Site score: 84/100 (B)  ·  3 pages  ·  1.4s

  ❌ Errors    2
  ⚠️ Warnings  7
  ✅ Passed   31
  ℹ️ Info       4
```

---

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`seo-auditor`](./packages/core) | Programmatic Node.js library | `npm install seo-auditor` |
| [`@mahmudul-hasan/seo-scan`](./packages/cli) | CLI binary (`seo-audit`) | `npm install -g @mahmudul-hasan/seo-scan` |

---

## Quick start

### Library

```ts
import { Auditor } from 'seo-auditor';

const auditor = new Auditor({ url: 'https://example.com', maxPages: 50 });

auditor.on('page:audited', (page) =>
  console.log(`${page.url}  ${page.score}/100`)
);

const report = await auditor.run();
console.log(`Site score: ${report.siteScore}/100 (${report.grade})`);
```

### CLI

```sh
# One-off audit, save an HTML report
seo-audit run https://example.com --max-pages 100 --format html --output report.html

# Convert a stored JSON report to Markdown
seo-audit report audit.json --format markdown --output audit.md
```

---

## Monorepo layout

```
seo-auditor-monorepo/
├── packages/
│   ├── core/          # seo-auditor npm library
│   └── cli/           # @mahmudul-hasan/seo-scan CLI
├── tsconfig.base.json # Shared TypeScript config
├── vitest.config.ts   # Shared test config
└── package.json       # Workspace root
```

---

## Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9 (workspaces support)

### Setup

```sh
git clone https://github.com/mahmudul-hasan-hridoy/seo-audit.git
cd seo-audit

# Install all workspace dependencies
npm install
cd packages/core && npm install
cd ../cli && npm install
```

### Common commands (run from repo root)

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests (vitest) |
| `npm run typecheck` | TypeScript check across both packages |
| `npm run build` | Compile core then CLI |
| `npm run build:core` | Compile core only |
| `npm run build:cli` | Compile CLI only |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

### Running tests

```sh
npm test                  # all tests, single run
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
```

---

## Architecture

```
Auditor (entry point)
  └── Crawler (BFS, robots.txt, concurrency via p-limit)
        └── PageFetcher (undici HTTP, optional Puppeteer)
              └── LinkExtractor (linkedom DOM parsing)
  └── Analyzers × 8 (run in parallel per page)
        ├── OnPageAnalyzer      title, meta, headings, lang
        ├── TechnicalAnalyzer   HTTPS, canonical, robots meta, redirects
        ├── PerformanceAnalyzer response time, compression, render-blocking
        ├── ContentAnalyzer     word count, thin content
        ├── ImageAnalyzer       alt text, dimensions, lazy-load, next-gen formats
        ├── LinkAnalyzer        broken links, nofollow, anchor text
        ├── MobileAnalyzer      viewport meta, font size, tap targets
        └── SchemaAnalyzer      JSON-LD structured data
  └── ScoreEngine
  └── Reporter → JSON | HTML | Markdown
```

Each analyzer returns `Issue[]` objects with `id`, `title`, `description`, `severity` (`error | warning | pass | info`), optional `fix` text, and a `docs` URL. The score engine converts issues to a 0–100 page score (errors = −15 pts, warnings = −5 pts) and a letter grade (A–F).

---

## Scoring

| Severity | Penalty | Grade threshold |
|----------|---------|-----------------|
| Error    | −15 pts | A ≥ 90 |
| Warning  | −5 pts  | B ≥ 75 |
| Info     | −1 pt   | C ≥ 60 |
| Pass     | 0 pts   | D ≥ 40 |
|          |         | F < 40 |

The site score is a weighted average of page scores, with lower-scoring pages carrying higher weight to surface critical issues.

---

## License

MIT © Mahmudul Hasan
