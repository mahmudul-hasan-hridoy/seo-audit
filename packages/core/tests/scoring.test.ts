import { describe, it, expect, beforeEach } from 'vitest';
import { ScoreEngine } from '../src/scoring/ScoreEngine.js';
import type { Issue } from '../src/types/index.js';
import type { PageAudit } from '../src/types/audit.types.js';

function makeIssue(severity: Issue['severity'], id = 'test-issue'): Issue {
  return {
    id,
    title: 'Test Issue',
    description: 'A test issue',
    severity,
    category: 'onpage',
    affectedUrl: 'https://example.com/',
  };
}

function makePage(score: number, issues: Issue[] = []): PageAudit {
  return {
    url: 'https://example.com/',
    statusCode: 200,
    loadTimeMs: 100,
    issues,
    score,
    grade: 'A',
    auditedAt: new Date(),
  };
}

describe('ScoreEngine', () => {
  let engine: ScoreEngine;

  beforeEach(() => {
    engine = new ScoreEngine();
  });

  describe('computePageScore', () => {
    it('returns 100 when there are no issues', () => {
      expect(engine.computePageScore([])).toBe(100);
    });

    it('returns 100 when issues are only passes', () => {
      const issues = [makeIssue('pass'), makeIssue('pass')];
      expect(engine.computePageScore(issues)).toBe(100);
    });

    it('subtracts 15 per error', () => {
      const issues = [makeIssue('error')];
      expect(engine.computePageScore(issues)).toBe(85);
    });

    it('subtracts 5 per warning', () => {
      const issues = [makeIssue('warning')];
      expect(engine.computePageScore(issues)).toBe(95);
    });

    it('subtracts 1 per info issue', () => {
      const issues = [makeIssue('info')];
      expect(engine.computePageScore(issues)).toBe(99);
    });

    it('never goes below 0', () => {
      const issues = Array.from({ length: 10 }, (_, i) => makeIssue('error', `error-${i}`));
      expect(engine.computePageScore(issues)).toBe(0);
    });

    it('handles mixed severities correctly', () => {
      const issues = [makeIssue('error'), makeIssue('warning'), makeIssue('info')];
      // 100 - 15 - 5 - 1 = 79
      expect(engine.computePageScore(issues)).toBe(79);
    });
  });

  describe('computeSiteScore', () => {
    it('returns 0 for empty pages', () => {
      expect(engine.computeSiteScore([])).toBe(0);
    });

    it('returns a weighted average of page scores (lower scores get more weight)', () => {
      const pages = [makePage(80), makePage(60), makePage(100)];
      // weight(80)=1.2, weight(60)=1.4, weight(100)=1.0
      // (80*1.2 + 60*1.4 + 100*1.0) / (1.2+1.4+1.0) = 280/3.6 = 77.78 → 78
      expect(engine.computeSiteScore(pages)).toBe(78);
    });

    it('rounds the weighted result', () => {
      const pages = [makePage(80), makePage(81)];
      // weight(80)=1.2, weight(81)=1.19
      // (80*1.2 + 81*1.19) / (1.2+1.19) = 192.39/2.39 = 80.498 → 80
      expect(engine.computeSiteScore(pages)).toBe(80);
    });
  });

  describe('scoreToGrade', () => {
    it('returns A for 90+', () => expect(engine.scoreToGrade(90)).toBe('A'));
    it('returns A for 100', () => expect(engine.scoreToGrade(100)).toBe('A'));
    it('returns B for 75-89', () => expect(engine.scoreToGrade(75)).toBe('B'));
    it('returns C for 60-74', () => expect(engine.scoreToGrade(60)).toBe('C'));
    it('returns D for 40-59', () => expect(engine.scoreToGrade(40)).toBe('D'));
    it('returns F for below 40', () => expect(engine.scoreToGrade(39)).toBe('F'));
    it('returns F for 0', () => expect(engine.scoreToGrade(0)).toBe('F'));
  });

  describe('aggregateSummary', () => {
    it('counts issue severities across all pages', () => {
      const pages = [
        makePage(80, [makeIssue('error', 'e1'), makeIssue('warning', 'w1'), makeIssue('pass', 'p1')]),
        makePage(90, [makeIssue('error', 'e2'), makeIssue('info', 'i1')]),
      ];
      const summary = engine.aggregateSummary(pages);
      expect(summary.errors).toBe(2);
      expect(summary.warnings).toBe(1);
      expect(summary.passes).toBe(1);
      expect(summary.info).toBe(1);
    });
  });

  describe('topIssues', () => {
    it('returns top issues by severity', () => {
      const pages = [
        makePage(50, [
          makeIssue('warning', 'warn-1'),
          makeIssue('error', 'error-1'),
          makeIssue('info', 'info-1'),
        ]),
      ];
      const top = engine.topIssues(pages, 2);
      expect(top.length).toBe(2);
      expect(top[0]?.severity).toBe('error');
      expect(top[1]?.severity).toBe('warning');
    });

    it('excludes pass issues', () => {
      const pages = [makePage(100, [makeIssue('pass', 'pass-1')])];
      const top = engine.topIssues(pages);
      expect(top.length).toBe(0);
    });

    it('deduplicates issues across pages', () => {
      const pages = [
        makePage(80, [makeIssue('error', 'same-id')]),
        makePage(80, [makeIssue('error', 'same-id')]),
      ];
      const top = engine.topIssues(pages);
      expect(top.length).toBe(1);
    });
  });
});
