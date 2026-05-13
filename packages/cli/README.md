# seo-audit CLI

[![npm](https://img.shields.io/npm/v/@mahmudul-hasan/seo-scan)](https://www.npmjs.com/package/@mahmudul-hasan/seo-scan)
[![license](https://img.shields.io/npm/l/@mahmudul-hasan/seo-scan)](./LICENSE)

Terminal tool for SEO site auditing. Crawls a site, runs eight analyzers on every page, and prints a colour-coded dashboard with the top issues.

**Requirements:** Node.js 18+

## Installation

```bash
npm install -g @mahmudul-hasan/seo-scan
```

## Commands

- [`seo-audit run`](#seo-audit-run) — audit a site
- [`seo-audit report`](#seo-audit-report) — view or convert a saved report
- [`seo-audit schedule`](#seo-audit-schedule) — set up recurring audits

---

## seo-audit run

```bash
seo-audit run https://example.com
```

| Flag | Default | Description |
|---|---|---|
| `--max-pages <n>` | `100` | Maximum pages to crawl |
| `--depth <n>` | `3` | Maximum crawl depth from root |
| `--concurrency <n>` | `5` | Concurrent page fetches |
| `--timeout <ms>` | `10000` | Per-request timeout in milliseconds |
| `--render-js` | off | Use Puppeteer for JS-rendered pages |
| `--format <fmt>` | `json` | `json`, `html`, or `markdown` |
| `--output <path>` | `./reports/audit-YYYY-MM-DD.<ext>` | Output file path |
| `--analyzers <list>` | all | Comma-separated subset of analyzers to run |
| `--no-robots` | — | Ignore robots.txt disallow rules |
| `--config <path>` | auto-detected | Path to config file |
| `--open` | off | Open HTML report in browser after saving |

```bash
# Save as HTML and open in browser
seo-audit run https://example.com --format html --open

# Limit scope, output to a specific path
seo-audit run https://example.com --max-pages 50 --output ./reports/audit.json

# Run only on-page and technical checks
seo-audit run https://example.com --analyzers onpage,technical

# Audit a JS-heavy site
seo-audit run https://example.com --render-js
```

---

## seo-audit report

Convert a saved JSON report to HTML or Markdown.

```bash
seo-audit report ./reports/audit.json --format html --open
```

| Flag | Default | Description |
|---|---|---|
| `--format <fmt>` | `html` | `json`, `html`, or `markdown` |
| `--output <path>` | same name, new extension | Output file path |
| `--open` | off | Open HTML report in browser after saving |

---

## seo-audit schedule

Runs an audit immediately, then prints the cron/CI snippet needed to automate future runs.

```bash
seo-audit schedule https://example.com --cron "0 6 * * *"
```

| Flag | Default | Description |
|---|---|---|
| `--cron <expression>` | `0 6 * * *` | Cron expression |
| `--format <fmt>` | `json` | Report format |
| `--output-dir <path>` | `./reports` | Directory for saved reports |
| `--max-pages <n>` | `50` | Max pages per scheduled audit |

---

## Config file

Create `seo-audit.config.ts` (or `.js` / `.mjs`) in your project root. CLI flags always take priority.

```ts
// seo-audit.config.ts
import { defineConfig } from 'seo-auditor';

export default defineConfig({
  url: 'https://example.com',
  maxPages: 150,
  crawlDepth: 4,
  concurrency: 8,
  ignorePatterns: ['**/admin/**', '**/login'],
  analyzers: ['onpage', 'technical', 'performance', 'images'],
});
```

Specify a custom path with `--config ./path/to/config.ts`.

---

## Troubleshooting

**Crawl finds very few pages** — Increase `--depth`. If the site requires JavaScript to render links, add `--render-js` (requires `npm install puppeteer`).

**Pages being skipped** — Check `robots.txt` (use `--no-robots` to bypass). The server may be returning 4xx/5xx, or requests may be timing out (increase `--timeout`).

**Config file fails to load** — Switch from `.ts` to `.js` or `.mjs` if you see an import error.

---

## License

MIT
