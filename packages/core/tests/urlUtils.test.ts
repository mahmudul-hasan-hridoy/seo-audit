import { describe, it, expect } from 'vitest';
import { isNonHtmlUrl, isHtmlContentType } from '../src/crawler/urlUtils.js';

describe('isNonHtmlUrl', () => {
  // ─── Should be skipped (non-HTML) ──────────────────────────────────────────

  it('rejects sitemap.xml', () => {
    expect(isNonHtmlUrl('https://example.com/sitemap.xml')).toBe(true);
  });

  it('rejects robots.txt', () => {
    expect(isNonHtmlUrl('https://example.com/robots.txt')).toBe(true);
  });

  it('rejects llms.txt', () => {
    expect(isNonHtmlUrl('https://example.com/llms.txt')).toBe(true);
  });

  it('rejects sitemap.md style files', () => {
    expect(isNonHtmlUrl('https://example.com/sitemap.md')).toBe(true);
  });

  it('rejects PDF files', () => {
    expect(isNonHtmlUrl('https://example.com/resume.pdf')).toBe(true);
  });

  it('rejects image files', () => {
    expect(isNonHtmlUrl('https://example.com/logo.png')).toBe(true);
    expect(isNonHtmlUrl('https://example.com/photo.jpg')).toBe(true);
    expect(isNonHtmlUrl('https://example.com/icon.svg')).toBe(true);
    expect(isNonHtmlUrl('https://example.com/hero.webp')).toBe(true);
    expect(isNonHtmlUrl('https://example.com/favicon.ico')).toBe(true);
  });

  it('rejects JavaScript files', () => {
    expect(isNonHtmlUrl('https://example.com/bundle.js')).toBe(true);
    expect(isNonHtmlUrl('https://example.com/chunk.mjs')).toBe(true);
  });

  it('rejects CSS files', () => {
    expect(isNonHtmlUrl('https://example.com/styles.css')).toBe(true);
  });

  it('rejects font files', () => {
    expect(isNonHtmlUrl('https://example.com/font.woff2')).toBe(true);
    expect(isNonHtmlUrl('https://example.com/font.ttf')).toBe(true);
  });

  it('rejects JSON files', () => {
    expect(isNonHtmlUrl('https://example.com/data.json')).toBe(true);
  });

  it('rejects archive files', () => {
    expect(isNonHtmlUrl('https://example.com/release.zip')).toBe(true);
    expect(isNonHtmlUrl('https://example.com/archive.tar.gz')).toBe(true);
  });

  it('rejects audio/video files', () => {
    expect(isNonHtmlUrl('https://example.com/video.mp4')).toBe(true);
    expect(isNonHtmlUrl('https://example.com/audio.mp3')).toBe(true);
  });

  // ─── Should be crawled (HTML) ───────────────────────────────────────────────

  it('accepts URLs with no extension', () => {
    expect(isNonHtmlUrl('https://example.com/')).toBe(false);
    expect(isNonHtmlUrl('https://example.com/about')).toBe(false);
    expect(isNonHtmlUrl('https://example.com/blog/post-1')).toBe(false);
  });

  it('accepts explicit .html extension', () => {
    expect(isNonHtmlUrl('https://example.com/page.html')).toBe(false);
    expect(isNonHtmlUrl('https://example.com/index.htm')).toBe(false);
  });

  it('accepts .php and .aspx pages', () => {
    expect(isNonHtmlUrl('https://example.com/page.php')).toBe(false);
    expect(isNonHtmlUrl('https://example.com/page.aspx')).toBe(false);
  });

  it('ignores query strings when checking extensions', () => {
    expect(isNonHtmlUrl('https://example.com/search?q=seo&format=json')).toBe(false);
  });

  it('handles invalid URLs gracefully', () => {
    expect(isNonHtmlUrl('not-a-url')).toBe(false);
  });
});

describe('isHtmlContentType', () => {
  it('accepts text/html', () => {
    expect(isHtmlContentType('text/html')).toBe(true);
  });

  it('accepts text/html with charset', () => {
    expect(isHtmlContentType('text/html; charset=utf-8')).toBe(true);
  });

  it('accepts application/xhtml+xml', () => {
    expect(isHtmlContentType('application/xhtml+xml')).toBe(true);
  });

  it('rejects application/xml', () => {
    expect(isHtmlContentType('application/xml')).toBe(false);
  });

  it('rejects text/xml', () => {
    expect(isHtmlContentType('text/xml')).toBe(false);
  });

  it('rejects text/plain', () => {
    expect(isHtmlContentType('text/plain')).toBe(false);
  });

  it('rejects application/pdf', () => {
    expect(isHtmlContentType('application/pdf')).toBe(false);
  });

  it('rejects image/png', () => {
    expect(isHtmlContentType('image/png')).toBe(false);
  });

  it('rejects application/json', () => {
    expect(isHtmlContentType('application/json')).toBe(false);
  });

  it('rejects empty content type', () => {
    expect(isHtmlContentType('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isHtmlContentType('TEXT/HTML; CHARSET=UTF-8')).toBe(true);
  });
});
