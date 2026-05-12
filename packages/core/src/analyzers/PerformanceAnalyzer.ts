import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import type { Issue } from '../types/index.js';

const TTFB_WARNING_MS = 200;
const TTFB_ERROR_MS = 600;
const LOAD_TIME_WARNING_MS = 3000;
const LOAD_TIME_ERROR_MS = 6000;
const PAGE_SIZE_WARNING_BYTES = 1_000_000; // 1MB
const PAGE_SIZE_ERROR_BYTES = 3_000_000; // 3MB

/**
 * Performance-related SEO checks:
 * - TTFB (Time to First Byte)
 * - Total load time
 * - Response compression (gzip/brotli)
 * - Content-Type header
 * - HTML size
 * - Render-blocking resource hints
 */
export class PerformanceAnalyzer extends BaseAnalyzer {
  readonly name = 'performance' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    issues.push(...this.checkLoadTime(ctx));
    issues.push(...this.checkCompression(ctx));
    issues.push(...this.checkHtmlSize(ctx));
    issues.push(...this.checkRenderBlocking(ctx));
    issues.push(...this.checkCacheControl(ctx));

    return issues;
  }

  private checkLoadTime(ctx: AnalyzerContext): Issue[] {
    const ms = ctx.loadTimeMs;

    if (ms > LOAD_TIME_ERROR_MS) {
      return [
        this.error(
          'load-time-critical',
          'Page load time is critically slow',
          `Page took ${ms}ms to load. Google's Core Web Vitals target LCP under 2.5s.`,
          ctx.url,
          {
            value: ms,
            expected: `< ${LOAD_TIME_WARNING_MS}ms`,
            fix: 'Optimize images, reduce JavaScript, enable caching, use a CDN.',
            docs: 'https://web.dev/lcp/',
          },
        ),
      ];
    }

    if (ms > LOAD_TIME_WARNING_MS) {
      return [
        this.warning(
          'load-time-slow',
          'Page load time is slow',
          `Page took ${ms}ms to load. Aim for under ${LOAD_TIME_WARNING_MS}ms.`,
          ctx.url,
          {
            value: ms,
            expected: `< ${LOAD_TIME_WARNING_MS}ms`,
            fix: 'Consider lazy loading, image optimization, and code splitting.',
          },
        ),
      ];
    }

    if (ms > TTFB_WARNING_MS) {
      return [
        this.warning(
          'ttfb-slow',
          'Time to First Byte (TTFB) is slow',
          `Server responded in ${ms}ms. Google recommends TTFB under ${TTFB_WARNING_MS}ms.`,
          ctx.url,
          {
            value: ms,
            expected: `< ${TTFB_WARNING_MS}ms`,
            fix: 'Optimize server response time, use edge caching or a CDN.',
            docs: 'https://web.dev/ttfb/',
          },
        ),
      ];
    }

    return [this.pass('load-time-ok', 'Page load time is acceptable', ctx.url)];
  }

  private checkCompression(ctx: AnalyzerContext): Issue[] {
    const encoding = ctx.headers['content-encoding']?.toLowerCase();

    if (!encoding) {
      return [
        this.warning(
          'no-compression',
          'Response compression is disabled',
          'Server does not send gzip or brotli compression. This increases transfer size significantly.',
          ctx.url,
          {
            fix: 'Enable gzip or brotli compression on your web server.',
            docs: 'https://web.dev/uses-text-compression/',
          },
        ),
      ];
    }

    if (encoding.includes('br')) {
      return [this.pass('brotli-compression', 'Brotli compression is enabled', ctx.url)];
    }

    if (encoding.includes('gzip')) {
      return [this.pass('gzip-compression', 'Gzip compression is enabled', ctx.url)];
    }

    return [
      this.info(
        'unknown-encoding',
        'Unknown content encoding',
        `Content-Encoding: ${encoding} is set but not a recognized compression format.`,
        ctx.url,
        { value: encoding },
      ),
    ];
  }

  private checkHtmlSize(ctx: AnalyzerContext): Issue[] {
    const bytes = new TextEncoder().encode(ctx.html).length;

    if (bytes > PAGE_SIZE_ERROR_BYTES) {
      return [
        this.error(
          'html-size-critical',
          'HTML document size is very large',
          `HTML is ${this.formatBytes(bytes)}. Very large HTML files slow parsing and increase bandwidth costs.`,
          ctx.url,
          {
            value: bytes,
            expected: `< ${this.formatBytes(PAGE_SIZE_WARNING_BYTES)}`,
            fix: 'Remove inline scripts/styles, reduce DOM size, lazy load content.',
          },
        ),
      ];
    }

    if (bytes > PAGE_SIZE_WARNING_BYTES) {
      return [
        this.warning(
          'html-size-large',
          'HTML document size is large',
          `HTML is ${this.formatBytes(bytes)}. Consider optimizing.`,
          ctx.url,
          { value: bytes, expected: `< ${this.formatBytes(PAGE_SIZE_WARNING_BYTES)}` },
        ),
      ];
    }

    return [this.pass('html-size-ok', 'HTML document size is acceptable', ctx.url)];
  }

  private checkRenderBlocking(ctx: AnalyzerContext): Issue[] {
    const issues: Issue[] = [];

    // Check for render-blocking <link rel="stylesheet"> in <head> without media query
    const headEl = ctx.dom.querySelector('head');
    if (!headEl) return issues;

    const blockingStylesheets = Array.from(
      headEl.querySelectorAll('link[rel="stylesheet"]'),
    ).filter((el) => {
      const media = el.getAttribute('media');
      return !media || media === 'all' || media === 'screen';
    });

    if (blockingStylesheets.length > 3) {
      issues.push(
        this.warning(
          'render-blocking-css',
          'Multiple render-blocking stylesheets',
          `Found ${blockingStylesheets.length} render-blocking stylesheets in <head>. This delays First Contentful Paint.`,
          ctx.url,
          {
            value: blockingStylesheets.length,
            fix: 'Combine stylesheets, inline critical CSS, or use media attributes.',
            docs: 'https://web.dev/render-blocking-resources/',
          },
        ),
      );
    }

    // Check for synchronous <script> tags in <head>
    const blockingScripts = Array.from(headEl.querySelectorAll('script[src]')).filter(
      (el) => !el.hasAttribute('defer') && !el.hasAttribute('async'),
    );

    if (blockingScripts.length > 0) {
      issues.push(
        this.warning(
          'render-blocking-scripts',
          'Render-blocking scripts in <head>',
          `Found ${blockingScripts.length} synchronous script(s) in <head> without defer/async.`,
          ctx.url,
          {
            value: blockingScripts.length,
            fix: 'Add defer or async attributes to non-critical scripts, or move to end of <body>.',
          },
        ),
      );
    } else {
      issues.push(
        this.pass('no-render-blocking-scripts', 'No render-blocking scripts in <head>', ctx.url),
      );
    }

    return issues;
  }

  private checkCacheControl(ctx: AnalyzerContext): Issue[] {
    const cacheControl = ctx.headers['cache-control'];

    if (!cacheControl) {
      return [
        this.info(
          'missing-cache-control',
          'No Cache-Control header',
          'No Cache-Control header found. Browsers may not cache this page efficiently.',
          ctx.url,
          { fix: 'Set Cache-Control: max-age=3600 or similar for static pages.' },
        ),
      ];
    }

    return [this.pass('cache-control-set', 'Cache-Control header is set', ctx.url)];
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1_048_576).toFixed(1)}MB`;
  }
}
