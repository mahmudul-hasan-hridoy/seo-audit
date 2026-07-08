# seo-audit CLI

[![npm](https://img.shields.io/npm/v/@mahmudul-hasan/seo-scan)](https://www.npmjs.com/package/@mahmudul-hasan/seo-scan)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A professional-grade command-line SEO site auditor. Crawl any public website, run 8 SEO analyzer modules in parallel, and get a scored report — all from your terminal.

```
  ● SEO AUDITOR

  URL:     https://example.com
  Pages:   3 crawled in 1.4s
  Score:   84/100 (B)

  ❌  2 errors
  ⚠️   7 warnings
  ✅  31 passed
  ℹ️   4 info

  Top Issues
  ──────────────────────────────────────────────────
  ❌  Missing <title> tag               onpage    2 pages
  ⚠️   No gzip/brotli compression        performance  3 pages
  ⚠️   Multiple render-blocking scripts  performance  2 pages
```

---

## Installation

```sh
npm install -g @mahmudul-hasan/seo-scan
```

Or run without installing:

```sh
npx @mahmudul-hasan/seo-scan run https://example.com
```

---

## Commands

### `seo-audit run <url>`

Crawl and audit a website.

```sh
seo-audit run https://example.com [options]
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--max-pages <n>` | `100` | Maximum number of pages to crawl |
| `--depth <n>` | `3` | Maximum BFS crawl depth from the root URL |
| `--concurrency <n>` | `5` | Number of pages fetched in parallel |
| `--format <fmt>` | `json` | Output format: `json`, `html`, `markdown` |
| `--output <path>` | `./reports/audit-<date>.<ext>` | Path to write the report |
| `--render-js` | `false` | Use a headless browser to render JavaScript before auditing |
| `--analyzers <list>` | all | Comma-separated list of analyzers to enable |
| `--config <path>` | auto-detected | Path to a config file |
| `--open` | `false` | Open the HTML report in your default browser after saving |

**Examples**

```sh
# Quick audit, print dashboard, save JSON
seo-audit run https://example.com

# Audit up to 200 pages, 8 parallel, save HTML report and open it
seo-audit run https://example.com \
  --max-pages 200 \
  --concurrency 8 \
  --format html \
  --output ./reports/example.html \
  --open

# Run only on-page and technical checks
seo-audit run https://example.com \
  --analyzers onpage,technical

# Audit a React/Vue/Angular app (requires puppeteer installed)
seo-audit run https://example.com --render-js
```

---

### `seo-audit report <file>`

Convert a previously saved JSON audit report to another format.

```sh
seo-audit report <json-file> [options]
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--format <fmt>` | `html` | Output format: `html`, `markdown`, `json` |
| `--output <path>` | `<input>.<ext>` | Path to write the converted report |
| `--open` | `false` | Open the report in your browser after converting |

**Examples**

```sh
# Convert a stored JSON report to a standalone HTML dashboard
seo-audit report ./reports/audit-2026-07-08.json --format html --open

# Convert to Markdown for inclusion in a PR comment
seo-audit report ./reports/audit-2026-07-08.json --format markdown --output AUDIT.md
```

---

### `seo-audit schedule <url>`

Run an immediate audit, then print a ready-to-use `cron` expression and CI command so you can automate recurring audits.

```sh
seo-audit schedule <url> [options]
```

**Options**

| Flag | Default | Description |
|------|---------|-------------|
| `--cron <expr>` | `0 6 * * *` | Cron expression describing the desired schedule |
| `--format <fmt>` | `json` | Report format for each scheduled run |
| `--output-dir <path>` | `./reports` | Directory to write reports into |
| `--max-pages <n>` | `50` | Maximum pages per scheduled run |

**Example**

```sh
# Run now and get a cron line for every day at 06:00
seo-audit schedule https://example.com --cron "0 6 * * *" --format html

# Output:
#   ✓ Initial audit complete.
#   
#   To automate recurring audits, add this to your crontab:
#   
#   0 6 * * *  seo-audit run https://example.com --format html --output-dir ./reports
```

> **Note:** The `schedule` command does not install or manage a cron daemon. It runs the audit once and prints the commands needed to automate future runs in your CI/CD pipeline or crontab.

---

## Config file

Create an `seo-audit.config.ts` (or `.js` / `.mjs`) in your project root to persist common options:

```ts
// seo-audit.config.ts
import { defineConfig } from 'seo-auditor';

export default defineConfig({
  url: 'https://example.com',
  maxPages: 200,
  crawlDepth: 4,
  concurrency: 8,
  timeout: 15_000,
  respectRobotsTxt: true,
  ignorePatterns: [
    '*/wp-admin/*',
    '*/cart/*',
    '*?utm_*',
  ],
  analyzers: [
    'onpage',
    'technical',
    'performance',
    'images',
    'links',
    'content',
    'mobile',
    'schema',
  ],
});
```

CLI flags always override config file values. Config file values override built-in defaults.

The CLI searches the current working directory for the following file names (in order):

1. `seo-audit.config.ts`
2. `seo-audit.config.js`
3. `seo-audit.config.mjs`

---

## Analyzers

| Name | What it checks |
|------|----------------|
| `onpage` | Title tag, meta description, H1/heading hierarchy, `lang` attribute |
| `technical` | HTTPS, HSTS, canonical tags, robots meta/headers, redirect chains |
| `performance` | Server response time, gzip/brotli, render-blocking resources, HTML size, `Cache-Control` |
| `content` | Word count, thin content detection |
| `images` | Alt text, explicit dimensions (CLS), lazy-loading, WebP/AVIF format adoption |
| `links` | Broken internal links, empty/generic anchor text |
| `mobile` | Viewport meta tag, responsive design signals |
| `schema` | JSON-LD presence, `@type`/`@context` validity |

---

## Output formats

### HTML

A fully self-contained single-file dashboard with:
- SVG score ring with letter grade
- Summary stat cards (errors / warnings / passed / info)
- Top Issues table (deduplicated, sorted by severity × pages affected)
- Expandable per-page cards with issue details and fix suggestions
- No external dependencies — everything is inlined

### Markdown

Structured report suitable for GitHub PRs, Notion, or any Markdown renderer:
- Site score and grade summary table
- Top issues table with category and affected page count
- Collapsible per-page issue breakdowns with fix text

### JSON

Machine-readable `AuditReport` object serialized to JSON. Use this format to:
- Feed results into your own dashboards or alerting pipelines
- Store historical reports and diff scores over time
- Convert later with `seo-audit report`

---

## CI/CD integration

### GitHub Actions

```yaml
# .github/workflows/seo-audit.yml
name: SEO Audit

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 06:00 UTC

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm install -g @mahmudul-hasan/seo-scan

      - run: |
          seo-audit run ${{ vars.SITE_URL }} \
            --max-pages 200 \
            --format html \
            --output audit.html

      - uses: actions/upload-artifact@v4
        with:
          name: seo-report
          path: audit.html
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Audit completed successfully |
| `1` | Fatal error (invalid URL, network failure, config error) |

---

## Requirements

- **Node.js** ≥ 18
- For `--render-js`: [Puppeteer](https://purl.pt/docs/guides/puppeteer/) must be installed separately (`npm install puppeteer`)

---

## Related

- [`seo-auditor`](../core/README.md) — the underlying Node.js library

---

## License

MIT © Mahmudul Hasan
