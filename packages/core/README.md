# seo-auditor

[![npm](https://img.shields.io/npm/v/seo-auditor)](https://www.npmjs.com/package/seo-auditor)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Professional-grade SEO site auditing library for Node.js. Crawl any website, run 8 SEO analyzer modules in parallel per page, compute weighted scores, and emit structured reports in HTML, Markdown, or JSON.

---

## Features

- **BFS crawler** — respects `robots.txt`, configurable depth, concurrency, and URL ignore patterns
- **8 built-in analyzers** run in parallel: on-page, technical, performance, content, images, links, mobile, schema
- **Structured output** — every issue carries an `id`, severity, fix suggestion, and docs link
- **Three report formats** — self-contained HTML dashboard, Markdown, JSON
- **Fully typed** — strict TypeScript, ESM-only, Node ≥ 18
- **Extensible** — extend `BaseAnalyzer` to add custom checks

---

## Installation

```sh
npm install seo-auditor
```

---

## Quick start

```ts
import { Auditor } from 'seo-auditor';

const auditor = new Auditor({
  url: 'https://example.com',
  maxPages: 100,
  crawlDepth: 3,
  concurrency: 5,
});

auditor.on('page:audited', (page) => {
  console.log(`${page.url}  score=${page.score}  grade=${page.grade}`);
});

const report = await auditor.run();

console.log(`Site: ${report.siteScore}/100 (${report.grade})`);
console.log(`Errors: ${report.summary.errors}  Warnings: ${report.summary.warnings}`);
```

---

## Configuration

```ts
import { Auditor, defineConfig } from 'seo-auditor';

const config = defineConfig({
  /** Required. Absolute URL with protocol. */
  url: 'https://example.com',

  /** Maximum number of pages to crawl. Default: 100. Range: 1–100,000. */
  maxPages: 200,

  /** Maximum BFS depth from the root URL. Default: 3. Range: 0–20. */
  crawlDepth: 4,

  /** Number of pages fetched in parallel. Default: 5. Range: 1–50. */
  concurrency: 8,

  /** Per-request timeout in ms. Default: 10,000. Range: 1,000–120,000. */
  timeout: 15_000,

  /** Honour robots.txt Disallow rules. Default: true. */
  respectRobotsTxt: true,

  /** Use a headless browser (Puppeteer) to render JS before analysis. Default: false. */
  renderJs: false,

  /** Custom User-Agent string sent with every request. */
  userAgent: 'MyBot/1.0',

  /**
   * URL patterns to skip. Supports glob-style wildcards (*).
   * Example: ['*?utm_*', '*/tag/*']
   */
  ignorePatterns: ['*/wp-admin/*', '*/cart/*'],

  /**
   * Which analyzers to run. Omit to run all 8.
   * Possible values: 'onpage' | 'technical' | 'performance' | 'images' | 
   *                  'links' | 'content' | 'mobile' | 'schema'
   */
  analyzers: ['onpage', 'technical', 'performance'],
});

const auditor = new Auditor(config);
```

---

## Events

```ts
auditor.on('crawl:start', () => {
  console.log('Crawler started');
});

auditor.on('crawl:done', (totalPages: number) => {
  console.log(`Crawled ${totalPages} pages`);
});

auditor.on('progress', (current: number, total: number) => {
  console.log(`Progress: ${current}/${total}`);
});

auditor.on('page:audited', (page: PageAudit) => {
  console.log(`Audited: ${page.url}  ${page.score}/100`);
});

auditor.on('error', (err: Error, url?: string) => {
  // Non-fatal: a single page failed. The audit continues.
  console.warn(`Skipped ${url ?? 'unknown'}: ${err.message}`);
});
```

---

## Report structure

```ts
interface AuditReport {
  siteUrl: string;
  totalPages: number;
  siteScore: number;        // 0–100 weighted site-wide score
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: {
    errors: number;
    warnings: number;
    passes: number;
    info: number;
  };
  pages: PageAudit[];       // Per-page results
  topIssues: TopIssue[];    // Deduplicated, sorted by impact × affected pages
  auditedAt: Date;
  durationMs: number;
}

interface PageAudit {
  url: string;
  statusCode: number;
  loadTimeMs: number;
  issues: Issue[];
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  auditedAt: Date;
}

interface Issue {
  id: string;             // Stable machine-readable identifier
  title: string;          // Short human-readable title
  description: string;    // Full description of the problem
  severity: 'error' | 'warning' | 'pass' | 'info';
  category: AnalyzerName; // Which analyzer produced this issue
  affectedUrl: string;
  fix?: string;           // Actionable fix suggestion
  docs?: string;          // Link to reference documentation
  value?: string | number;    // Observed value
  expected?: string | number; // Expected value
}

interface TopIssue extends Issue {
  pageCount: number; // Number of pages where this issue was found
}
```

---

## Generating reports

```ts
import { Auditor, Reporter } from 'seo-auditor';

const auditor = new Auditor({ url: 'https://example.com' });
const report = await auditor.run();

const reporter = new Reporter();

// Write to disk — format inferred from extension (.html / .md / .json)
await reporter.write(report, { outputPath: './reports/audit.html' });
await reporter.write(report, { outputPath: './reports/audit.md' });
await reporter.write(report, { outputPath: './reports/audit.json' });

// Or get the serialized string directly
const html     = reporter.serialize(report, 'html');
const markdown = reporter.serialize(report, 'markdown');
const json     = reporter.serialize(report, 'json');
```

---

## Analyzers

### `onpage` — On-Page SEO

| Check | Trigger |
|-------|---------|
| Missing `<title>` tag | error |
| Empty `<title>` tag | error |
| Title too short (< 10 chars) | warning |
| Title too long (> 60 chars) | warning |
| Missing meta description | warning |
| Meta description too short (< 70 chars) | warning |
| Meta description too long (> 160 chars) | warning |
| Missing `<h1>` | error |
| Multiple `<h1>` tags | error |
| Broken heading hierarchy (e.g. H1→H3 skip) | warning |
| Missing `lang` attribute on `<html>` | warning |

### `technical` — Technical SEO

| Check | Trigger |
|-------|---------|
| Page served over HTTP (not HTTPS) | error |
| Missing HSTS header | warning |
| Missing canonical tag | warning |
| Multiple canonical tags | error |
| `noindex` in robots meta or `X-Robots-Tag` header | warning |
| Redirect chain longer than 2 hops | warning |
| Non-200 final status after redirects | error |

### `performance` — Performance

| Check | Trigger |
|-------|---------|
| Server response < 200 ms | pass |
| Server response 200–800 ms | info |
| Server response 800 ms–3 s | warning |
| Server response 3–6 s | warning |
| Server response > 6 s | error |
| No gzip/brotli compression | warning |
| HTML document > 1 MB | warning |
| HTML document > 3 MB | error |
| > 3 render-blocking stylesheets | warning |
| Synchronous scripts in `<head>` | warning |
| No `Cache-Control` header | info |

### `content` — Content Quality

| Check | Trigger |
|-------|---------|
| Word count < 150 words (thin content) | error |
| Word count 150–300 words (low content) | warning |
| Word count > 300 words | pass |

### `images` — Image SEO

| Check | Trigger |
|-------|---------|
| Missing `alt` attribute | error |
| Missing `width` / `height` attributes (CLS risk) | warning |
| Less than 50% of images lazy-loaded | warning |
| Less than 50% of images in WebP/AVIF format | info |

### `links` — Link Analysis

| Check | Trigger |
|-------|---------|
| Broken internal links (4xx/5xx) | error |
| Empty or generic anchor text ("click here") | warning |
| External links without `rel="nofollow"` | info |

### `mobile` — Mobile Friendliness

| Check | Trigger |
|-------|---------|
| Missing viewport meta tag | error |
| Viewport not set to `width=device-width` | warning |
| Font size likely too small | warning |

### `schema` — Structured Data

| Check | Trigger |
|-------|---------|
| No JSON-LD structured data found | info |
| Invalid JSON in `<script type="application/ld+json">` | error |
| Missing `@type` property in JSON-LD | warning |
| Missing `@context` property | warning |

---

## Scoring algorithm

```
page score = max(0, 100 − Σ penalty(severity))

penalties: error = 15 pts, warning = 5 pts, info = 1 pt, pass = 0 pts

site score = weighted average of page scores
             (lower-scoring pages carry higher weight)
```

Grade thresholds: **A** ≥ 90, **B** ≥ 75, **C** ≥ 60, **D** ≥ 40, **F** < 40.

Category weights (used for issue priority sorting in `topIssues`):

| Category | Weight |
|----------|--------|
| `onpage` | 1.3× |
| `technical` | 1.2× |
| `content` | 1.0× |
| `performance` | 1.0× |
| `images` | 0.8× |
| `links` | 0.8× |
| `mobile` | 0.7× |
| `schema` | 0.6× |

---

## Custom analyzers

Extend `BaseAnalyzer` to plug in your own checks:

```ts
import { BaseAnalyzer, type AnalyzerContext, type Issue } from 'seo-auditor';

export class OpenGraphAnalyzer extends BaseAnalyzer {
  readonly name = 'onpage' as const; // assign to an existing category

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    const ogTitle = ctx.dom.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      issues.push(
        this.warning(
          'missing-og-title',
          'Missing og:title meta tag',
          'Open Graph og:title is required for rich previews on social platforms.',
          ctx.url,
          { fix: 'Add <meta property="og:title" content="Your page title">.' },
        ),
      );
    } else {
      issues.push(this.pass('og-title-present', 'og:title is set', ctx.url));
    }

    return issues;
  }
}
```

The `BaseAnalyzer` helper methods (`this.error()`, `this.warning()`, `this.pass()`, `this.info()`) all accept `(id, title, description, url, extra?)`.

### Using a custom analyzer

Because `Auditor` builds its analyzers internally from `AnalyzerName` strings, the easiest way to inject custom analyzers is to use `ScoreEngine` directly:

```ts
import { ScoreEngine } from 'seo-auditor';
import { OpenGraphAnalyzer } from './OpenGraphAnalyzer.js';

// Run the custom analyzer against your own fetched pages
const analyzer = new OpenGraphAnalyzer();
const issues = await analyzer.analyze(ctx);

const engine = new ScoreEngine();
const score = engine.computePageScore(issues);
```

---

## Error handling

```ts
import { Auditor, AuditorError } from 'seo-auditor';

try {
  const report = await auditor.run();
} catch (err) {
  if (err instanceof AuditorError) {
    console.error(`[${err.code}] ${err.message}`);
    // err.code is one of:
    //   'INVALID_URL' | 'CONFIG_INVALID' | 'FETCH_FAILED' | 'TIMEOUT' |
    //   'ROBOTS_BLOCKED' | 'PARSE_ERROR' | 'NOT_HTML' | 'PUPPETEER_UNAVAILABLE'
  }
}
```

---

## TypeScript

The library ships with full type declarations. No `@types/` package needed.

```ts
import type {
  AuditConfig,
  AuditReport,
  PageAudit,
  Issue,
  IssueSeverity,
  AnalyzerName,
  TopIssue,
  Grade,
} from 'seo-auditor';
```

**Minimum TypeScript version:** 5.0. Tested through TypeScript 6.0.

---

## Requirements

- **Node.js** ≥ 18 (uses native `fetch` via `undici`, `EventEmitter`, `URL`)
- **ESM only** — `"type": "module"` in your `package.json`, or use `.mjs` files

---

## License

MIT © Mahmudul Hasan
