import { SEVERITY_PENALTIES, MAX_PENALTY, GRADE_THRESHOLDS } from './weights.js';
import type { Issue, IssueSeverity, AuditReport } from '../types/index.js';
import type { PageAudit, Grade } from '../types/audit.types.js';

/**
 * Computes scores and grades for pages and the overall site.
 */
export class ScoreEngine {
  /**
   * Compute a 0–100 score for a list of issues on a single page.
   *
   * Algorithm:
   * - Start at 100
   * - Subtract penalty for each error/warning/info issue
   * - Cap at 0 minimum
   */
  computePageScore(issues: Issue[]): number {
    const totalPenalty = issues.reduce((sum, issue) => {
      return sum + (SEVERITY_PENALTIES[issue.severity] ?? 0);
    }, 0);

    return Math.max(0, 100 - Math.min(totalPenalty, MAX_PENALTY));
  }

  /**
   * Compute site-wide score as the average of all page scores.
   */
  computeSiteScore(pages: PageAudit[]): number {
    if (pages.length === 0) return 0;
    const total = pages.reduce((sum, page) => sum + page.score, 0);
    return Math.round(total / pages.length);
  }

  /**
   * Convert a numeric score to a letter grade.
   */
  scoreToGrade(score: number): Grade {
    for (const { min, grade } of GRADE_THRESHOLDS) {
      if (score >= min) return grade as Grade;
    }
    return 'F';
  }

  /**
   * Aggregate issue counts across all pages for the report summary.
   */
  aggregateSummary(pages: PageAudit[]): AuditReport['summary'] {
    const summary = { errors: 0, warnings: 0, passes: 0, info: 0 };

    for (const page of pages) {
      for (const issue of page.issues) {
        if (issue.severity === 'error') summary.errors++;
        else if (issue.severity === 'warning') summary.warnings++;
        else if (issue.severity === 'pass') summary.passes++;
        else if (issue.severity === 'info') summary.info++;
      }
    }

    return summary;
  }

  /**
   * Return the top N issues by impact (errors first, then warnings),
   * deduplicated by issue ID across all pages.
   */
  topIssues(pages: PageAudit[], limit = 10): Issue[] {
    // Count occurrences of each issue ID
    const issueMap = new Map<string, { issue: Issue; count: number }>();

    for (const page of pages) {
      for (const issue of page.issues) {
        if (issue.severity === 'pass' || issue.severity === 'info') continue;

        const existing = issueMap.get(issue.id);
        if (existing) {
          existing.count++;
        } else {
          issueMap.set(issue.id, { issue, count: 1 });
        }
      }
    }

    // Sort by severity weight then count
    const severityOrder: Record<IssueSeverity, number> = {
      error: 3,
      warning: 2,
      info: 1,
      pass: 0,
    };

    return Array.from(issueMap.values())
      .sort((a, b) => {
        const sevDiff =
          (severityOrder[b.issue.severity] ?? 0) - (severityOrder[a.issue.severity] ?? 0);
        if (sevDiff !== 0) return sevDiff;
        return b.count - a.count;
      })
      .slice(0, limit)
      .map(({ issue }) => issue);
  }
}
