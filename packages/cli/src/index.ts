#!/usr/bin/env node
import { Command } from 'commander';
import { runAuditCommand } from './commands/audit.js';
import { runReportCommand } from './commands/report.js';
import { runScheduleCommand } from './commands/schedule.js';

const program = new Command();

program
  .name('seo-audit')
  .description('Professional-grade SEO site audit tool')
  .version('0.1.0');

program
  .command('run [url]')
  .description('Run a full SEO audit on a website')
  .option('--max-pages <number>', 'Maximum number of pages to crawl')
  .option('--depth <number>', 'Maximum crawl depth from root URL')
  .option('--concurrency <number>', 'Number of concurrent page fetches')
  .option('--render-js', 'Use Puppeteer for JS-rendered pages')
  .option('--format <format>', 'Output format: json, html, markdown', 'json')
  .option('--output <path>', 'Output file path for the report')
  .option('--config <path>', 'Path to seo-audit.config.ts')
  .option('--analyzers <list>', 'Comma-separated list of analyzers to run')
  .option('--open', 'Open HTML report in browser after completion')
  .action(runAuditCommand);

program
  .command('report <file>')
  .description('View or convert a saved audit report')
  .option('--format <format>', 'Output format: json, html, markdown', 'html')
  .option('--output <path>', 'Output file path')
  .option('--open', 'Open report in browser after conversion')
  .action(runReportCommand);

program
  .command('schedule <url>')
  .description('Schedule recurring SEO audits with a cron expression')
  .option('--cron <expression>', 'Cron expression (e.g. "0 6 * * *" for 6am daily)')
  .option('--format <format>', 'Output format: json, html, markdown', 'json')
  .option('--output-dir <path>', 'Directory to save reports', './reports')
  .option('--max-pages <number>', 'Maximum pages per audit')
  .action(runScheduleCommand);

program.parse(process.argv);
