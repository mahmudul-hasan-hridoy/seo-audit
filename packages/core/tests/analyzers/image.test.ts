import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { ImageAnalyzer } from '../../src/analyzers/ImageAnalyzer.js';
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

describe('ImageAnalyzer', () => {
  let analyzer: ImageAnalyzer;

  beforeEach(() => {
    analyzer = new ImageAnalyzer();
  });

  it('passes when no images are found', async () => {
    const ctx = makeCtx('<html><body><p>No images here</p></body></html>');
    const issues = await analyzer.analyze(ctx);
    const passIds = issues.filter((i) => i.id === 'no-images');
    expect(passIds.length).toBe(1);
  });

  it('reports error for images missing alt text', async () => {
    const ctx = makeCtx(
      '<html><body><img src="photo.jpg"></body></html>',
    );
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('images-missing-alt');
  });

  it('passes when all images have alt text', async () => {
    const ctx = makeCtx(
      '<html><body><img src="photo.jpg" alt="A photo" width="100" height="100" loading="lazy"></body></html>',
    );
    const issues = await analyzer.analyze(ctx);
    const passIds = issues.filter((i) => i.id === 'images-alt-ok');
    expect(passIds.length).toBe(1);
  });

  it('warns when images are missing width/height (CLS)', async () => {
    const ctx = makeCtx(
      '<html><body><img src="photo.jpg" alt="Photo"></body></html>',
    );
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('images-missing-dimensions');
  });

  it('passes when images have explicit dimensions', async () => {
    const ctx = makeCtx(
      '<html><body><img src="photo.jpg" alt="Photo" width="800" height="600" loading="lazy"></body></html>',
    );
    const issues = await analyzer.analyze(ctx);
    const passIds = issues.filter((i) => i.id === 'images-dimensions-ok');
    expect(passIds.length).toBe(1);
  });

  it('warns when most images are not lazy loaded', async () => {
    const imgs = Array.from({ length: 5 }, (_, i) => `<img src="p${i}.jpg" alt="img">`).join('');
    const ctx = makeCtx(`<html><body>${imgs}</body></html>`);
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('images-not-lazy-loaded');
  });

  it('gives info when images are not next-gen format', async () => {
    const ctx = makeCtx(
      '<html><body><img src="photo.jpg" alt="Photo" width="100" height="100" loading="lazy"></body></html>',
    );
    const issues = await analyzer.analyze(ctx);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('images-not-next-gen');
  });

  it('passes when images use webp format', async () => {
    const ctx = makeCtx(
      '<html><body><img src="photo.webp" alt="Photo" width="100" height="100" loading="lazy"></body></html>',
    );
    const issues = await analyzer.analyze(ctx);
    const passIds = issues.filter((i) => i.id === 'images-next-gen');
    expect(passIds.length).toBe(1);
  });
});
