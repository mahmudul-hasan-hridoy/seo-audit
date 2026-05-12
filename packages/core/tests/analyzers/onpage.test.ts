import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { OnPageAnalyzer } from '../../src/analyzers/OnPageAnalyzer.js';
import type { AnalyzerContext } from '../../src/analyzers/BaseAnalyzer.js';

function makeCtx(html: string, url = 'https://example.com/'): AnalyzerContext {
  const { document: dom } = parseHTML(html);
  return {
    url,
    html,
    dom,
    headers: {},
    statusCode: 200,
    loadTimeMs: 100,
    redirectChain: [],
    internalLinks: [],
  };
}

describe('OnPageAnalyzer', () => {
  let analyzer: OnPageAnalyzer;

  beforeEach(() => {
    analyzer = new OnPageAnalyzer();
  });

  describe('title tag', () => {
    it('reports error when title tag is missing', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('missing-title-tag');
    });

    it('reports error when title tag is empty', async () => {
      const ctx = makeCtx('<html><head><title></title></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('empty-title-tag');
    });

    it('reports warning when title is too short', async () => {
      const ctx = makeCtx('<html><head><title>Hi</title></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('title-too-short');
    });

    it('reports warning when title is too long', async () => {
      const longTitle = 'A'.repeat(70);
      const ctx = makeCtx(`<html><head><title>${longTitle}</title></head><body></body></html>`);
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('title-too-long');
    });

    it('passes when title length is optimal', async () => {
      const ctx = makeCtx(
        '<html><head><title>Best SEO Practices for 2024 — My Site</title></head><body></body></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const passIssues = issues.filter((i) => i.id === 'title-length-ok');
      expect(passIssues.length).toBe(1);
      expect(passIssues[0]?.severity).toBe('pass');
    });
  });

  describe('meta description', () => {
    it('reports warning when meta description is missing', async () => {
      const ctx = makeCtx('<html><head><title>Good Title Here For SEO</title></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('missing-meta-description');
    });

    it('reports warning when meta description is too short', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="description" content="Too short"></head><body></body></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('meta-description-too-short');
    });

    it('reports warning when meta description is too long', async () => {
      const longDesc = 'A'.repeat(200);
      const ctx = makeCtx(
        `<html><head><meta name="description" content="${longDesc}"></head><body></body></html>`,
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('meta-description-too-long');
    });

    it('passes when meta description length is optimal', async () => {
      const goodDesc = 'A'.repeat(140);
      const ctx = makeCtx(
        `<html><head><meta name="description" content="${goodDesc}"></head><body></body></html>`,
      );
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'meta-description-length-ok');
      expect(passIds.length).toBe(1);
    });
  });

  describe('headings', () => {
    it('reports error when H1 is missing', async () => {
      const ctx = makeCtx('<html><head></head><body><h2>Sub</h2></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('missing-h1');
    });

    it('reports error when multiple H1 tags exist', async () => {
      const ctx = makeCtx(
        '<html><head></head><body><h1>First</h1><h1>Second</h1></body></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('multiple-h1');
    });

    it('passes with a single H1', async () => {
      const ctx = makeCtx('<html><head></head><body><h1>Title</h1></body></html>');
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'h1-present');
      expect(passIds.length).toBe(1);
    });

    it('reports warning when heading hierarchy is broken', async () => {
      const ctx = makeCtx(
        '<html><head></head><body><h1>H1</h1><h3>H3 without H2</h3></body></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('heading-hierarchy-invalid');
    });
  });

  describe('lang attribute', () => {
    it('reports warning when lang attribute is missing', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('missing-lang-attribute');
    });

    it('passes when lang attribute is set', async () => {
      const ctx = makeCtx('<html lang="en"><head></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'lang-attribute-present');
      expect(passIds.length).toBe(1);
    });
  });
});
