import Table from 'cli-table3';
import chalk from 'chalk';
import { theme } from './colors.js';
import type { AuditReport } from 'seo-auditor';

/**
 * Renders the final audit report as formatted terminal output.
 */
export function renderDashboard(report: AuditReport): void {
  const hr = chalk.gray('─'.repeat(55));

  console.log();
  console.log(chalk.bold('  SEO AUDITOR  ') + theme.url(report.siteUrl));
  console.log('  ' + hr);
  console.log();

  // Score line
  const scoreStr = theme.score(report.siteScore);
  const gradeStr = theme.grade(report.grade);
  console.log(`  ${chalk.bold('SITE SCORE')}   ${scoreStr} / 100    Grade: ${gradeStr}`);
  console.log('  ' + hr);
  console.log();

  // Summary counts
  console.log(
    `  ${theme.severityIcon('error')}  ${chalk.bold('Errors')}     ${chalk.red.bold(report.summary.errors.toString())}`,
  );
  console.log(
    `  ${theme.severityIcon('warning')}  ${chalk.bold('Warnings')}   ${chalk.yellow.bold(report.summary.warnings.toString())}`,
  );
  console.log(
    `  ${theme.severityIcon('pass')}  ${chalk.bold('Passed')}    ${chalk.green.bold(report.summary.passes.toString())}`,
  );
  console.log(
    `  ${theme.severityIcon('info')}  ${chalk.bold('Info')}       ${chalk.blue.bold(report.summary.info.toString())}`,
  );
  console.log();

  // Top issues table
  if (report.topIssues.length > 0) {
    console.log(`  ${chalk.bold('TOP ISSUES')}`);
    console.log();

    const table = new Table({
      head: [chalk.gray('Sev'), chalk.gray('Issue'), chalk.gray('Category'), chalk.gray('Impact')],
      colWidths: [6, 45, 12, 8],
      style: { border: ['gray'], head: [] },
      chars: {
        top: '─',
        'top-mid': '┬',
        'top-left': '┌',
        'top-right': '┐',
        bottom: '─',
        'bottom-mid': '┴',
        'bottom-left': '└',
        'bottom-right': '┘',
        left: '│',
        'left-mid': '├',
        mid: '─',
        'mid-mid': '┼',
        right: '│',
        'right-mid': '┤',
        middle: '│',
      },
    });

    const severityPenalty: Record<string, number> = {
      error: 15,
      warning: 5,
      info: 1,
    };

    for (const issue of report.topIssues) {
      const icon = theme.severityIcon(issue.severity);
      const penalty = severityPenalty[issue.severity] ?? 0;
      const impactStr = penalty > 0 ? chalk.red(`-${penalty}`) : chalk.gray('0');

      table.push([icon, truncate(issue.title, 43), chalk.gray(issue.category), impactStr]);
    }

    // Prefix each line with 2 spaces for alignment
    const tableStr = table
      .toString()
      .split('\n')
      .map((l) => '  ' + l)
      .join('\n');
    console.log(tableStr);
    console.log();
  }

  // Stats footer
  const duration = (report.durationMs / 1000).toFixed(1);
  console.log('  ' + chalk.gray(`${report.totalPages} pages audited in ${duration}s`));
  console.log();
}

/**
 * Print a path line showing where the report was saved.
 */
export function renderSavedPath(filePath: string, format: string): void {
  console.log('  ' + chalk.bold('Report saved') + ' → ' + chalk.cyan(filePath));
  if (format === 'json') {
    console.log(
      '  ' +
        chalk.gray(`Run \`seo-audit report ${filePath} --format html --open\` to view in browser.`),
    );
  }
  console.log();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
