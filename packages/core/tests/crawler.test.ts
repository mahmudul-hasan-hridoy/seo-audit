import { describe, it, expect } from 'vitest';
import { Queue } from '../src/crawler/Queue.js';
import { LinkExtractor } from '../src/crawler/LinkExtractor.js';
import { parseHTML } from 'linkedom';

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
