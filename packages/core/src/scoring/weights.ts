import type { IssueSeverity, AnalyzerName } from '../types/index.js';

/**
 * Score penalty per issue severity.
 * These are subtracted from a 100-point base per page.
 */
export const SEVERITY_PENALTIES: Record<IssueSeverity, number> = {
  error: 15,
  warning: 5,
  info: 1,
  pass: 0,
};

/**
 * Maximum total penalty cap per page.
 * Prevents a single very broken page from going below 0.
 */
export const MAX_PENALTY = 100;

/**
 * Grade thresholds.
 */
export const GRADE_THRESHOLDS = [
  { min: 90, grade: 'A' },
  { min: 75, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0, grade: 'F' },
] as const;

/**
 * Relative importance weights per analyzer category.
 * Used to secondary-sort top issues (higher weight = shown first).
 *
 * Keys MUST match the AnalyzerName union exactly.
 */
export const CATEGORY_WEIGHTS: Record<AnalyzerName, number> = {
  onpage: 1.3,      // Title, meta, headings — most direct ranking signal
  technical: 1.2,   // HTTPS, canonical, robots directives
  content: 1.0,     // Thin content, readability
  performance: 1.0, // Load time, compression, CWV signals
  images: 0.8,      // Alt text, lazy-load, CLS prevention
  links: 0.8,       // Internal linking, anchor text
  mobile: 0.7,      // Viewport, tap targets
  schema: 0.6,      // Structured data (rich results)
};
