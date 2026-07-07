import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import type { Issue } from '../types/index.js';

/**
 * Thresholds aligned with Google's Core Web Vitals (2024+) and HTTP Archive
 * median benchmarks. All measurements here are of the *server-side fetch time*
 * (time from request start to full HTML body received), which is a proxy for
 * TTFB + HTML transfer time — not client-side LCP/CLS, which require a real
 * browser to measure.
 */
const SERVER_RESPONSE_GOOD_MS = 200;   // Google: "good" TTFB target
const SERVER_RESPONSE_NEEDS_IMPROVEMENT_MS = 800; // Google: "needs improvement" boundary
const LOAD_TIME_WARNING_MS = 3000;     // 3 s: likely slow even accounting for transfer
const LOAD_TIME_ERROR_MS = 6000;       // 6 s: critically slow
const PAGE_SIZE_WARNING_BYTES = 1_000_000; // 1 MB
const PAGE_SIZE_ERROR_BYTES = 3_000_000;   // 3 MB

/**
 * Performance-related SEO checks:
 * - Server response time (proxy for TTFB)
 * - Total fetch time
 * - Response compression (gzip/brotli)
 * - HTML size
 * - Render-blocking resource hints
 * - Cache-Control header
 */
export class PerformanceAnalyzer extends BaseAnalyzer {
  readonly name = 'performance' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    issues.push(...this.checkServerResponseTime(ctx));
    issues.push(...this.checkCompression(ctx));
    issues.push(...this.checkHtmlSize(ctx));
    issues.push(...this.checkRenderBlocking(ctx));
    issues.push(...this.checkCacheControl(ctx));

    return issues;
  }

  /**
   * Check total fetch time (request start → full body received).
   * This is the best server-side approximation we can make without a real browser.
   * Covers both TTFB and HTML transfer time.
   */
  private checkServerResponseTime(ctx: AnalyzerContext): Issue[] {
    const ms = ctx.loadTimeMs;

    if (ms > LOAD_TIME_ERROR_MS) {
      return [
        this.error(
          'server-response-critical',
          'Server response time is critically slow',
          `Page took ${ms}ms to fully load (request → body received). Google's Core Web Vitals flag pages over 4s as "poor" LCP.`,
          ctx.url,
          {
            value: ms,
            expected: `< ${LOAD_TIME_WARNING_MS}ms`,
            fix: 'Optimize server response, enable caching/CDN, reduce HTML payload size.',
            docs: 'https://web.dev/lcp/',
          },
        ),
      ];
    }

    if (ms > LOAD_TIME_WARNING_MS) {
      return [
        this.warning(
          'server-response-slow',
          'Server response time is slow',
          `Page took ${ms}ms to fully load. Aim for under ${LOAD_TIME_WARNING_MS}ms to keep LCP in the "good" range.`,
          ctx.url,
          {
            value: ms,
            expected: `< ${LOAD_TIME_WARNING_MS}ms`,
            fix: 'Consider server-side caching, image optimization, and reducing Time to First Byte.',
            docs: 'https://web.dev/ttfb/',
          },
        ),
      ];
    }

    if (ms > SERVER_RESPONSE_NEEDS_IMPROVEMENT_MS) {
      return [
        this.warning(
          'server-response-needs-improvement',
          'Server response time needs improvement',
          `Page responded in ${ms}ms. Google recommends TTFB under ${SERVER_RESPONSE_GOOD_MS}ms for a "good" score.`,
          ctx.url,
          {
            value: ms,
            expected: `< ${SERVER_RESPONSE_GOOD_MS}ms`,
            fix: 'Optimize server response time, use edge caching or a CDN.',
            docs: 'https://web.dev/ttfb/',
          },
        ),
      ];
    }

    if (ms > SERVER_RESPONSE_GOOD_MS) {
      return [
        this.info(
          'server-response-acceptable',
          'Server response time is acceptable',
          `Page responded in ${ms}ms. Within acceptable range, but under ${SERVER_RESPONSE_GOOD_MS}ms is ideal.`,
          ctx.url,
          { value: ms, expected: `< ${SERVER_RESPONSE_GOOD_MS}ms` },
        ),
      ];
    }

    return [this.pass('server-response-ok', 'Server response time is excellent', ctx.url)];
  }

  private checkCompression(ctx: AnalyzerContext): Issue[] {
    const encoding = ctx.headers['content-encoding']?.toLowerCase();

    if (!encoding) {
      return [
        this.warning(
          'no-compression',
          'Response compression is disabled',
          'Server does not send gzip or brotli compression. This increases transfer size and slows load times.',
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
        `Content-Encoding: ${encoding} is set but is not a recognized compression format.`,
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
          `HTML is ${this.formatBytes(bytes)}. Consider optimizing to improve parse time.`,
          ctx.url,
          { value: bytes, expected: `< ${this.formatBytes(PAGE_SIZE_WARNING_BYTES)}` },
        ),
      ];
    }

    return [this.pass('html-size-ok', 'HTML document size is acceptable', ctx.url)];
  }

  private checkRenderBlocking(ctx: AnalyzerContext): Issue[] {
    const issues: Issue[] = [];

    const headEl = ctx.dom.querySelector('head');
    if (!headEl) return issues;

    // Render-blocking <link rel="stylesheet"> without a non-screen media query
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
            fix: 'Combine stylesheets, inline critical CSS, or use media attributes to defer non-critical styles.',
            docs: 'https://web.dev/render-blocking-resources/',
          },
        ),
      );
    }

    // Synchronous <script> tags in <head> without defer/async
    const blockingScripts = Array.from(headEl.querySelectorAll('script[src]')).filter(
      (el) => !el.hasAttribute('defer') && !el.hasAttribute('async'),
    );

    if (blockingScripts.length > 0) {
      issues.push(
        this.warning(
          'render-blocking-scripts',
          'Render-blocking scripts in <head>',
          `Found ${blockingScripts.length} synchronous script(s) in <head> without defer or async. These block HTML parsing.`,
          ctx.url,
          {
            value: blockingScripts.length,
            fix: 'Add defer or async attributes to non-critical scripts, or move them to end of <body>.',
            docs: 'https://web.dev/render-blocking-resources/',
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
          'No Cache-Control header found. Browsers may not cache this page efficiently, increasing repeat-visit load times.',
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
