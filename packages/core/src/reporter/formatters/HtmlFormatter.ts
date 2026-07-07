import type { AuditReport } from '../../types/index.js';
import type { TopIssue } from '../../types/report.types.js';
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:        #f7f7f5;
      --surface:   #ffffff;
      --surface-2: #f0f0ec;
      --border:    #e5e5e0;
      --text:      #1a1a18;
      --muted:     #8a8a82;
      --subtle:    #c4c4bc;

      --error:     #c0392b;
      --error-bg:  #fdf2f1;
      --warning:   #b45309;
      --warning-bg:#fefbf0;
      --pass:      #1a7a4a;
      --pass-bg:   #f0faf5;
      --info:      #2563eb;
      --info-bg:   #f0f5ff;

      --grade-a:   #1a7a4a;
      --grade-b:   #2563eb;
      --grade-c:   #b45309;
      --grade-d:   #c2410c;
      --grade-f:   #c0392b;

      --radius-sm: 4px;
      --radius:    8px;
      --radius-lg: 12px;

      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
      --shadow:    0 2px 8px rgba(0,0,0,0.08);
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      font-size: 15px;
      -webkit-font-smoothing: antialiased;
    }

    /* ─── Layout ─────────────────────────────────────────────── */
    .wrap { max-width: 960px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }

    /* ─── Header ─────────────────────────────────────────────── */
    .site-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .site-header__eyebrow {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.35rem;
    }
    .site-header__url {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text);
      word-break: break-all;
    }
    .site-header__meta {
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 0.35rem;
      display: flex;
      gap: 1.25rem;
      flex-wrap: wrap;
    }
    .site-header__meta span { display: flex; align-items: center; gap: 0.3rem; }

    /* ─── Score Card ─────────────────────────────────────────── */
    .score-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 1.75rem;
      margin-bottom: 1.5rem;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2rem;
      align-items: center;
      box-shadow: var(--shadow-sm);
    }
    .score-ring {
      position: relative;
      width: 88px;
      height: 88px;
      flex-shrink: 0;
    }
    .score-ring svg {
      transform: rotate(-90deg);
      width: 88px;
      height: 88px;
    }
    .score-ring__track { fill: none; stroke: var(--border); stroke-width: 5; }
    .score-ring__fill  { fill: none; stroke-width: 5; stroke-linecap: round; transition: stroke-dashoffset 0.8s ease; }
    .score-ring__label {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .score-ring__num   { font-size: 1.5rem; font-weight: 700; line-height: 1; }
    .score-ring__grade { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-top: 1px; }

    .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
    .stat {
      background: var(--surface-2);
      border-radius: var(--radius);
      padding: 1rem;
      text-align: center;
    }
    .stat__num   { font-size: 1.5rem; font-weight: 700; line-height: 1; }
    .stat__label { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-top: 0.35rem; }
    .stat--error   .stat__num { color: var(--error); }
    .stat--warning .stat__num { color: var(--warning); }
    .stat--pass    .stat__num { color: var(--pass); }
    .stat--info    .stat__num { color: var(--info); }

    /* ─── Section Heading ────────────────────────────────────── */
    .section-heading {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin: 2rem 0 0.75rem;
    }

    /* ─── Issues Table ───────────────────────────────────────── */
    .table-wrap {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: 1.5rem;
      box-shadow: var(--shadow-sm);
    }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    thead th {
      padding: 0.65rem 1rem;
      text-align: left;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      background: var(--surface-2);
      border-bottom: 1px solid var(--border);
    }
    tbody td { padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--surface-2); }

    .issue-title  { font-weight: 500; color: var(--text); }
    .issue-desc   { font-size: 0.8rem; color: var(--muted); margin-top: 0.2rem; line-height: 1.5; }
    .issue-fix    { font-size: 0.78rem; color: var(--info); margin-top: 0.3rem; }
    .issue-cat    { font-family: 'DM Mono', monospace; font-size: 0.75rem; color: var(--muted); white-space: nowrap; }
    .page-count   { font-size: 0.75rem; color: var(--muted); white-space: nowrap; }

    /* ─── Badge ──────────────────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2em 0.55em;
      border-radius: var(--radius-sm);
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
    .badge-error   { background: var(--error-bg);   color: var(--error);   }
    .badge-warning { background: var(--warning-bg); color: var(--warning); }
    .badge-pass    { background: var(--pass-bg);    color: var(--pass);    }
    .badge-info    { background: var(--info-bg);    color: var(--info);    }

    /* ─── Severity Icons ─────────────────────────────────────── */
    .sev-icons {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      flex-shrink: 0;
    }
    .sev-icon {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15em 0.4em;
      border-radius: var(--radius-sm);
      white-space: nowrap;
    }
    .sev-icon--error   { background: var(--error-bg);   color: var(--error);   }
    .sev-icon--warning { background: var(--warning-bg); color: var(--warning); }
    .sev-icon--info    { background: var(--info-bg);    color: var(--info);    }

    /* ─── Page Cards ─────────────────────────────────────────── */
    .page-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .page-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.15s ease;
    }
    .page-card:hover { box-shadow: var(--shadow); }
    .page-card__header {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.25rem;
      cursor: pointer;
      user-select: none;
    }
    .page-card__url {
      font-family: 'DM Mono', monospace;
      font-size: 0.8rem;
      color: var(--text);
      word-break: break-all;
    }
    .page-card__score {
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
    }
    .page-card__toggle {
      color: var(--subtle);
      font-size: 0.75rem;
      white-space: nowrap;
      transition: color 0.15s;
    }
    .page-card__header:hover .page-card__toggle { color: var(--muted); }

    .page-card__chevron {
      display: inline-block;
      transition: transform 0.2s ease;
      margin-left: 0.25rem;
    }
    .page-card.open .page-card__chevron { transform: rotate(180deg); }

    .page-card__body {
      display: none;
      padding: 0 1.25rem 1.25rem;
      border-top: 1px solid var(--border);
    }
    .page-card.open .page-card__body { display: block; }

    .page-meta {
      display: flex;
      gap: 1.25rem;
      flex-wrap: wrap;
      padding: 0.75rem 0;
      font-size: 0.78rem;
      color: var(--muted);
      margin-bottom: 0.75rem;
    }
    .page-meta span { display: flex; align-items: center; gap: 0.3rem; }

    .no-issues {
      font-size: 0.85rem;
      color: var(--pass);
      padding: 0.5rem 0;
    }

    /* ─── Footer ─────────────────────────────────────────────── */
    .site-footer {
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.78rem;
      color: var(--subtle);
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    /* ─── Responsive ─────────────────────────────────────────── */
    @media (max-width: 640px) {
      .wrap { padding: 1.5rem 1rem 3rem; }
      .score-card { grid-template-columns: 1fr; gap: 1.25rem; }
      .stat-row { grid-template-columns: repeat(2, 1fr); }
      .site-header { flex-direction: column; }
      .page-card__header { grid-template-columns: 1fr auto auto; }
      .page-card__score { display: none; }
      thead th:nth-child(3),
      thead th:nth-child(4) { display: none; }
      tbody td:nth-child(3),
      tbody td:nth-child(4) { display: none; }
    }
  </style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <header class="site-header">
    <div>
      <div class="site-header__eyebrow">SEO Audit Report</div>
      <div class="site-header__url">${this.esc(report.siteUrl)}</div>
      <div class="site-header__meta">
        <span>${report.totalPages} pages crawled</span>
        <span>${report.auditedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <span>${(report.durationMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  </header>

  <!-- Score Card -->
  <div class="score-card">
    ${this.renderScoreRing(report.siteScore, report.grade)}
    <div class="stat-row">
      <div class="stat stat--error">
        <div class="stat__num">${report.summary.errors}</div>
        <div class="stat__label">Errors</div>
      </div>
      <div class="stat stat--warning">
        <div class="stat__num">${report.summary.warnings}</div>
        <div class="stat__label">Warnings</div>
      </div>
      <div class="stat stat--pass">
        <div class="stat__num">${report.summary.passes}</div>
        <div class="stat__label">Passed</div>
      </div>
      <div class="stat stat--info">
        <div class="stat__num">${report.summary.info}</div>
        <div class="stat__label">Info</div>
      </div>
    </div>
  </div>

  <!-- Top Issues -->
  ${report.topIssues.length > 0 ? this.renderTopIssues(report.topIssues) : ''}

  <!-- Per-page Results -->
  <div class="section-heading">Page Results</div>
  <div class="page-list">
    ${report.pages.map((p) => this.renderPage(p)).join('\n')}
  </div>

  <footer class="site-footer">
    <span>Generated by <strong>seo-auditor</strong></span>
    <span>${new Date().toISOString()}</span>
  </footer>
</div>

<script>
  document.querySelectorAll('.page-card__header').forEach(function(header) {
    header.addEventListener('click', function() {
      header.closest('.page-card').classList.toggle('open');
    });
  });
</script>
</body>
</html>`;
  }

  // ─── Top Issues table ─────────────────────────────────────────────────────

  private renderTopIssues(issues: TopIssue[]): string {
    const rows = issues
      .map(
        (i) => `
      <tr>
        <td style="width:90px"><span class="badge badge-${i.severity}">${this.severityDot(i.severity)} ${this.severityLabel(i.severity)}</span></td>
        <td>
          <div class="issue-title">${this.esc(i.title)}</div>
          <div class="issue-desc">${this.esc(i.description)}</div>
          ${i.fix ? `<div class="issue-fix">→ ${this.esc(i.fix)}</div>` : ''}
        </td>
        <td class="issue-cat">${this.esc(i.category)}</td>
        <td class="page-count">${i.pageCount} page${i.pageCount !== 1 ? 's' : ''}</td>
      </tr>`,
      )
      .join('');

    return `
  <div class="section-heading">Top Issues</div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Severity</th>
          <th>Issue</th>
          <th>Category</th>
          <th>Pages</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
  }

  // ─── SVG ring score indicator ─────────────────────────────────────────────

  private renderScoreRing(score: number, grade: string): string {
    const r = 37;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - score / 100);
    const color = this.gradeColor(grade);
    return `<div class="score-ring">
      <svg viewBox="0 0 88 88">
        <circle class="score-ring__track" cx="44" cy="44" r="${r}"/>
        <circle class="score-ring__fill"
          cx="44" cy="44" r="${r}"
          stroke="${color}"
          stroke-dasharray="${circ.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"/>
      </svg>
      <div class="score-ring__label">
        <span class="score-ring__num" style="color:${color}">${score}</span>
        <span class="score-ring__grade">${grade}</span>
      </div>
    </div>`;
  }

  // ─── Severity icons for page card header ─────────────────────────────────

  private renderSeverityIcons(issues: Issue[]): string {
    const counts: { error: number; warning: number; info: number } = {
      error: 0,
      warning: 0,
      info: 0,
    };
    for (const i of issues) {
      if (i.severity === 'error') counts.error++;
      else if (i.severity === 'warning') counts.warning++;
      else if (i.severity === 'info') counts.info++;
    }

    const parts: string[] = [];
    if (counts.error > 0) {
      parts.push(
        `<span class="sev-icon sev-icon--error" title="${counts.error} error${counts.error !== 1 ? 's' : ''}">` +
          `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
          `<circle cx="5" cy="5" r="4.5" stroke="currentColor"/><path d="M5 3v2.5" stroke="currentColor" stroke-linecap="round"/><circle cx="5" cy="7" r=".5" fill="currentColor"/>` +
          `</svg>${counts.error}</span>`,
      );
    }
    if (counts.warning > 0) {
      parts.push(
        `<span class="sev-icon sev-icon--warning" title="${counts.warning} warning${counts.warning !== 1 ? 's' : ''}">` +
          `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
          `<path d="M5 1.5L9 8.5H1L5 1.5Z" stroke="currentColor" stroke-linejoin="round"/><path d="M5 4.5v2" stroke="currentColor" stroke-linecap="round"/><circle cx="5" cy="7.5" r=".4" fill="currentColor"/>` +
          `</svg>${counts.warning}</span>`,
      );
    }
    if (counts.info > 0) {
      parts.push(
        `<span class="sev-icon sev-icon--info" title="${counts.info} info">` +
          `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
          `<circle cx="5" cy="5" r="4.5" stroke="currentColor"/><path d="M5 4.5v3" stroke="currentColor" stroke-linecap="round"/><circle cx="5" cy="3" r=".5" fill="currentColor"/>` +
          `</svg>${counts.info}</span>`,
      );
    }

    if (parts.length === 0) {
      parts.push(
        `<span class="sev-icon" style="background:var(--pass-bg);color:var(--pass)" title="No issues">` +
          `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
          `<circle cx="5" cy="5" r="4.5" stroke="currentColor"/><path d="M3 5l1.5 1.5L7 3.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>` +
          `</svg></span>`,
      );
    }

    return `<div class="sev-icons">${parts.join('')}</div>`;
  }

  // ─── Per-page card ────────────────────────────────────────────────────────

  private renderPage(page: PageAudit): string {
    const actionable = page.issues.filter(
      (i) => i.severity === 'error' || i.severity === 'warning',
    );
    const color = this.gradeColor(page.grade);

    const issueRows = actionable
      .map(
        (i) => `
      <tr>
        <td style="width:90px"><span class="badge badge-${i.severity}">${this.severityDot(i.severity)} ${this.severityLabel(i.severity)}</span></td>
        <td>
          <div class="issue-title">${this.esc(i.title)}</div>
          <div class="issue-desc">${this.esc(i.description)}</div>
          ${i.fix ? `<div class="issue-fix">→ ${this.esc(i.fix)}</div>` : ''}
        </td>
      </tr>`,
      )
      .join('');

    return `<div class="page-card">
    <div class="page-card__header">
      <span class="page-url page-card__url">${this.esc(page.url)}</span>
      ${this.renderSeverityIcons(page.issues)}
      <span class="page-card__score" style="color:${color}">${page.score}/100 &nbsp;<span style="color:var(--subtle);font-weight:400">${page.grade}</span></span>
      <span class="page-card__toggle"><span class="page-card__chevron">▾</span></span>
    </div>
    <div class="page-card__body">
      <div class="page-meta">
        <span>Status ${page.statusCode}</span>
        <span>${page.loadTimeMs} ms</span>
        <span>${page.auditedAt.toLocaleTimeString()}</span>
      </div>
      ${
        actionable.length > 0
          ? `<div class="table-wrap"><table><thead><tr><th>Severity</th><th>Issue</th></tr></thead><tbody>${issueRows}</tbody></table></div>`
          : '<div class="no-issues">✓ No errors or warnings found.</div>'
      }
    </div>
  </div>`;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private gradeColor(grade: string): string {
    const map: Record<string, string> = {
      A: '#1a7a4a',
      B: '#2563eb',
      C: '#b45309',
      D: '#c2410c',
      F: '#c0392b',
    };
    return map[grade] ?? '#8a8a82';
  }

  private severityLabel(s: string): string {
    const map: Record<string, string> = {
      error: 'Error',
      warning: 'Warning',
      info: 'Info',
      pass: 'Pass',
    };
    return map[s] ?? s;
  }

  private severityDot(_s: string): string {
    return '●';
  }

  private esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
