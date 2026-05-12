# seo-audit CLI

[![npm](https://img.shields.io/npm/v/seo-audit-cli)](https://www.npmjs.com/package/seo-audit-cli)
[![license](https://img.shields.io/npm/l/seo-audit-cli)](./LICENSE)

A command-line tool for professional SEO site auditing. Crawls your entire website, runs eight SEO analyzers on every page, prints a colour-coded dashboard in your terminal, and saves reports in JSON, HTML, or Markdown.

## Installation

```bash
# Global install (recommended)
npm install -g seo-audit

# Or run without installing via npx
npx seo-audit run https://example.com
```

**Requirements:** Node.js 18+

## Commands

- [`seo-audit run`](#seo-audit-run-url) — Audit a website
- [`seo-audit report`](#seo-audit-report-file) — View or convert a saved report
- [`seo-audit schedule`](#seo-audit-schedule-url) — Set up recurring audits

---

## `seo-audit run [url]`

Run a full SEO audit on a website and display results in the terminal.

```bash
seo-audit run https://example.com
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--max-pages <n>` | `100` | Maximum pages to crawl |
| `--depth <n>` | `3` | Maximum crawl depth from root |
| `--concurrency <n>` | `5` | Concurrent page fetches |
| `--render-js` | off | Use Puppeteer for JS-rendered pages |
| `--format <format>` | `json` | Report format: `json`, `html`, `markdown` |
| `--output <path>` | `./reports/audit-YYYY-MM-DD.<ext>` | Output file path |
| `--config <path>` | auto-detected | Path to `seo-audit.config.ts` / `.js` |
| `--analyzers <list>` | all | Comma-separated analyzer names to run |
| `--open` | off | Open HTML report in the browser after saving |

### Examples

```bash
# Basic audit with defaults (up to 100 pages, JSON report)
seo-audit run https://example.com

# Limit to 50 pages, save as HTML and open in browser
seo-audit run https://example.com --max-pages 50 --format html --open

# Deep crawl, markdown output, save to a specific path
seo-audit run https://example.com --depth 5 --format markdown --output ./audit.md

# Run only on-page and technical checks
seo-audit run https://example.com --analyzers onpage,technical

# Save report as JSON to a custom path
seo-audit run https://example.com --format json --output ./ci/seo-report.json

# Use Puppeteer to render JavaScript-heavy pages
seo-audit run https://example.com --render-js
```

### Terminal output

After the crawl completes, a colour-coded dashboard is printed:

```
  SEO AUDIT REPORT
  ────────────────────────────────────
  Site:      https://example.com
  Pages:     42
  Score:     78/100
  Grade:     B
  Duration:  14.3s
  ────────────────────────────────────
  Summary:  ❌ 3 errors  ⚠️ 12 warnings  ✅ 87 passes  ℹ️ 5 info

  TOP ISSUES
  ❌ Missing title tag              (8 pages)
  ⚠️ Meta description too long     (5 pages)
  ⚠️ Images missing alt text       (4 pages)
  …

  Report saved → ./reports/audit-2026-05-12.json
```

---

## `seo-audit report <file>`

Read a previously saved JSON report and convert it to HTML or Markdown.

```bash
seo-audit report ./reports/audit-2026-05-12.json
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--format <format>` | `html` | Output format: `json`, `html`, `markdown` |
| `--output <path>` | Same path as input, new extension | Output file path |
| `--open` | off | Open HTML report in the browser after saving |

### Examples

```bash
# Convert a JSON report to HTML and open in browser
seo-audit report ./reports/audit.json --format html --open

# Convert to Markdown and save to a specific path
seo-audit report ./reports/audit.json --format markdown --output ./docs/seo-audit.md

# Re-save as JSON to a new location
seo-audit report ./reports/audit.json --format json --output ./archive/audit-may.json
```

---

## `seo-audit schedule <url>`

Runs an immediate audit, then prints the cron command and CI/CD snippet you need to automate future runs.

```bash
seo-audit schedule https://example.com --cron "0 6 * * *"
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--cron <expression>` | `0 6 * * *` | Cron expression for the schedule |
| `--format <format>` | `json` | Report format: `json`, `html`, `markdown` |
| `--output-dir <path>` | `./reports` | Directory where reports are saved |
| `--max-pages <n>` | `50` | Max pages per scheduled audit |

### Examples

```bash
# Run now, schedule daily at 6am, save to ./reports
seo-audit schedule https://example.com

# Custom cron — every Monday at 8am, HTML reports
seo-audit schedule https://example.com --cron "0 8 * * 1" --format html

# Save to a custom directory
seo-audit schedule https://example.com --output-dir ./audits/weekly

# Limit pages per run
seo-audit schedule https://example.com --max-pages 200
```

The command prints the exact `crontab` line and CI/CD snippet to copy:

```
  To automate recurring audits, add this to your crontab or CI pipeline:

  0 6 * * *  seo-audit run https://example.com --format json --output-dir ./reports

  For CI/CD, run: seo-audit run https://example.com as a post-deploy step
  to catch regressions.
```

---

## Config file

Instead of passing flags every time, create an `seo-audit.config.ts` (or `.js` / `.mjs`) in your project root. CLI flags always take priority over the config file.

```ts
// seo-audit.config.ts
import { defineConfig } from 'seo-auditor';

export default defineConfig({
  url: 'https://example.com',
  maxPages: 150,
  crawlDepth: 4,
  concurrency: 8,
  ignorePatterns: [
    '**/admin/**',
    '**/login',
    '**/logout',
    '**/*.pdf',
  ],
  analyzers: ['onpage', 'technical', 'performance', 'images'],
});
```

The CLI automatically detects and loads `seo-audit.config.ts`, `seo-audit.config.js`, and `seo-audit.config.mjs` from the current working directory. You can also specify the path explicitly:

```bash
seo-audit run --config ./config/seo.config.ts
```

### Config precedence (highest to lowest)

1. CLI flags
2. Config file values
3. Built-in defaults

---

## Analyzers

| Name | What it checks |
|---|---|
| `onpage` | Title, meta description, headings (H1–H6), duplicate titles |
| `technical` | HTTPS, canonical tags, robots directives, redirect chains |
| `performance` | Load time, page size, resource hints |
| `images` | Alt text, explicit dimensions, lazy loading, next-gen formats |
| `links` | Internal link count, anchor text, total link count |
| `content` | Word count, thin content, readability |
| `mobile` | Viewport meta, font scaling, tap target sizes |
| `schema` | JSON-LD structured data, Open Graph, Twitter Card |

Run a subset with `--analyzers`:

```bash
seo-audit run https://example.com --analyzers onpage,technical,mobile
```

---

## Report formats

### JSON (`--format json`)

A complete machine-readable report. Suitable for parsing in CI scripts, feeding dashboards, or archiving. Contains every page's full issue list with scores, grades, and metadata.

```bash
seo-audit run https://example.com --format json --output ./reports/audit.json
```

### HTML (`--format html`)

A self-contained HTML file with a styled dashboard. No external dependencies — open it in any browser offline.

```bash
seo-audit run https://example.com --format html --open
```

### Markdown (`--format markdown`)

A portable Markdown report ideal for committing to a repository, posting in GitHub issues, or embedding in documentation.

```bash
seo-audit run https://example.com --format markdown --output ./docs/seo.md
```

---

## CI / CD integration

### GitHub Actions

```yaml
# .github/workflows/seo-audit.yml
name: SEO Audit

on:
  push:
    branches: [main]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install seo-audit CLI
        run: npm install -g seo-audit-cli

      - name: Run SEO audit
        run: seo-audit run ${{ vars.SITE_URL }} --format json --output ./audit.json

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: seo-report
          path: ./audit.json
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Audit completed successfully |
| `1` | Fatal error (invalid URL, config error, unrecoverable failure) |

Note: a low site score does **not** produce a non-zero exit code from the CLI. Use the [seo-auditor library](../core/README.md) directly in a script if you need to fail CI based on score thresholds.

### Score-gated CI script

```bash
#!/usr/bin/env node
# fail-on-low-score.mjs
import { Auditor } from 'seo-auditor';

const report = await new Auditor({
  url: process.env.SITE_URL,
  maxPages: 50,
}).run();

if (report.siteScore < 70) {
  console.error(`SEO score ${report.siteScore}/100 is below threshold (70)`);
  process.exit(1);
}
console.log(`SEO score: ${report.siteScore}/100 — OK`);
```

---

## Troubleshooting

### The crawl finds very few pages

- Increase `--depth` (default is 3).
- Check that your site's internal links use relative paths or the same domain.
- If your site requires JavaScript to render links, add `--render-js` (requires Puppeteer to be installed).

### Pages are being skipped

Non-fatal fetch errors are printed to stderr with `[skip]`. Common causes:
- The server returned 4xx/5xx for those pages.
- Your site's `robots.txt` disallows those paths. Use `respectRobotsTxt: false` in your config file to override.
- The request timed out. Increase `timeout` in your config file (e.g. `timeout: 30000`).

### The HTML report won't open

Make sure you pass `--format html` alongside `--open`. The `--open` flag only works with HTML format.

### TypeScript config file fails to load

The CLI loads `.ts` config files via Node's native ESM `import()`. If you see a load error, switch to `.js` or `.mjs`:

```js
// seo-audit.config.js
export default {
  url: 'https://example.com',
  maxPages: 100,
};
```

---

## License

MIT
