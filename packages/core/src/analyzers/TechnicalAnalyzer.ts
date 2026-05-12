import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import type { Issue } from '../types/index.js';

/**
 * Technical SEO checks:
 * - HTTPS usage
 * - Canonical tag
 * - noindex / nofollow flags
 * - Redirect chains
 * - Viewport meta tag
 */
export class TechnicalAnalyzer extends BaseAnalyzer {
  readonly name = 'technical' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    issues.push(...this.checkHttps(ctx));
    issues.push(...this.checkCanonical(ctx));
    issues.push(...this.checkRobotsMeta(ctx));
    issues.push(...this.checkRedirects(ctx));
    issues.push(...this.checkXRobotsHeader(ctx));
    issues.push(...this.checkHreflang(ctx));

    return issues;
  }

  private checkHttps(ctx: AnalyzerContext): Issue[] {
    const isHttps = ctx.url.startsWith('https://');

    if (!isHttps) {
      return [
        this.error(
          'not-https',
          'Page is not served over HTTPS',
          'HTTPS is a confirmed Google ranking signal. HTTP pages are marked as "Not Secure" in Chrome.',
          ctx.url,
          {
            fix: 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.',
            docs: 'https://developers.google.com/search/docs/crawling-indexing/https/https-faqs',
          },
        ),
      ];
    }

    const hsts = ctx.headers['strict-transport-security'];
    if (!hsts) {
      return [
        this.warning(
          'missing-hsts',
          'Missing HSTS header',
          'HTTP Strict Transport Security (HSTS) header is not set. Browsers can still be downgraded to HTTP.',
          ctx.url,
          {
            fix: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains',
          },
        ),
        this.pass('https-active', 'Page is served over HTTPS', ctx.url),
      ];
    }

    return [this.pass('https-active', 'Page is served over HTTPS', ctx.url)];
  }

  private checkCanonical(ctx: AnalyzerContext): Issue[] {
    const canonicalEl = ctx.dom.querySelector('link[rel="canonical"]');

    if (!canonicalEl) {
      return [
        this.warning(
          'missing-canonical',
          'Missing canonical tag',
          'No canonical tag found. Without it, search engines may index duplicate versions of this URL.',
          ctx.url,
          {
            fix: `Add <link rel="canonical" href="${ctx.url}"> in the <head>.`,
            docs: 'https://developers.google.com/search/docs/crawling-indexing/canonicalization',
          },
        ),
      ];
    }

    const href = canonicalEl.getAttribute('href')?.trim() ?? '';

    if (!href) {
      return [
        this.error(
          'empty-canonical',
          'Canonical tag has no href',
          'The canonical link element has an empty href attribute.',
          ctx.url,
          { fix: 'Set the href to the canonical URL for this page.' },
        ),
      ];
    }

    // Warn if canonical points to a different domain (could be intentional)
    try {
      const canonicalUrl = new URL(href, ctx.url);
      const pageUrl = new URL(ctx.url);

      if (canonicalUrl.origin !== pageUrl.origin) {
        return [
          this.info(
            'cross-domain-canonical',
            'Cross-domain canonical detected',
            `Canonical points to a different origin: ${canonicalUrl.origin}. Verify this is intentional.`,
            ctx.url,
            { value: href },
          ),
        ];
      }
    } catch {
      return [
        this.warning(
          'invalid-canonical-url',
          'Invalid canonical URL',
          `The canonical href "${href}" is not a valid URL.`,
          ctx.url,
          { fix: 'Provide a fully qualified URL for the canonical tag.' },
        ),
      ];
    }

    return [this.pass('canonical-present', 'Canonical tag is set', ctx.url)];
  }

  private checkRobotsMeta(ctx: AnalyzerContext): Issue[] {
    const issues: Issue[] = [];
    const robotsMeta = ctx.dom.querySelector('meta[name="robots"]');

    if (!robotsMeta) return issues;

    const content = (robotsMeta.getAttribute('content') ?? '').toLowerCase();

    if (content.includes('noindex')) {
      issues.push(
        this.error(
          'noindex-meta',
          'Page is set to noindex',
          'The robots meta tag includes "noindex". This page will be excluded from search engine indexes.',
          ctx.url,
          {
            fix: 'Remove "noindex" from the robots meta tag if this page should be indexed.',
            value: content,
          },
        ),
      );
    }

    if (content.includes('nofollow')) {
      issues.push(
        this.warning(
          'nofollow-meta',
          'Page is set to nofollow',
          'The robots meta tag includes "nofollow". Search engines will not follow links on this page.',
          ctx.url,
          { value: content },
        ),
      );
    }

    return issues;
  }

  private checkRedirects(ctx: AnalyzerContext): Issue[] {
    if (ctx.redirectChain.length === 0) {
      return [this.pass('no-redirect-chain', 'No redirect chain detected', ctx.url)];
    }

    if (ctx.redirectChain.length > 1) {
      return [
        this.warning(
          'redirect-chain',
          'Redirect chain detected',
          `This URL goes through ${ctx.redirectChain.length} redirects before reaching the final destination. Each hop adds latency and dilutes link equity.`,
          ctx.url,
          {
            value: ctx.redirectChain.length,
            expected: 1,
            fix: 'Update all links to point directly to the final URL.',
          },
        ),
      ];
    }

    return [];
  }

  private checkXRobotsHeader(ctx: AnalyzerContext): Issue[] {
    const xRobots = ctx.headers['x-robots-tag']?.toLowerCase();
    if (!xRobots) return [];

    if (xRobots.includes('noindex')) {
      return [
        this.error(
          'x-robots-noindex',
          'X-Robots-Tag noindex header detected',
          'The server sends X-Robots-Tag: noindex. This page will be excluded from search indexes.',
          ctx.url,
          {
            fix: 'Remove the noindex directive from the X-Robots-Tag response header.',
            value: xRobots,
          },
        ),
      ];
    }

    return [];
  }

  private checkHreflang(ctx: AnalyzerContext): Issue[] {
    const hreflangLinks = ctx.dom.querySelectorAll('link[rel="alternate"][hreflang]');
    if (hreflangLinks.length === 0) return [];

    const issues: Issue[] = [];
    let hasXDefault = false;

    hreflangLinks.forEach((link) => {
      const lang = link.getAttribute('hreflang') ?? '';
      if (lang === 'x-default') hasXDefault = true;

      const href = link.getAttribute('href') ?? '';
      if (!href) {
        issues.push(
          this.warning(
            'hreflang-missing-href',
            'hreflang link missing href',
            `hreflang="${lang}" has no href attribute.`,
            ctx.url,
          ),
        );
      }
    });

    if (!hasXDefault) {
      issues.push(
        this.info(
          'hreflang-missing-x-default',
          'Missing x-default hreflang',
          'When using hreflang, add an x-default entry to handle unmatched locales.',
          ctx.url,
          { fix: 'Add <link rel="alternate" hreflang="x-default" href="...">.' },
        ),
      );
    }

    if (issues.length === 0) {
      issues.push(this.pass('hreflang-valid', 'hreflang tags are configured', ctx.url));
    }

    return issues;
  }
}
