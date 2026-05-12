import type { AuditReport } from '../../types/index.js';
import type { PageAudit } from '../../types/audit.types.js';
import type { Issue } from '../../types/issue.types.js';

/**
 * Generates a standalone, self-contained HTML report.
 */
export class HtmlFormatter {
  format(report: AuditReport): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit — ${this.esc(report.siteUrl)}</title>
  <style>
    :root {
      --bg: #0f1117;
      --surface: #1a1d27;
      --border: #2a2d3d;
      --text: #e2e8f0;
      --muted: #8892a4;
      --error: #f87171;
      --warning: #fbbf24;
      --pass: #34d399;
      --info: #60a5fa;
      --accent: #818cf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
    header { margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
    header h1 { font-size: 1.5rem; color: var(--accent); }
    header p { color: var(--muted); font-size: 0.875rem; margin-top: 0.25rem; }
    .score-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 2rem; margin-bottom: 2rem; display: flex; gap: 2rem; align-items: center; }
    .score-circle { width: 100px; height: 100px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
    .score-circle .score { font-size: 2rem; }
    .score-circle .grade { font-size: 1rem; opacity: 0.8; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; flex: 1; }
    .summary-item { background: var(--bg); border-radius: 8px; padding: 1rem; text-align: center; }
    .summary-item .count { font-size: 1.75rem; font-weight: 700; }
    .summary-item .label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .err { color: var(--error); } .warn { color: var(--warning); } .pass { color: var(--pass); } .info-c { color: var(--info); }
    h2 { font-size: 1.25rem; margin-bottom: 1rem; color: var(--text); }
    .issues-table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: 8px; overflow: hidden; margin-bottom: 2rem; font-size: 0.875rem; }
    .issues-table th { padding: 0.75rem 1rem; text-align: left; background: var(--bg); color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
    .issues-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    .issues-table tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 0.2em 0.6em; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .badge-error { background: rgba(248,113,113,0.15); color: var(--error); }
    .badge-warning { background: rgba(251,191,36,0.15); color: var(--warning); }
    .badge-info { background: rgba(96,165,250,0.15); color: var(--info); }
    .page-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; }
    .page-card-header { padding: 1rem; display: flex; align-items: center; gap: 1rem; cursor: pointer; }
    .page-card-header:hover { background: rgba(255,255,255,0.03); }
    .page-url { font-size: 0.875rem; color: var(--accent); flex: 1; word-break: break-all; }
    .page-score { font-size: 0.875rem; font-weight: 700; }
    .page-details { padding: 0 1rem 1rem; display: none; }
    .page-card.open .page-details { display: block; }
    .fix { margin-top: 0.25rem; font-size: 0.8rem; color: var(--muted); }
    .meta { font-size: 0.75rem; color: var(--muted); display: flex; gap: 1rem; margin-bottom: 0.75rem; }
    footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.8rem; text-align: center; }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>🔍 SEO Audit Report</h1>
    <p>${this.esc(report.siteUrl)} &nbsp;·&nbsp; ${report.totalPages} pages &nbsp;·&nbsp; ${report.auditedAt.toLocaleDateString()} &nbsp;·&nbsp; ${(report.durationMs / 1000).toFixed(1)}s</p>
  </header>

  <div class="score-card">
    <div class="score-circle" style="background: ${this.gradeColor(report.grade)}22; border: 3px solid ${this.gradeColor(report.grade)}">
      <span class="score" style="color:${this.gradeColor(report.grade)}">${report.siteScore}</span>
      <span class="grade" style="color:${this.gradeColor(report.grade)}">${report.grade}</span>
    </div>
    <div class="summary-grid">
      <div class="summary-item"><div class="count err">${report.summary.errors}</div><div class="label">Errors</div></div>
      <div class="summary-item"><div class="count warn">${report.summary.warnings}</div><div class="label">Warnings</div></div>
      <div class="summary-item"><div class="count pass">${report.summary.passes}</div><div class="label">Passed</div></div>
      <div class="summary-item"><div class="count info-c">${report.summary.info}</div><div class="label">Info</div></div>
    </div>
  </div>

  ${report.topIssues.length > 0 ? this.renderTopIssues(report.topIssues) : ''}

  <h2>Page Results</h2>
  ${report.pages.map((p) => this.renderPage(p)).join('\n')}

  <footer>Generated by <strong>seo-auditor</strong> &nbsp;·&nbsp; ${new Date().toISOString()}</footer>
</div>
<script>
  document.querySelectorAll('.page-card-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.page-card').classList.toggle('open'));
  });
</script>
</body>
</html>`;
  }

  private renderTopIssues(issues: Issue[]): string {
    const rows = issues
      .map(
        (i) => `<tr>
        <td><span class="badge badge-${i.severity}">${this.severityLabel(i.severity)}</span></td>
        <td><strong>${this.esc(i.title)}</strong><div class="fix">${this.esc(i.description.slice(0, 120))}${i.description.length > 120 ? '…' : ''}</div></td>
        <td style="font-size:0.8rem;color:var(--muted)">${this.esc(i.category)}</td>
      </tr>`,
      )
      .join('\n');

    return `<h2>Top Issues</h2>
    <table class="issues-table">
      <thead><tr><th>Severity</th><th>Issue</th><th>Category</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  private renderPage(page: PageAudit): string {
    const actionable = page.issues.filter(
      (i) => i.severity === 'error' || i.severity === 'warning',
    );
    const scoreColor = this.gradeColor(page.grade);

    const issueRows = actionable
      .map(
        (i) => `<tr>
        <td><span class="badge badge-${i.severity}">${this.severityLabel(i.severity)}</span></td>
        <td>
          <strong>${this.esc(i.title)}</strong>
          <div class="fix">${this.esc(i.description)}</div>
          ${i.fix ? `<div class="fix">💡 ${this.esc(i.fix)}</div>` : ''}
        </td>
      </tr>`,
      )
      .join('\n');

    return `<div class="page-card">
    <div class="page-card-header">
      <span class="page-url">${this.esc(page.url)}</span>
      <span class="page-score" style="color:${scoreColor}">${page.score}/100 (${page.grade})</span>
      <span style="color:var(--muted);font-size:0.8rem">${actionable.length} issues ▾</span>
    </div>
    <div class="page-details">
      <div class="meta">
        <span>Status: ${page.statusCode}</span>
        <span>Load: ${page.loadTimeMs}ms</span>
        <span>Audited: ${page.auditedAt.toLocaleTimeString()}</span>
      </div>
      ${actionable.length > 0 ? `<table class="issues-table"><thead><tr><th>Sev</th><th>Issue</th></tr></thead><tbody>${issueRows}</tbody></table>` : '<p style="color:var(--pass);font-size:0.875rem">✅ No errors or warnings found.</p>'}
    </div>
  </div>`;
  }

  private gradeColor(grade: string): string {
    const map: Record<string, string> = {
      A: '#34d399',
      B: '#60a5fa',
      C: '#fbbf24',
      D: '#fb923c',
      F: '#f87171',
    };
    return map[grade] ?? '#8892a4';
  }

  private severityLabel(s: string): string {
    const map: Record<string, string> = {
      error: '❌ Error',
      warning: '⚠️ Warn',
      info: 'ℹ️ Info',
      pass: '✅ Pass',
    };
    return map[s] ?? s;
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
