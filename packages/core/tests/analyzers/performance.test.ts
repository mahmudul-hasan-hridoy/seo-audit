import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { PerformanceAnalyzer } from '../../src/analyzers/PerformanceAnalyzer.js';
import type { AnalyzerContext } from '../../src/analyzers/BaseAnalyzer.js';

function makeCtx(
  html: string,
  loadTimeMs = 100,
  headers: Record<string, string> = {},
): AnalyzerContext {
  const { document: dom } = parseHTML(html);
  return {
    url: 'https://example.com/',
    html,
    dom,
    headers,
    statusCode: 200,
    loadTimeMs,
    redirectChain: [],
    internalLinks: [],
  };
}

describe('PerformanceAnalyzer', () => {
  let analyzer: PerformanceAnalyzer;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
  });

  describe('load time', () => {
    it('passes when load time is fast', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>', 100);
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'load-time-ok');
      expect(passIds.length).toBe(1);
    });

    it('warns when load time is slow (> 200ms)', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>', 500);
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('ttfb-slow');
    });

    it('warns when load time is very slow (> 3s)', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>', 4000);
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('load-time-slow');
    });

    it('errors when load time is critically slow (> 6s)', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>', 7000);
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('load-time-critical');
    });
  });

  describe('compression', () => {
    it('warns when no compression is set', async () => {
      const ctx = makeCtx('<html></html>', 100, {});
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('no-compression');
    });

    it('passes when brotli compression is used', async () => {
      const ctx = makeCtx('<html></html>', 100, { 'content-encoding': 'br' });
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'brotli-compression');
      expect(passIds.length).toBe(1);
    });

    it('passes when gzip compression is used', async () => {
      const ctx = makeCtx('<html></html>', 100, { 'content-encoding': 'gzip' });
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'gzip-compression');
      expect(passIds.length).toBe(1);
    });
  });

  describe('render-blocking resources', () => {
    it('warns when multiple render-blocking stylesheets are found', async () => {
      const css = ['link1.css', 'link2.css', 'link3.css', 'link4.css']
        .map((src) => `<link rel="stylesheet" href="${src}">`)
        .join('');
      const ctx = makeCtx(`<html><head>${css}</head><body></body></html>`, 100);
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('render-blocking-css');
    });

    it('warns when render-blocking scripts exist in head', async () => {
      const ctx = makeCtx(
        '<html><head><script src="app.js"></script></head><body></body></html>',
        100,
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('render-blocking-scripts');
    });

    it('passes when scripts use defer', async () => {
      const ctx = makeCtx(
        '<html><head><script src="app.js" defer></script></head><body></body></html>',
        100,
      );
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'no-render-blocking-scripts');
      expect(passIds.length).toBe(1);
    });
  });

  describe('cache control', () => {
    it('gives info when no cache-control header', async () => {
      const ctx = makeCtx('<html></html>', 100, {});
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('missing-cache-control');
    });

    it('passes when cache-control is set', async () => {
      const ctx = makeCtx('<html></html>', 100, { 'cache-control': 'max-age=3600' });
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'cache-control-set');
      expect(passIds.length).toBe(1);
    });
  });
});
