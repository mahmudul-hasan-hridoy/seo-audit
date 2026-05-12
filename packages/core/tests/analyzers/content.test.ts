import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { ContentAnalyzer } from '../../src/analyzers/ContentAnalyzer.js';
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

function makeBody(words: number): string {
  const text = Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
  return `<html><body><p>${text}</p></body></html>`;
}

describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;

  beforeEach(() => {
    analyzer = new ContentAnalyzer();
  });

  it('reports error for thin content (< 150 words)', async () => {
    const ctx = makeCtx(makeBody(50));
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('thin-content');
  });

  it('warns for low word count (150-300 words)', async () => {
    const ctx = makeCtx(makeBody(200));
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('low-word-count');
  });

  it('passes when word count is sufficient (>= 300 words)', async () => {
    const ctx = makeCtx(makeBody(350));
    const issues = await analyzer.analyze(ctx);
    const passIds = issues.filter((i) => i.id === 'word-count-ok');
    expect(passIds.length).toBe(1);
  });

  it('does not count script/style content in word count', async () => {
    const scriptWords = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    const html = `<html><body><script>${scriptWords}</script><p>Few actual words here</p></body></html>`;
    const ctx = makeCtx(html);
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids.some((id) => id === 'thin-content' || id === 'low-word-count')).toBe(true);
  });

  it('passes readability check for normal content', async () => {
    const normalContent = Array.from(
      { length: 10 },
      () => 'This is a short simple sentence for testing.',
    ).join(' ');
    const ctx = makeCtx(`<html><body><p>${normalContent}</p></body></html>`);
    const issues = await analyzer.analyze(ctx);
    const passIds = issues.filter((i) => i.id === 'readability-ok');
    expect(passIds.length).toBe(1);
  });
});
