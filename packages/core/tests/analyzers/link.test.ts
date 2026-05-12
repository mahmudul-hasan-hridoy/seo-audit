import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { LinkAnalyzer } from '../../src/analyzers/LinkAnalyzer.js';
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

describe('LinkAnalyzer', () => {
  let analyzer: LinkAnalyzer;

  beforeEach(() => {
    analyzer = new LinkAnalyzer();
  });

  it('warns when there are few internal links', async () => {
    const ctx = makeCtx(
      '<html><body><a href="/page1">Page 1</a></body></html>',
    );
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('few-internal-links');
  });

  it('passes when there are sufficient internal links', async () => {
    const links = Array.from(
      { length: 5 },
      (_, i) => `<a href="/page${i}">Page ${i}</a>`,
    ).join('');
    const ctx = makeCtx(`<html><body>${links}</body></html>`);
    const issues = await analyzer.analyze(ctx);
    const passIds = issues.filter((i) => i.id === 'internal-links-ok');
    expect(passIds.length).toBe(1);
  });

  it('warns when generic anchor text is used', async () => {
    const ctx = makeCtx(
      '<html><body><a href="/page1">click here</a><a href="/page2">read more</a><a href="/page3">here</a><a href="/page4">Page 4</a></body></html>',
    );
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('generic-anchor-text');
  });

  it('warns when there are too many links on a page', async () => {
    const links = Array.from(
      { length: 160 },
      (_, i) => `<a href="/page${i}">Page ${i}</a>`,
    ).join('');
    const ctx = makeCtx(`<html><body>${links}</body></html>`);
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('too-many-links');
  });

  it('passes when anchor text is descriptive', async () => {
    const links = Array.from(
      { length: 5 },
      (_, i) => `<a href="/page${i}">Descriptive link text ${i}</a>`,
    ).join('');
    const ctx = makeCtx(`<html><body>${links}</body></html>`);
    const issues = await analyzer.analyze(ctx);
    const passIds = issues.filter((i) => i.id === 'anchor-text-ok');
    expect(passIds.length).toBe(1);
  });
});
