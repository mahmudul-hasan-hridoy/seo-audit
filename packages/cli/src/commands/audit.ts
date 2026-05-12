import { resolve } from 'node:path';
import chalk from 'chalk';
import { Auditor, Reporter, AuditorError } from 'seo-auditor';
import type { AuditConfig, AnalyzerName } from 'seo-auditor';
import { ProgressReporter } from '../ui/progress.js';
import { renderDashboard, renderSavedPath } from '../ui/dashboard.js';
import { loadConfig } from '../config/loadConfig.js';

export interface AuditCommandOptions {
  maxPages?: string;
  depth?: string;
  concurrency?: string;
  renderJs?: boolean;
  format?: string;
  output?: string;
  config?: string;
  analyzers?: string;
  open?: boolean;
}

/**
 * Implementation of the `seo-audit run <url>` command.
 */
export async function runAuditCommand(
  url: string | undefined,
  opts: AuditCommandOptions,
): Promise<void> {
  // 1. Load config file
  const fileConfig = await loadConfig();

  // 2. Merge: CLI flags override config file, which overrides defaults
  const resolvedUrl = url ?? fileConfig?.url;
  if (!resolvedUrl) {
    console.error(chalk.red('Error: URL is required. Pass a URL or set it in seo-audit.config.ts'));
    process.exit(1);
  }

  const analyzers = opts.analyzers
    ? (opts.analyzers.split(',').map((s) => s.trim()) as AnalyzerName[])
    : fileConfig?.analyzers;

  const config: AuditConfig = {
    url: resolvedUrl,
    ...(opts.maxPages !== undefined
      ? { maxPages: parseInt(opts.maxPages, 10) }
      : fileConfig?.maxPages !== undefined
        ? { maxPages: fileConfig.maxPages }
        : {}),
    ...(opts.depth !== undefined
      ? { crawlDepth: parseInt(opts.depth, 10) }
      : fileConfig?.crawlDepth !== undefined
        ? { crawlDepth: fileConfig.crawlDepth }
        : {}),
    ...(opts.concurrency !== undefined
      ? { concurrency: parseInt(opts.concurrency, 10) }
      : fileConfig?.concurrency !== undefined
        ? { concurrency: fileConfig.concurrency }
        : {}),
    ...(opts.renderJs !== undefined
      ? { renderJs: opts.renderJs }
      : fileConfig?.renderJs !== undefined
        ? { renderJs: fileConfig.renderJs }
        : {}),
    ...(fileConfig?.ignorePatterns !== undefined ? { ignorePatterns: fileConfig.ignorePatterns } : {}),
    ...(analyzers !== undefined ? { analyzers } : {}),
  };

  // 3. Set up progress UI
  const progress = new ProgressReporter();
  progress.start(resolvedUrl);

  // 4. Create auditor and wire progress events
  const auditor = new Auditor(config);

  auditor.on('crawl:start', () => {
    progress.crawlStarted();
  });

  auditor.on('progress', (current, total) => {
    progress.update(current, total, resolvedUrl);
  });

  auditor.on('error', (err, pageUrl) => {
    // Non-fatal errors — don't interrupt, but log later
    process.stderr.write(chalk.gray(`\n  [skip] ${pageUrl ?? 'unknown'}: ${err.message}\n`));
  });

  // 5. Run audit
  let report;
  try {
    report = await auditor.run();
  } catch (err) {
    progress.fail('Audit failed');

    if (err instanceof AuditorError) {
      console.error(chalk.red(`\nError [${err.code}]: ${err.message}`));
    } else {
      console.error(chalk.red(`\nUnexpected error: ${String(err)}`));
    }

    process.exit(1);
  }

  progress.succeed(
    `Crawled ${report.totalPages} pages in ${(report.durationMs / 1000).toFixed(1)}s`,
  );

  // 6. Render dashboard
  renderDashboard(report);

  // 7. Save report
  const format = (opts.format ?? 'json') as 'json' | 'html' | 'markdown';
  const defaultFilename = `audit-${new Date().toISOString().slice(0, 10)}.${format === 'markdown' ? 'md' : format}`;
  const outputPath = opts.output ?? `./reports/${defaultFilename}`;
  const absPath = resolve(outputPath);

  try {
    const reporter = new Reporter();
    const savedPath = await reporter.write(report, { format, outputPath: absPath });
    renderSavedPath(savedPath, format);

    // Open HTML report in browser if requested
    if (opts.open && format === 'html') {
      const { default: open } = await import('open');
      await open(savedPath);
    }
  } catch (err) {
    console.error(chalk.yellow(`Warning: Could not save report: ${String(err)}`));
  }
}
