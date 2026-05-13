import { describe, it, expect } from 'vitest';
import { Queue } from '../src/crawler/Queue.js';
import { LinkExtractor } from '../src/crawler/LinkExtractor.js';
import { parseHTML } from 'linkedom';
import { isNonHtmlUrl } from '../src/crawler/urlUtils.js';

describe('Queue', () => {
  it('enqueues and dequeues URLs in FIFO order', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/', 0);
    q.enqueue('https://example.com/page1', 1);

    expect(q.dequeue()?.url).toBe('https://example.com/');
    expect(q.dequeue()?.url).toBe('https://example.com/page1');
  });

  it('does not enqueue the same URL twice', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/', 0);
    q.enqueue('https://example.com/', 0);
    expect(q.totalSeen).toBe(1);
    expect(q.pendingCount).toBe(1);
  });

  it('respects max depth', () => {
    const q = new Queue(2);
    q.enqueue('https://example.com/', 0);
    q.enqueue('https://example.com/page1', 1);
    q.enqueue('https://example.com/deep', 2);
    q.enqueue('https://example.com/too-deep', 3);
    expect(q.totalSeen).toBe(3);
  });

  it('hasMore returns false when queue is empty', () => {
    const q = new Queue(3);
    expect(q.hasMore).toBe(false);
    q.enqueue('https://example.com/', 0);
    expect(q.hasMore).toBe(true);
    q.dequeue();
    expect(q.hasMore).toBe(false);
  });

  it('normalizes trailing slashes', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/page/', 0);
    q.enqueue('https://example.com/page', 0);
    expect(q.totalSeen).toBe(1);
  });

  it('normalizes hash fragments', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/page#section', 0);
    q.enqueue('https://example.com/page#other', 0);
    expect(q.totalSeen).toBe(1);
  });

  it('hasVisited returns true for enqueued URLs', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/', 0);
    expect(q.hasVisited('https://example.com/')).toBe(true);
    expect(q.hasVisited('https://example.com/other')).toBe(false);
  });

  it('ignores invalid URLs', () => {
    const q = new Queue(3);
    q.enqueue('not-a-url', 0);
    expect(q.totalSeen).toBe(0);
  });
});

describe('Queue — non-HTML filtering', () => {
  it('silently drops sitemap.xml', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/sitemap.xml', 0);
    expect(q.totalSeen).toBe(0);
    expect(q.hasMore).toBe(false);
  });

  it('silently drops robots.txt', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/robots.txt', 0);
    expect(q.totalSeen).toBe(0);
  });

  it('silently drops llms.txt', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/llms.txt', 0);
    expect(q.totalSeen).toBe(0);
  });

  it('silently drops PDF files', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/brochure.pdf', 0);
    expect(q.totalSeen).toBe(0);
  });

  it('silently drops image files', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/logo.png', 0);
    q.enqueue('https://example.com/hero.webp', 0);
    q.enqueue('https://example.com/icon.svg', 0);
    expect(q.totalSeen).toBe(0);
  });

  it('silently drops JS and CSS files', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/bundle.js', 0);
    q.enqueue('https://example.com/styles.css', 0);
    expect(q.totalSeen).toBe(0);
  });

  it('still enqueues HTML pages normally', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/', 0);
    q.enqueue('https://example.com/about', 1);
    q.enqueue('https://example.com/blog/post', 2);
    q.enqueue('https://example.com/page.html', 2);
    expect(q.totalSeen).toBe(4);
  });

  it('mixes HTML and non-HTML — only HTML is queued', () => {
    const q = new Queue(3);
    q.enqueue('https://example.com/', 0);
    q.enqueue('https://example.com/sitemap.xml', 0);
    q.enqueue('https://example.com/about', 1);
    q.enqueue('https://example.com/logo.png', 1);
    q.enqueue('https://example.com/feed.rss', 1);
    expect(q.totalSeen).toBe(2);
    expect(q.pendingCount).toBe(2);
  });
});

describe('LinkExtractor — non-HTML filtering', () => {
  function parse(html: string): Document {
    const { document } = parseHTML(html);
    return document as unknown as Document;
  }

  it('does not include internal sitemap.xml links as crawlable pages', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse(`<html><body>
      <a href="/sitemap.xml">Sitemap</a>
      <a href="/about">About</a>
    </body></html>`);
    const { internal } = extractor.extract(dom);
    expect(internal.length).toBe(1);
    expect(internal[0]?.url).toBe('https://example.com/about');
  });

  it('does not include internal PDF links', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse(`<html><body>
      <a href="/docs/report.pdf">Download PDF</a>
      <a href="/contact">Contact</a>
    </body></html>`);
    const { internal } = extractor.extract(dom);
    expect(internal.length).toBe(1);
    expect(internal[0]?.url).toBe('https://example.com/contact');
  });

  it('does not include internal image/asset links', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse(`<html><body>
      <a href="/images/hero.jpg">Photo</a>
      <a href="/bundle.js">Script</a>
      <a href="/styles.css">Style</a>
      <a href="/page">Page</a>
    </body></html>`);
    const { internal } = extractor.extract(dom);
    expect(internal.length).toBe(1);
    expect(internal[0]?.url).toBe('https://example.com/page');
  });

  it('still includes external non-HTML links (not our crawl concern)', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse(`<html><body>
      <a href="https://other.com/document.pdf">External PDF</a>
    </body></html>`);
    const { external } = extractor.extract(dom);
    expect(external.length).toBe(1);
  });
});

describe('LinkExtractor', () => {
  function parse(html: string): Document {
    const { document } = parseHTML(html);
    return document as unknown as Document;
  }

  it('extracts internal links', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse('<html><body><a href="/about">About</a><a href="/contact">Contact</a></body></html>');
    const { internal, external } = extractor.extract(dom);
    expect(internal.length).toBe(2);
    expect(external.length).toBe(0);
  });

  it('extracts external links', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse('<html><body><a href="https://other.com/page">External</a></body></html>');
    const { internal, external } = extractor.extract(dom);
    expect(external.length).toBe(1);
    expect(internal.length).toBe(0);
  });

  it('skips mailto and tel links', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse('<html><body><a href="mailto:test@example.com">Email</a><a href="tel:+1234567">Phone</a></body></html>');
    const { internal, external } = extractor.extract(dom);
    expect(internal.length).toBe(0);
    expect(external.length).toBe(0);
  });

  it('skips fragment-only links', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse('<html><body><a href="#section">Section</a></body></html>');
    const { internal, external } = extractor.extract(dom);
    expect(internal.length).toBe(0);
    expect(external.length).toBe(0);
  });

  it('deduplicates links', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse('<html><body><a href="/page">Page</a><a href="/page">Same Page</a></body></html>');
    const { internal } = extractor.extract(dom);
    expect(internal.length).toBe(1);
  });

  it('detects nofollow attribute', () => {
    const extractor = new LinkExtractor('https://example.com/');
    const dom = parse('<html><body><a href="https://other.com" rel="nofollow">Link</a></body></html>');
    const { external } = extractor.extract(dom);
    expect(external[0]?.nofollow).toBe(true);
  });
});
