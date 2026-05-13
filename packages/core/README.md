# seo-auditor

[![npm](https://img.shields.io/npm/v/seo-auditor)](https://www.npmjs.com/package/seo-auditor)
[![license](https://img.shields.io/npm/l/seo-auditor)](./LICENSE)

Node.js library for programmatic SEO site auditing. Crawls a site, runs eight parallel analyzers on every page, and returns a typed report — no browser required.

**Requirements:** Node.js 18+

## Installation

```bash
npm install seo-auditor
```

## Quick start

```ts
import { Auditor } from 'seo-auditor';

const report = await new Auditor({ url: 'https://example.com' }).run();

console.log(`${report.siteScore}/100 (${report.grade})`);
console.log(`${report.totalPages} pages — ${report.summary.errors} errors, ${report.summary.warnings} warnings`);
```

## Configuration

All options except `url` are optional.

```ts
import { Auditor, defineConfig } from 'seo-auditor';

const auditor = new Auditor(defineConfig({
  url: 'https://example.com',   // required

  maxPages: 100,                // default: 100
  crawlDepth: 3,                // default: 3
  concurrency: 5,               // default: 5
  timeout: 10000,               // ms, default: 10000

  respectRobotsTxt: true,       // default: true
  renderJs: false,              // Puppeteer for JS pages, default: false
  userAgent: 'MyBot/1.0',

  ignorePatterns: [             // glob-style URL patterns to skip
    '**/admin/**',
    '**/login',
  ],

  analyzers: [                  // run a subset; omit to run all eight
    'onpage',
    'technical',
    'performance',
  ],
}));
```

`defineConfig` is an identity function that gives TypeScript inference in a config file:

```ts
// seo-audit.config.ts
import { defineConfig } from 'seo-auditor';
export default defineConfig({ url: 'https://example.com', maxPages: 200 });
```

## Events

`Auditor` extends `EventEmitter`.

```ts
const auditor = new Auditor({ url: 'https://example.com' });

auditor.on('crawl:start', () => console.log('crawling…'));
auditor.on('progress', (current, total) => console.log(`${current}/${total}`));
auditor.on('crawl:done', (total) => console.log(`${total} pages found`));
auditor.on('page:audited', (page) => console.log(page.url, page.score));
auditor.on('error', (err, url) => console.error(`skipped ${url}: ${err.message}`));

const report = await auditor.run();
```

| Event | Arguments | When |
|---|---|---|
| `crawl:start` | — | Before the crawler begins |
| `progress` | `(current, total)` | After each page is fetched |
| `crawl:done` | `(totalPages)` | After all pages are fetched |
| `page:audited` | `(page: PageAudit)` | After each page is analyzed |
| `error` | `(err, url?)` | Non-fatal per-page error |

## Report structure

```ts
interface AuditReport {
  siteUrl: string;
  totalPages: number;
  siteScore: number;      // 0–100 weighted average across pages
  grade: Grade;           // 'A' | 'B' | 'C' | 'D' | 'F'
  summary: {
    errors: number;
    warnings: number;
    passes: number;
    info: number;
  };
  pages: PageAudit[];
  topIssues: Issue[];     // top 10 most impactful issues site-wide
  auditedAt: Date;
  durationMs: number;
}

interface PageAudit {
  url: string;
  statusCode: number;
  loadTimeMs: number;
  issues: Issue[];
  score: number;
  grade: Grade;
  auditedAt: Date;
}

interface Issue {
  id: string;             // e.g. "missing-title-tag"
  title: string;
  description: string;
  severity: 'error' | 'warning' | 'pass' | 'info';
  category: AnalyzerName;
  affectedUrl: string;
  fix?: string;
  docs?: string;
  value?: string | number;
  expected?: string | number;
}
```

## Saving reports

```ts
import { Auditor, Reporter } from 'seo-auditor';

const report = await new Auditor({ url: 'https://example.com' }).run();
const reporter = new Reporter();

await reporter.write(report, { format: 'html',     outputPath: './audit.html' });
await reporter.write(report, { format: 'json',     outputPath: './audit.json' });
await reporter.write(report, { format: 'markdown', outputPath: './audit.md'   });

// Or serialize to a string
const html = reporter.serialize(report, 'html');
```

`write` creates parent directories automatically and returns the absolute path of the saved file.

## Analyzers

| Analyzer | What it checks |
|---|---|
| `onpage` | Title tag, meta description, H1, heading hierarchy, lang attribute |
| `technical` | HTTPS, HSTS, canonical tag, robots meta/header, redirect chains, hreflang |
| `performance` | Load time, HTML size, compression, render-blocking resources, cache headers |
| `images` | Alt text, explicit dimensions (CLS), lazy loading, next-gen formats |
| `links` | Internal link count, anchor text quality, total link count |
| `content` | Word count, thin content, readability (Flesch score) |
| `mobile` | Viewport meta, font scaling, tap target sizes |
| `schema` | JSON-LD structured data, Open Graph tags, Twitter Card |

## Scoring

Each page starts at **100**. Issues deduct points (floor: 0):

| Severity | Deduction |
|---|---|
| `error` | −15 pts |
| `warning` | −5 pts |
| `info` | −1 pt |

The **site score** is a weighted average — lower-scoring pages carry more weight to surface the most critical problems.

| Score | Grade |
|---|---|
| 90–100 | A |
| 75–89 | B |
| 60–74 | C |
| 40–59 | D |
| 0–39 | F |

## Error handling

`Auditor.run()` throws `AuditorError` for fatal startup failures. Non-fatal per-page errors are emitted via the `error` event and do not abort the audit.

```ts
import { Auditor, AuditorError } from 'seo-auditor';

try {
  await new Auditor({ url: 'not-a-url' }).run();
} catch (err) {
  if (err instanceof AuditorError) {
    // err.code: 'INVALID_URL' | 'FETCH_FAILED' | 'TIMEOUT' | 'ROBOTS_BLOCKED'
    //         | 'NOT_HTML' | 'PARSE_ERROR' | 'PUPPETEER_UNAVAILABLE' | 'CONFIG_INVALID'
    console.error(`[${err.code}] ${err.message}`);
  }
}
```

## CI integration

```ts
// seo-check.mjs
import { Auditor } from 'seo-auditor';

const report = await new Auditor({
  url: process.env.SITE_URL,
  maxPages: 50,
  analyzers: ['onpage', 'technical'],
}).run();

if (report.siteScore < 70) {
  console.error(`SEO score ${report.siteScore}/100 is below threshold`);
  process.exit(1);
}
```

## TypeScript

Ships its own declarations — no `@types/*` needed.

```ts
import type { AuditConfig, AuditReport, PageAudit, Issue, IssueSeverity, AnalyzerName, Grade } from 'seo-auditor';
```

## License

MIT
