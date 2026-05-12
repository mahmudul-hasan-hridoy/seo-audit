import { resolve, join } from 'node:path';
import chalk from 'chalk';
import { Auditor, Reporter, AuditorError } from 'seo-auditor';
import type { AuditConfig } from 'seo-auditor';
import { ProgressReporter } from '../ui/progress.js';
import { renderDashboard } from '../ui/dashboard.js';

export interface ScheduleCommandOptions {
  cron?: string;
  format?: string;
  outputDir?: string;
  maxPages?: string;
}

/**
 * Implementation of the `seo-audit schedule <url>` command.
 * Runs the audit immediately and sets up a cron schedule for future runs.
 */
export async function runScheduleCommand(
  url: string,
  opts: ScheduleCommandOptions,
): Promise<void> {
  const cron = opts.cron ?? '0 6 * * *';
  const format = (opts.format ?? 'json') as 'json' | 'html' | 'markdown';
  const outputDir = resolve(opts.outputDir ?? './reports');

  console.log();
  console.log(chalk.bold('  SEO AUDITOR  ') + chalk.cyan('Scheduler'));
  console.log(chalk.gray('  ─'.repeat(28)));
  console.log();
  console.log(`  ${chalk.bold('URL:')}        ${chalk.cyan(url)}`);
  console.log(`  ${chalk.bold('Schedule:')}   ${chalk.yellow(cron)} (cron)`);
  console.log(`  ${chalk.bold('Format:')}     ${format}`);
  console.log(`  ${chalk.bold('Output dir:')} ${outputDir}`);
  console.log();

  console.log(chalk.bold('  Running initial audit now...'));
  console.log();

  await runSingleAudit(url, {
    format,
    outputDir,
    ...(opts.maxPages !== undefined ? { maxPages: opts.maxPages } : {}),
  });

  console.log();
  console.log(chalk.green('  ✓ Initial audit complete.'));
  console.log();
  console.log(
    chalk.gray(
      `  To automate recurring audits, add this to your crontab or CI pipeline:`,
    ),
  );
  console.log();
  console.log(
    chalk.cyan(`  ${cron}  seo-audit run ${url} --format ${format} --output-dir ${outputDir}`),
  );
  console.log();
  console.log(
    chalk.gray(
      `  For CI/CD, run: seo-audit run ${url} as a post-deploy step to catch regressions.`,
    ),
  );
  console.log();
}

async function runSingleAudit(
  url: string,
  opts: { format: 'json' | 'html' | 'markdown'; outputDir: string; maxPages?: string },
): Promise<void> {
  const config: AuditConfig = {
    url,
    maxPages: opts.maxPages ? parseInt(opts.maxPages, 10) : 50,
  };

  const progress = new ProgressReporter();
  progress.start(url);

  const auditor = new Auditor(config);

  auditor.on('crawl:start', () => {
    progress.crawlStarted();
  });

  auditor.on('progress', (current, total) => {
    progress.update(current, total, url);
  });

  auditor.on('error', (err, pageUrl) => {
    process.stderr.write(chalk.gray(`\n  [skip] ${pageUrl ?? 'unknown'}: ${err.message}\n`));
  });

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

  renderDashboard(report);

  const ext = opts.format === 'markdown' ? 'md' : opts.format;
  const filename = `audit-${new Date().toISOString().slice(0, 10)}.${ext}`;
  const outputPath = join(opts.outputDir, filename);

  const reporter = new Reporter();
  try {
    const savedPath = await reporter.write(report, { format: opts.format, outputPath });
    console.log(`  ${chalk.bold('Report saved')} → ${chalk.cyan(savedPath)}`);
  } catch (err) {
    console.error(chalk.yellow(`Warning: Could not save report: ${String(err)}`));
  }
}
