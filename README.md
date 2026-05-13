# seo-auditor

A TypeScript SEO site audit tool. Give it a URL, it crawls the site, runs eight analyzers on every page, scores each page 0–100, and returns a structured report.

## Packages

| Package | npm | Description |
|---|---|---|
| [`seo-auditor`](./packages/core) | `npm install seo-auditor` | Node.js library for programmatic use |
| [`@mahmudul-hasan/seo-scan`](./packages/cli) | `npm install -g @mahmudul-hasan/seo-scan` | CLI tool (`seo-audit` command) |

## Quick start

**CLI**

```bash
npm install -g @mahmudul-hasan/seo-scan

seo-audit run https://example.com
seo-audit run https://example.com --format html --open
```

**Library**

```bash
npm install seo-auditor
```

```ts
import { Auditor } from 'seo-auditor';

const report = await new Auditor({ url: 'https://example.com' }).run();
console.log(`${report.siteScore}/100 (${report.grade})`);
```

## Analyzers

Eight analyzers run in parallel on every page:

| Analyzer | Checks |
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

Each page starts at **100**. Issues deduct points:

| Severity | Deduction |
|---|---|
| Error | −15 pts |
| Warning | −5 pts |
| Info | −1 pt |

The site score is a weighted average across pages — lower-scoring pages carry more weight to surface critical problems. Grades: **A** (90+) · **B** (75+) · **C** (60+) · **D** (40+) · **F** (<40).

## Development

```bash
pnpm install
pnpm build    # build both packages
pnpm test     # run all tests
```

## Repo structure

```
packages/
  core/   → seo-auditor (library)
  cli/    → @mahmudul-hasan/seo-scan (CLI)
```

## License

MIT
