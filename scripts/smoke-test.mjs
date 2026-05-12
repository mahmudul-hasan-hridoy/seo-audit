#!/usr/bin/env node
/**
 * Smoke test for the seo-auditor library.
 *
 * Usage (from repo root, after `pnpm build`):
 *   node scripts/smoke-test.mjs [url]
 *
 * Default URL is https://example.com — a tiny static page, fast to crawl.
 */

import { Auditor, Reporter, AuditorError } from './packages/core/dist/index.js';

const url = process.argv[2] ?? 'https://example.com';

console.log(`\n  smoke-test: seo-auditor library`);
console.log(`  URL: ${url}\n`);

const auditor = new Auditor({
  url,
  maxPages: 100,
  crawlDepth: 1,
  concurrency: 2,
  analyzers: ['onpage', 'technical', 'mobile', 'schema'],
});

auditor.on('crawl:start', () => console.log('  [event] crawl:start'));
auditor.on('crawl:done', (n) => console.log(`  [event] crawl:done — ${n} page(s) found`));
auditor.on('progress', (cur, tot) => process.stdout.write(`  [event] progress ${cur}/${tot}\r`));
auditor.on('page:audited', (p) => console.log(`  [event] page:audited  ${p.url}  score=${p.score}  grade=${p.grade}`));
auditor.on('error', (err, pageUrl) => console.warn(`  [event] error  ${pageUrl ?? '?'}  ${err.message}`));

let report;
try {
  report = await auditor.run();
} catch (err) {
  if (err instanceof AuditorError) {
    console.error(`\n  FATAL [${err.code}]: ${err.message}`);
  } else {
    console.error(`\n  FATAL: ${err}`);
  }
  process.exit(1);
}

console.log('\n  ── Report summary ──────────────────────');
console.log(`  Site score : ${report.siteScore}/100 (${report.grade})`);
console.log(`  Pages      : ${report.totalPages}`);
console.log(`  Duration   : ${(report.durationMs / 1000).toFixed(2)}s`);
console.log(`  Errors     : ${report.summary.errors}`);
console.log(`  Warnings   : ${report.summary.warnings}`);
console.log(`  Passes     : ${report.summary.passes}`);

if (report.topIssues.length) {
  console.log('\n  Top issues:');
  for (const issue of report.topIssues.slice(0, 5)) {
    const icon = issue.severity === 'error' ? '❌' : '⚠️ ';
    console.log(`    ${icon} [${issue.category}] ${issue.title}`);
  }
}

// Write a JSON report to /tmp so we can verify Reporter too
const reporter = new Reporter();
const savedPath = await reporter.write(report, {
  format: 'json',
  outputPath: '/tmp/seo-smoke-test.json',
});
console.log(`\n  Reporter OK — saved to ${savedPath}`);

console.log('\n  smoke-test PASSED\n');
