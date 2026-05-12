import { describe, it, expect, vi } from 'vitest';
import { Reporter } from 'seo-auditor';
import type { AuditReport } from 'seo-auditor';

function makeMockReport(): AuditReport {
  return {
    siteUrl: 'https://example.com',
    totalPages: 1,
    siteScore: 80,
    grade: 'B',
    summary: { errors: 1, warnings: 2, passes: 10, info: 3 },
    pages: [
      {
        url: 'https://example.com/',
        statusCode: 200,
        loadTimeMs: 150,
        issues: [],
        score: 80,
        grade: 'B',
        auditedAt: new Date(),
      },
    ],
    topIssues: [],
    auditedAt: new Date(),
    durationMs: 1200,
  };
}

describe('Reporter', () => {
  it('serializes a report to JSON', () => {
    const reporter = new Reporter();
    const report = makeMockReport();
    const json = reporter.serialize(report, 'json');
    const parsed = JSON.parse(json) as { siteUrl: string; siteScore: number };
    expect(parsed.siteUrl).toBe('https://example.com');
    expect(parsed.siteScore).toBe(80);
  });

  it('serializes a report to Markdown', () => {
    const reporter = new Reporter();
    const report = makeMockReport();
    const md = reporter.serialize(report, 'markdown');
    expect(md).toContain('# SEO Audit Report');
    expect(md).toContain('https://example.com');
    expect(md).toContain('80 / 100');
  });

  it('serializes a report to HTML', () => {
    const reporter = new Reporter();
    const report = makeMockReport();
    const html = reporter.serialize(report, 'html');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('SEO Audit Report');
    expect(html).toContain('https://example.com');
  });

  it('infers json format from .json extension', () => {
    expect(Reporter.inferFormat('report.json')).toBe('json');
  });

  it('infers html format from .html extension', () => {
    expect(Reporter.inferFormat('report.html')).toBe('html');
  });

  it('infers markdown format from .md extension', () => {
    expect(Reporter.inferFormat('report.md')).toBe('markdown');
  });

  it('defaults to json for unknown extensions', () => {
    expect(Reporter.inferFormat('report.xyz')).toBe('json');
  });
});
