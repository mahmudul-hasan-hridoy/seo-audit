import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { TechnicalAnalyzer } from '../../src/analyzers/TechnicalAnalyzer.js';
import type { AnalyzerContext } from '../../src/analyzers/BaseAnalyzer.js';

function makeCtx(
  html: string,
  url = 'https://example.com/',
  headers: Record<string, string> = {},
  redirectChain: string[] = [],
): AnalyzerContext {
  const { document: dom } = parseHTML(html);
  return {
    url,
    html,
    dom,
    headers,
    statusCode: 200,
    loadTimeMs: 100,
    redirectChain,
    internalLinks: [],
  };
}

describe('TechnicalAnalyzer', () => {
  let analyzer: TechnicalAnalyzer;

  beforeEach(() => {
    analyzer = new TechnicalAnalyzer();
  });

  describe('HTTPS check', () => {
    it('reports error for HTTP URLs', async () => {
      const ctx = makeCtx('<html></html>', 'http://example.com/');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('not-https');
    });

    it('passes for HTTPS URLs', async () => {
      const ctx = makeCtx('<html></html>', 'https://example.com/', {
        'strict-transport-security': 'max-age=31536000',
      });
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'https-active');
      expect(passIds.length).toBeGreaterThan(0);
    });

    it('warns when HSTS header is missing on HTTPS', async () => {
      const ctx = makeCtx('<html></html>', 'https://example.com/');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('missing-hsts');
    });
  });

  describe('canonical tag', () => {
    it('warns when canonical tag is missing', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('missing-canonical');
    });

    it('reports error when canonical href is empty', async () => {
      const ctx = makeCtx(
        '<html><head><link rel="canonical" href=""></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('empty-canonical');
    });

    it('passes when canonical tag is correctly set', async () => {
      const ctx = makeCtx(
        '<html><head><link rel="canonical" href="https://example.com/"></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'canonical-present');
      expect(passIds.length).toBe(1);
    });
  });

  describe('robots meta', () => {
    it('reports error for noindex pages', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="robots" content="noindex"></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('noindex-meta');
    });

    it('reports warning for nofollow pages', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="robots" content="nofollow"></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('nofollow-meta');
    });
  });

  describe('redirect chains', () => {
    it('passes with no redirects', async () => {
      const ctx = makeCtx('<html></html>', 'https://example.com/', {}, []);
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'no-redirect-chain');
      expect(passIds.length).toBe(1);
    });

    it('warns when redirect chain has multiple hops', async () => {
      const ctx = makeCtx(
        '<html></html>',
        'https://example.com/final',
        {},
        ['https://example.com/old', 'https://example.com/newer'],
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('redirect-chain');
    });
  });

  describe('X-Robots-Tag header', () => {
    it('reports error for noindex in X-Robots-Tag', async () => {
      const ctx = makeCtx('<html></html>', 'https://example.com/', {
        'x-robots-tag': 'noindex',
      });
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('x-robots-noindex');
    });
  });
});
