# seo-auditor

[![npm](https://img.shields.io/npm/v/seo-auditor)](https://www.npmjs.com/package/seo-auditor)
[![license](https://img.shields.io/npm/l/seo-auditor)](./LICENSE)

A professional-grade Node.js library for programmatic SEO site auditing. Give it a URL and it crawls your site, runs eight parallel analyzers on every page, scores each page 0–100, and returns a structured report — all without a browser.

## Installation

```bash
npm install seo-auditor
# or
pnpm add seo-auditor
```

**Requirements:** Node.js 18+

## Quick start

```ts
import { Auditor } from 'seo-auditor';

const auditor = new Auditor({
  url: 'https://example.com',
  maxPages: 100,
});

const report = await auditor.run();

console.log(`Site score: ${report.siteScore}/100 (${report.grade})`);
console.log(`Pages crawled: ${report.totalPages}`);
console.log(`Errors: ${report.summary.errors}`);
console.log(`Warnings: ${report.summary.warnings}`);
```

## Configuration

Pass an `AuditConfig` object to the `Auditor` constructor. All fields except `url` are optional.

```ts
import { Auditor, defineConfig } from 'seo-auditor';

const config = defineConfig({
  url: 'https://example.com',   // Required. Absolute URL with protocol.

  maxPages: 100,                // Max pages to crawl. Default: 100
  crawlDepth: 3,                // Max link depth from root. Default: 3
  concurrency: 5,               // Concurrent page fetches. Default: 5
  timeout: 10000,               // Request timeout in ms. Default: 10000

  respectRobotsTxt: true,       // Honour robots.txt disallow rules. Default: true
  renderJs: false,              // Use Puppeteer for JS-rendered pages. Default: false
  userAgent: 'MyBot/1.0',       // Custom User-Agent string.

  ignorePatterns: [             // URL patterns to skip (glob-style)
    '**/admin/**',
    '**/login',
    '**/*.pdf',
  ],

  analyzers: [                  // Run only a subset of analyzers
    'onpage',
    'technical',
    'performance',
  ],
});

const auditor = new Auditor(config);
```

### `defineConfig` helper

`defineConfig` is an identity function that provides full TypeScript type inference in a config file:

```ts
// seo-audit.config.ts
import { defineConfig } from 'seo-auditor';

export default defineConfig({
  url: 'https://example.com',
  maxPages: 200,
  crawlDepth: 4,
  ignorePatterns: ['**/wp-admin/**'],
});
```

## Events

`Auditor` extends `EventEmitter`. Subscribe to events for progress reporting or custom integrations.

```ts
const auditor = new Auditor({ url: 'https://example.com' });

// Fires when the crawler begins
auditor.on('crawl:start', () => {
  console.log('Crawling started…');
});

// Fires on each fetched page during the crawl phase
auditor.on('progress', (current, total) => {
  console.log(`Crawled ${current} / ${total} pages`);
});

// Fires when the crawl phase is fully complete
auditor.on('crawl:done', (totalPages) => {
  console.log(`Crawl finished — ${totalPages} pages found`);
});

// Fires once per page after it has been fully analyzed
auditor.on('page:audited', (page) => {
  console.log(`${page.url}  score=${page.score}  grade=${page.grade}`);
});

// Non-fatal errors (failed fetches, analyzer failures)
// The audit continues — errored pages are skipped
auditor.on('error', (err, url) => {
  console.error(`Skipped ${url}: ${err.message}`);
});

const report = await auditor.run();
```

### Event reference

| Event | Arguments | When |
|---|---|---|
| `crawl:start` | — | Before the crawler begins fetching pages |
| `progress` | `(current: number, total: number)` | After each page is fetched during the crawl |
| `crawl:done` | `(totalPages: number)` | After all pages have been fetched |
| `page:audited` | `(page: PageAudit)` | After each page has been fully analyzed |
| `error` | `(err: Error, url?: string)` | On any non-fatal fetch or analyzer error |

## Report structure

`auditor.run()` resolves with an `AuditReport`:

```ts
interface AuditReport {
  siteUrl: string;       // Root URL that was audited
  totalPages: number;    // Number of pages crawled
  siteScore: number;     // Average score across all pages (0–100)
  grade: Grade;          // 'A' | 'B' | 'C' | 'D' | 'F'

  summary: {
    errors: number;      // Total error-severity findings
    warnings: number;    // Total warning-severity findings
    passes: number;      // Total passing checks
    info: number;        // Total info-level findings
  };

  pages: PageAudit[];    // Per-page results (see below)
  topIssues: Issue[];    // Top 10 most impactful issues site-wide
  auditedAt: Date;       // When the audit started
  durationMs: number;    // Total wall-clock time in ms
}
```

### `PageAudit`

```ts
interface PageAudit {
  url: string;           // Final URL (after redirects)
  statusCode: number;    // HTTP status code
  loadTimeMs: number;    // Total fetch time in ms
  issues: Issue[];       // All findings for this page
  score: number;         // 0–100 score for this page
  grade: Grade;          // Letter grade
  auditedAt: Date;       // Timestamp
}
```

### `Issue`

```ts
interface Issue {
  id: string;            // Stable identifier e.g. "missing-title-tag"
  title: string;         // Short human-readable title
  description: string;   // Detailed description
  severity: IssueSeverity; // 'error' | 'warning' | 'pass' | 'info'
  category: AnalyzerName;  // Which analyzer produced this
  affectedUrl: string;   // The page URL
  fix?: string;          // Actionable fix suggestion
  docs?: string;         // Reference link
  value?: string|number; // Actual value found
  expected?: string|number; // Expected value for a pass
}
```

## Report output

Use the `Reporter` class to save reports to disk.

```ts
import { Auditor, Reporter } from 'seo-auditor';

const auditor = new Auditor({ url: 'https://example.com' });
const report = await auditor.run();

const reporter = new Reporter();

// Save as JSON (default)
await reporter.write(report, {
  format: 'json',
  outputPath: './reports/audit.json',
});

// Save as HTML
await reporter.write(report, {
  format: 'html',
  outputPath: './reports/audit.html',
});

// Save as Markdown
await reporter.write(report, {
  format: 'markdown',
  outputPath: './reports/audit.md',
});

// Or just serialize to a string without writing a file
const html = reporter.serialize(report, 'html');
```

`Reporter.write` creates parent directories automatically and returns the absolute path of the saved file.

## Analyzers

Eight analyzers run **in parallel** on every page. Use the `analyzers` config option to run a subset.

### `onpage` — On-page SEO

| Check | Severity when failing |
|---|---|
| Title tag present | Error |
| Title tag not empty | Error |
| Title length 10–60 chars | Warning |
| Meta description present | Warning |
| Meta description length 50–160 chars | Warning |
| Exactly one H1 tag | Error / Warning |
| H1 not empty | Warning |
| Duplicate title across pages | Warning |

### `technical` — Technical SEO

| Check | Severity when failing |
|---|---|
| URL uses HTTPS | Error |
| HSTS header present | Warning |
| Canonical tag present | Warning |
| Canonical `href` not empty | Error |
| robots meta not `noindex` | Error |
| robots meta not `nofollow` | Warning |
| Redirect chain ≤ 1 hop | Warning |
| X-Robots-Tag not `noindex` | Error |

### `performance` — Page performance

| Check | Severity when failing |
|---|---|
| Load time < 3 s | Error |
| Load time < 5 s | Warning |
| HTML size < 200 KB | Warning |
| HTML size < 500 KB | Error |
| Preconnect / dns-prefetch hints present | Info |

### `images` — Image optimisation

| Check | Severity when failing |
|---|---|
| All images have `alt` attributes | Error |
| All images have explicit `width`/`height` (CLS) | Warning |
| Most images use `loading="lazy"` | Warning |
| Images use next-gen formats (WebP/AVIF) | Info |

### `links` — Link quality

| Check | Severity when failing |
|---|---|
| At least 3 internal links | Warning |
| No generic anchor text ("click here", "read more") | Warning |
| Fewer than 150 links per page | Warning |

### `content` — Content quality

| Check | Severity when failing |
|---|---|
| Word count ≥ 300 | Warning |
| Content not flagged as thin (< 100 words) | Error |
| Readability — content visible to text extractor | Warning |

### `mobile` — Mobile friendliness

| Check | Severity when failing |
|---|---|
| Viewport meta tag present | Error |
| Viewport includes `width=device-width` | Warning |
| Viewport does not prevent user zooming | Warning |
| No inline `text-size-adjust: none` | Warning |
| No tiny tap targets (`width`/`height` < 48 px) | Warning |

### `schema` — Structured data & social

| Check | Severity when failing |
|---|---|
| JSON-LD block present | Info |
| Valid JSON-LD (parseable) | Warning |
| Open Graph `og:title` present | Warning |
| Open Graph `og:description` present | Warning |
| Open Graph `og:image` present | Warning |
| Twitter Card `twitter:card` tag | Info |

## Custom analyzers

Extend `BaseAnalyzer` to build your own:

```ts
import { BaseAnalyzer, Auditor } from 'seo-auditor';
import type { AnalyzerContext } from 'seo-auditor';
import type { Issue } from 'seo-auditor';

class BrandAnalyzer extends BaseAnalyzer {
  readonly name = 'onpage' as const; // must be a valid AnalyzerName

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const hasBrandMention = ctx.html.includes('Acme Corp');

    if (!hasBrandMention) {
      return [
        this.warning(
          'missing-brand-mention',
          'Brand name not found on page',
          'Include the brand name at least once in the page content.',
          ctx.url,
          { fix: 'Add "Acme Corp" to the page heading or body copy.' },
        ),
      ];
    }

    return [this.pass('brand-mention', 'Brand name found', ctx.url)];
  }
}
```

`BaseAnalyzer` provides four helper methods: `this.pass()`, `this.error()`, `this.warning()`, `this.info()`.

## Error handling

`Auditor.run()` throws an `AuditorError` for configuration or fatal startup errors. Non-fatal per-page errors (failed fetches, timeouts) are emitted via the `error` event and do not abort the audit.

```ts
import { Auditor, AuditorError } from 'seo-auditor';

try {
  const report = await new Auditor({ url: 'not-a-url' }).run();
} catch (err) {
  if (err instanceof AuditorError) {
    console.error(`[${err.code}] ${err.message}`);
    // err.code is one of:
    //   'INVALID_URL' | 'FETCH_FAILED' | 'TIMEOUT' | 'ROBOTS_BLOCKED'
    //   'PARSE_ERROR' | 'PUPPETEER_UNAVAILABLE' | 'CONFIG_INVALID'
  }
}
```

## Scoring algorithm

Each page starts at **100 points**. Issues deduct points based on severity:

| Severity | Deduction |
|---|---|
| `error` | −15 pts |
| `warning` | −5 pts |
| `info` | −1 pt |
| `pass` | 0 pts |

The minimum page score is 0. The **site score** is the rounded average across all pages.

| Score range | Grade |
|---|---|
| 90 – 100 | A |
| 75 – 89 | B |
| 60 – 74 | C |
| 40 – 59 | D |
| 0 – 39 | F |

## TypeScript

The library is written in strict TypeScript and ships its own type declarations. No `@types/*` packages needed.

```ts
import type {
  AuditConfig,
  AuditReport,
  PageAudit,
  Issue,
  IssueSeverity,
  AnalyzerName,
  Grade,
  AuditorEvents,
} from 'seo-auditor';
```

## CI / CD integration

```ts
// ci-seo-check.ts
import { Auditor } from 'seo-auditor';

const report = await new Auditor({
  url: process.env.SITE_URL!,
  maxPages: 50,
  analyzers: ['onpage', 'technical'],
}).run();

if (report.siteScore < 70) {
  console.error(`SEO score too low: ${report.siteScore}/100`);
  process.exit(1);
}

console.log(`SEO score: ${report.siteScore}/100 — OK`);
```

## License

MIT
