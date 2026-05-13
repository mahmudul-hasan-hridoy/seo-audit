import { SEVERITY_PENALTIES, MAX_PENALTY, GRADE_THRESHOLDS, CATEGORY_WEIGHTS } from './weights.js';
import type { Issue, IssueSeverity, AuditReport, AnalyzerName } from '../types/index.js';
import type { PageAudit, Grade } from '../types/audit.types.js';

export interface CategoryScore {
  category: AnalyzerName;
  score: number;
  grade: Grade;
  errors: number;
  warnings: number;
  passes: number;
}

/**
 * Computes scores and grades for pages and the overall site.
 *
 * Scoring algorithm:
 * - Page score: starts at 100, subtracts weighted penalties per issue severity
 * - Site score: weighted average of page scores (heavier weight for lower-scoring pages)
 * - Category scores: computed independently per analyzer
 */
export class ScoreEngine {
  /**
   * Compute a 0–100 score for a list of issues on a single page.
   */
  computePageScore(issues: Issue[]): number {
    const totalPenalty = issues.reduce((sum, issue) => {
      return sum + (SEVERITY_PENALTIES[issue.severity] ?? 0);
    }, 0);

    return Math.max(0, 100 - Math.min(totalPenalty, MAX_PENALTY));
  }

  /**
   * Compute site-wide score as a weighted average of page scores.
   * Pages with lower scores are weighted more to surface critical issues.
   */
  computeSiteScore(pages: PageAudit[]): number {
    if (pages.length === 0) return 0;

    // Give more weight to lower-scoring pages (they represent bigger problems)
    let weightedSum = 0;
    let totalWeight = 0;

    for (const page of pages) {
      // Weight: 1.0 for score=100, up to 2.0 for score=0
      const weight = 1 + (1 - page.score / 100);
      weightedSum += page.score * weight;
      totalWeight += weight;
    }

    return Math.round(weightedSum / totalWeight);
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
   * Compute per-category score breakdown across all pages.
   * Useful for understanding which area of SEO needs the most attention.
   */
  computeCategoryScores(pages: PageAudit[]): CategoryScore[] {
    const categoryMap = new Map<AnalyzerName, Issue[]>();

    for (const page of pages) {
      for (const issue of page.issues) {
        const existing = categoryMap.get(issue.category) ?? [];
        existing.push(issue);
        categoryMap.set(issue.category, existing);
      }
    }

    const result: CategoryScore[] = [];

    for (const [category, issues] of categoryMap.entries()) {
      const score = this.computePageScore(issues);
      const errors = issues.filter((i) => i.severity === 'error').length;
      const warnings = issues.filter((i) => i.severity === 'warning').length;
      const passes = issues.filter((i) => i.severity === 'pass').length;

      result.push({
        category,
        score,
        grade: this.scoreToGrade(score),
        errors,
        warnings,
        passes,
      });
    }

    // Sort by score ascending (worst first)
    return result.sort((a, b) => a.score - b.score);
  }

  /**
   * Return the top N issues by impact (errors first, then warnings),
   * deduplicated by issue ID across all pages.
   * Each issue in the result carries a `_pageCount` property indicating
   * how many pages were affected.
   */
  topIssues(pages: PageAudit[], limit = 10): (Issue & { pageCount: number })[] {
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
        // Secondary sort: by category weight (more important categories first)
        const weightDiff =
          (CATEGORY_WEIGHTS[b.issue.category] ?? 1) - (CATEGORY_WEIGHTS[a.issue.category] ?? 1);
        if (weightDiff !== 0) return weightDiff;
        return b.count - a.count;
      })
      .slice(0, limit)
      .map(({ issue, count }) => ({ ...issue, pageCount: count }));
  }
}