import ora, { type Ora } from 'ora';
import chalk from 'chalk';

/**
 * Wraps ora to provide a consistent progress experience.
 */
export class ProgressReporter {
  private spinner: Ora;
  private current = 0;
  private total = 0;
  private startMs = Date.now();

  constructor() {
    this.spinner = ora({
      color: 'magenta',
      spinner: 'dots',
    });
  }

  start(url: string): void {
    this.startMs = Date.now();
    this.spinner.start(`Connecting to ${chalk.cyan(url)}...`);
  }

  crawlStarted(): void {
    this.spinner.text = 'Crawling pages...';
  }

  update(current: number, total: number, currentUrl: string): void {
    this.current = current;
    this.total = total;

    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const bar = this.renderBar(pct, 20);
    const elapsed = ((Date.now() - this.startMs) / 1000).toFixed(1);

    this.spinner.text = [
      `Crawling... ${bar} ${chalk.bold(`${pct}%`)}`,
      chalk.gray(
        `  ${current}/${total} pages  ·  ${elapsed}s  ·  ${this.truncate(currentUrl, 60)}`,
      ),
    ].join('\n  ');
  }

  succeed(message: string): void {
    this.spinner.succeed(chalk.green(message));
  }

  fail(message: string): void {
    this.spinner.fail(chalk.red(message));
  }

  stop(): void {
    this.spinner.stop();
  }

  private renderBar(pct: number, width: number): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return chalk.magenta('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  private truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return '…' + s.slice(-(max - 1));
  }
}
