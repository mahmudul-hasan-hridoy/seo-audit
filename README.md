# seo-auditor

A professional-grade, open-source SEO site audit tool built in TypeScript. Crawls your entire website, analyses every page across eight SEO dimensions, scores each page 0–100, and produces reports in JSON, HTML, or Markdown.

## Packages

| Package | Description |
|---|---|
| [`seo-auditor`](./packages/core) | Node.js library — use programmatically in your own tools, CI pipelines, or scripts |
| [`seo-audit`](./packages/cli) | CLI tool `seo-audit` — run audits straight from the terminal |

## Monorepo structure

```
.
├── packages/
│   ├── core/          # seo-auditor npm library
│   └── cli/           # seo-audit CLI tool
├── package.json       # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.config.ts
```

## Quick start

### CLI (recommended for most users)

```bash
# Install globally
npm install -g @mahmudul-hasan/seo-audit

# Audit a site
seo-audit run https://example.com

# Save an HTML report and open it
seo-audit run https://example.com --format html --open
```

### Library (for programmatic use)

```bash
npm install seo-auditor
```

```ts
import { Auditor } from 'seo-auditor';

const auditor = new Auditor({ url: 'https://example.com', maxPages: 50 });
const report = await auditor.run();
console.log(`Score: ${report.siteScore}/100 (${report.grade})`);
```

## Development

This project uses [pnpm workspaces](https://pnpm.io/workspaces).

```bash
# Install dependencies
pnpm install

# Build both packages
pnpm build

# Run all tests
pnpm test

# Lint
pnpm lint
```

## Analyzers

Eight built-in analyzers run in parallel on every page:

| Analyzer | Checks |
|---|---|
| `onpage` | Title tag, meta description, heading structure (H1–H6), duplicate titles |
| `technical` | HTTPS, canonical tags, robots meta, redirect chains, X-Robots-Tag headers |
| `performance` | Load time, page size, resource hints, render-blocking resources |
| `images` | Alt text, explicit dimensions (CLS), lazy loading, next-gen formats |
| `links` | Internal link count, anchor text quality, too many links per page |
| `content` | Word count, readability, duplicate/thin content detection |
| `mobile` | Viewport meta tag, font scaling, tap target sizes |
| `schema` | JSON-LD structured data, Open Graph tags, Twitter Card tags |

## Scoring

Every page starts at **100 points**. Deductions per finding:

| Severity | Deduction |
|---|---|
| Error | −15 pts |
| Warning | −5 pts |
| Info | −1 pt |
| Pass | 0 pts |

The site score is the average across all pages. Grades: **A** (90+) · **B** (75+) · **C** (60+) · **D** (40+) · **F** (<40).

## License

MIT
