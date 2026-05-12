import type { Issue } from './issue.types.js';

/** Letter grade for a score. */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * The result of auditing a single page.
 */
export interface PageAudit {
  /** The canonical URL of the page. */
  url: string;

  /** HTTP status code returned. */
  statusCode: number;

  /** Total load time in milliseconds. */
  loadTimeMs: number;

  /** All issues found on this page. */
  issues: Issue[];

  /** Computed health score from 0–100. */
  score: number;

  /** Letter grade computed from score. */
  grade: Grade;

  /** Timestamp when this page was audited. */
  auditedAt: Date;
}
