import type { AuditReport } from '../../types/index.js';
import type { TopIssue } from '../../types/report.types.js';
import type { Issue } from '../../types/issue.types.js';

const SEVERITY_EMOJI: Record<string, string> = {
  error: '❌',
  warning: '⚠️',
  pass: '✅',
  info: 'ℹ️',
};

/**
 * Formats an AuditReport as Markdown.
 */
export class MarkdownFormatter {
  format(report: AuditReport): string {
    const lines: string[] = [];

    lines.push(`# SEO Audit Report`);
    lines.push(``);
    lines.push(`**Site:** ${report.siteUrl}`);
    lines.push(`**Audited:** ${report.auditedAt.toISOString()}`);
    lines.push(`**Duration:** ${(report.durationMs / 1000).toFixed(1)}s`);
    lines.push(`**Pages crawled:** ${report.totalPages}`);
    lines.push(``);

    // Score
    lines.push(`## Site Health Score`);
    lines.push(``);
    lines.push(`> **${report.siteScore} / 100** — Grade: **${report.grade}**`);
    lines.push(``);
    lines.push(`| Severity | Count |`);
    lines.push(`|----------|-------|`);
    lines.push(`| ❌ Errors | ${report.summary.errors} |`);
    lines.push(`| ⚠️ Warnings | ${report.summary.warnings} |`);
    lines.push(`| ✅ Passed | ${report.summary.passes} |`);
    lines.push(`| ℹ️ Info | ${report.summary.info} |`);
    lines.push(``);

    // Top Issues
    if (report.topIssues.length > 0) {
      lines.push(`## Top Issues`);
      lines.push(``);
      lines.push(`| Severity | Issue | Category | Pages Affected |`);
      lines.push(`|----------|-------|----------|----------------|`);

      report.topIssues.forEach((issue: TopIssue) => {
        const emoji = SEVERITY_EMOJI[issue.severity] ?? '';
        lines.push(
          `| ${emoji} | **${issue.title}** | ${issue.category} | ${issue.pageCount} page${issue.pageCount !== 1 ? 's' : ''} |`,
        );
      });
      lines.push(``);
    }

    // Per-page details
    lines.push(`## Page Results`);
    lines.push(``);

    for (const page of report.pages) {
      lines.push(`### ${page.url}`);
      lines.push(``);
      lines.push(`- **Score:** ${page.score}/100 (${page.grade})`);
      lines.push(`- **Status:** ${page.statusCode}`);
      lines.push(`- **Load time:** ${page.loadTimeMs}ms`);
      lines.push(``);

      const actionable = page.issues.filter(
        (i) => i.severity === 'error' || i.severity === 'warning',
      );

      if (actionable.length > 0) {
        lines.push(`#### Issues`);
        lines.push(``);

        for (const issue of actionable) {
          lines.push(this.formatIssue(issue));
        }
      }

      lines.push(``);
    }

    return lines.join('\n');
  }

  private formatIssue(issue: Issue): string {
    const emoji = SEVERITY_EMOJI[issue.severity] ?? '';
    const lines = [`**${emoji} ${issue.title}**`];
    lines.push(``);
    lines.push(issue.description);

    if (issue.fix) {
      lines.push(``);
      lines.push(`**Fix:** ${issue.fix}`);
    }

    if (issue.docs) {
      lines.push(``);
      lines.push(`**Docs:** ${issue.docs}`);
    }

    lines.push(``);
    return lines.join('\n');
  }
}
