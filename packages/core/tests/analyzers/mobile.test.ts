import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { MobileAnalyzer } from '../../src/analyzers/MobileAnalyzer.js';
import type { AnalyzerContext } from '../../src/analyzers/BaseAnalyzer.js';

function makeCtx(html: string): AnalyzerContext {
  const { document: dom } = parseHTML(html);
  return {
    url: 'https://example.com/',
    html,
    dom,
    headers: {},
    statusCode: 200,
    loadTimeMs: 100,
    redirectChain: [],
    internalLinks: [],
  };
}

describe('MobileAnalyzer', () => {
  let analyzer: MobileAnalyzer;

  beforeEach(() => {
    analyzer = new MobileAnalyzer();
  });

  describe('viewport meta tag', () => {
    it('reports error when viewport meta is missing', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('missing-viewport-meta');
    });

    it('warns when viewport prevents user zooming', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="viewport" content="width=device-width, user-scalable=no"></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('viewport-no-scaling');
    });

    it('warns when viewport is not set to device-width', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="viewport" content="width=1024"></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('viewport-not-responsive');
    });

    it('passes when viewport is correctly configured', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'viewport-ok');
      expect(passIds.length).toBe(1);
    });
  });

  describe('font scaling', () => {
    it('warns when text-size-adjust: none is used inline', async () => {
      const ctx = makeCtx(
        '<html><head></head><body><p style="text-size-adjust: none">Text</p></body></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('text-size-adjust-none');
    });

    it('passes when no font scaling overrides are detected', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><p>Normal text</p></body></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'font-scaling-ok');
      expect(passIds.length).toBe(1);
    });
  });

  describe('tap targets', () => {
    it('warns when small tap targets are detected', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><a href="/page" style="height: 12px">Link</a></body></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('small-tap-targets');
    });

    it('passes when no small tap targets are detected', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><a href="/page">Normal link</a></body></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'tap-targets-ok');
      expect(passIds.length).toBe(1);
    });
  });
});
