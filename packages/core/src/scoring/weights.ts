import type { IssueSeverity } from '../types/index.js';

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

export const CATEGORY_WEIGHTS: Record<string, number> = {
  technical: 1.2,
  content: 1.0,
  performance: 0.9,
  accessibility: 0.8,
  seo: 1.1,
};
