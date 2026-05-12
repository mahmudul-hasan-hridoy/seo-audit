import type { AnalyzerName } from './config.types.js';

/**
 * Severity level of an audit finding.
 * - error: Actively hurts SEO ranking now
 * - warning: Could hurt ranking if unaddressed
 * - pass: Check passed successfully
 * - info: Advisory / best practice note
 */
export type IssueSeverity = 'error' | 'warning' | 'pass' | 'info';

/**
 * A single finding from an analyzer check.
 */
export interface Issue {
  /** Unique identifier for this issue type. e.g. "missing-title-tag" */
  id: string;

  /** Short human-readable title. */
  title: string;

  /** Detailed description of the issue. */
  description: string;

  /** Severity classification. */
  severity: IssueSeverity;

  /** Which analyzer category produced this issue. */
  category: AnalyzerName;

  /** The URL where this issue was found. */
  affectedUrl: string;

  /** Actionable fix description. */
  fix?: string;

  /** Link to documentation or reference. */
  docs?: string;

  /** The actual value found during the check. */
  value?: string | number;

  /** The expected value for a passing check. */
  expected?: string | number;
}
