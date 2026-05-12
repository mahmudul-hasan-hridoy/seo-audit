/**
 * seo-auditor — Public API
 *
 * @example
 * ```ts
 * import { Auditor, defineConfig } from 'seo-auditor';
 *
 * const auditor = new Auditor({
 *   url: 'https://mysite.com',
 *   maxPages: 200,
 *   renderJs: false,
 * });
 *
 * auditor.on('page:audited', (page) => {
 *   console.log(`${page.url} — ${page.score}/100`);
 * });
 *
 * const report = await auditor.run();
 * console.log(`Site score: ${report.siteScore} (${report.grade})`);
 * ```
 */

// Main entry point
export { Auditor } from './Auditor.js';
export type { AuditorEvents } from './Auditor.js';

// Types
export type {
  AuditConfig,
  ResolvedAuditConfig,
  AnalyzerName,
  AuditReport,
  PageAudit,
  Grade,
  Issue,
  IssueSeverity,
} from './types/index.js';

// Config helper
export { defineConfig } from './types/index.js';

// Errors
export { AuditorError } from './errors.js';
export type { AuditorErrorCode } from './errors.js';

// Reporter (for custom integrations)
export { Reporter } from './reporter/Reporter.js';
export type { ReportFormat, ReporterOptions } from './reporter/Reporter.js';

// Analyzers (for custom analyzer implementations)
export { BaseAnalyzer } from './analyzers/BaseAnalyzer.js';
export type { AnalyzerContext } from './analyzers/BaseAnalyzer.js';

// Score engine (for custom scoring)
export { ScoreEngine } from './scoring/ScoreEngine.js';