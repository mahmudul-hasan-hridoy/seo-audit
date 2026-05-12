import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { SchemaAnalyzer } from '../../src/analyzers/SchemaAnalyzer.js';
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

describe('SchemaAnalyzer', () => {
  let analyzer: SchemaAnalyzer;

  beforeEach(() => {
    analyzer = new SchemaAnalyzer();
  });

  describe('JSON-LD', () => {
    it('gives info when no JSON-LD is found', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('no-json-ld');
    });

    it('reports error for invalid JSON in JSON-LD', async () => {
      const ctx = makeCtx(
        '<html><head><script type="application/ld+json">{ invalid json }</script></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids.some((id) => id.startsWith('json-ld-invalid'))).toBe(true);
    });

    it('warns when JSON-LD is missing @context', async () => {
      const ctx = makeCtx(
        '<html><head><script type="application/ld+json">{"@type":"Article"}</script></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids.some((id) => id.startsWith('json-ld-missing-context'))).toBe(true);
    });

    it('warns when JSON-LD is missing @type', async () => {
      const ctx = makeCtx(
        '<html><head><script type="application/ld+json">{"@context":"https://schema.org"}</script></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids.some((id) => id.startsWith('json-ld-missing-type'))).toBe(true);
    });

    it('passes with valid JSON-LD structured data', async () => {
      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        name: 'Test Article',
      });
      const ctx = makeCtx(
        `<html><head><script type="application/ld+json">${jsonLd}</script></head></html>`,
      );
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'json-ld-present');
      expect(passIds.length).toBe(1);
    });
  });

  describe('Open Graph', () => {
    it('gives info when no Open Graph tags are found', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('no-open-graph');
    });

    it('warns when Open Graph tags are incomplete', async () => {
      const ctx = makeCtx(
        '<html><head><meta property="og:title" content="Title"></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('incomplete-open-graph');
    });

    it('passes when all required Open Graph tags are present', async () => {
      const ctx = makeCtx(`
        <html><head>
          <meta property="og:title" content="Title">
          <meta property="og:description" content="Description">
          <meta property="og:url" content="https://example.com">
          <meta property="og:image" content="https://example.com/image.jpg">
        </head></html>
      `);
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'open-graph-ok');
      expect(passIds.length).toBe(1);
    });
  });

  describe('Twitter Card', () => {
    it('gives info when no Twitter Card tag is found', async () => {
      const ctx = makeCtx('<html><head></head><body></body></html>');
      const issues = await analyzer.analyze(ctx);
      const ids = issues.map((i) => i.id);
      expect(ids).toContain('no-twitter-card');
    });

    it('passes when Twitter Card meta tag is present', async () => {
      const ctx = makeCtx(
        '<html><head><meta name="twitter:card" content="summary_large_image"></head></html>',
      );
      const issues = await analyzer.analyze(ctx);
      const passIds = issues.filter((i) => i.id === 'twitter-card-ok');
      expect(passIds.length).toBe(1);
    });
  });
});
