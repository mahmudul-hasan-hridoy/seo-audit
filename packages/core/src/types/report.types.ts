import type { PageAudit, Grade } from './audit.types.js';
import type { Issue } from './issue.types.js';

/**
 * The final aggregated report for an entire site audit.
 */
export interface AuditReport {
  /** Root URL that was audited. */
  siteUrl: string;

  /** Total number of pages crawled. */
  totalPages: number;

  /** Average score across all pages (0–100). */
  siteScore: number;

  /** Overall site grade. */
  grade: Grade;

  /** High-level count summary across all pages. */
  summary: {
    errors: number;
    warnings: number;
    passes: number;
    info: number;
  };

  /** Per-page audit results. */
  pages: PageAudit[];

  /** Top 10 most impactful issues across the site. */
  topIssues: Issue[];

  /** Timestamp when the audit started. */
  auditedAt: Date;

  /** Total wall-clock duration of the audit in milliseconds. */
  durationMs: number;
}
