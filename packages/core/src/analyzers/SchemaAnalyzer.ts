import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import type { Issue } from '../types/index.js';

interface JsonLdObject {
  '@context'?: string;
  '@type'?: string;
  [key: string]: unknown;
}

/**
 * Structured data / Schema.org checks:
 * - JSON-LD presence
 * - JSON-LD validity
 * - @context and @type presence
 * - Open Graph meta tags
 * - Twitter Card meta tags
 */
export class SchemaAnalyzer extends BaseAnalyzer {
  readonly name = 'schema' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    issues.push(...this.checkJsonLd(ctx));
    issues.push(...this.checkOpenGraph(ctx));
    issues.push(...this.checkTwitterCard(ctx));

    return issues;
  }

  private checkJsonLd(ctx: AnalyzerContext): Issue[] {
    const scriptEls = Array.from(ctx.dom.querySelectorAll('script[type="application/ld+json"]'));

    if (scriptEls.length === 0) {
      return [
        this.info(
          'no-json-ld',
          'No JSON-LD structured data found',
          'Adding Schema.org structured data can enable rich results in Google Search (ratings, FAQs, breadcrumbs, etc.).',
          ctx.url,
          {
            fix: 'Add appropriate JSON-LD markup. Start with Organization, WebPage, or BreadcrumbList.',
            docs: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
          },
        ),
      ];
    }

    const issues: Issue[] = [];
    let validCount = 0;

    scriptEls.forEach((el, index) => {
      const raw = el.textContent?.trim() ?? '';
      if (!raw) {
        issues.push(
          this.warning(
            `json-ld-empty-${index}`,
            'Empty JSON-LD script block',
            `Found an empty application/ld+json script block.`,
            ctx.url,
          ),
        );
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        issues.push(
          this.error(
            `json-ld-invalid-${index}`,
            'Invalid JSON-LD',
            `JSON-LD block ${index + 1} contains invalid JSON: ${e instanceof Error ? e.message : 'parse error'}.`,
            ctx.url,
            { fix: 'Validate your JSON-LD using https://validator.schema.org/' },
          ),
        );
        return;
      }

      // Validate structure
      const objects: JsonLdObject[] = Array.isArray(parsed)
        ? (parsed as JsonLdObject[])
        : [parsed as JsonLdObject];

      objects.forEach((obj, objIndex) => {
        if (!obj['@context']) {
          issues.push(
            this.warning(
              `json-ld-missing-context-${index}-${objIndex}`,
              'JSON-LD missing @context',
              'JSON-LD object is missing @context. Set it to "https://schema.org".',
              ctx.url,
            ),
          );
        }

        if (!obj['@type']) {
          issues.push(
            this.warning(
              `json-ld-missing-type-${index}-${objIndex}`,
              'JSON-LD missing @type',
              'JSON-LD object is missing @type (e.g. "Article", "Product", "Organization").',
              ctx.url,
            ),
          );
        } else {
          validCount++;
        }
      });
    });

    if (validCount > 0) {
      issues.push(
        this.pass('json-ld-present', `${validCount} valid JSON-LD schema block(s) found`, ctx.url),
      );
    }

    return issues;
  }

  private checkOpenGraph(ctx: AnalyzerContext): Issue[] {
    const requiredOgTags = ['og:title', 'og:description', 'og:url', 'og:image'];
    const issues: Issue[] = [];
    const missing: string[] = [];

    requiredOgTags.forEach((prop) => {
      const el = ctx.dom.querySelector(`meta[property="${prop}"]`);
      if (!el || !el.getAttribute('content')?.trim()) {
        missing.push(prop);
      }
    });

    if (missing.length === requiredOgTags.length) {
      issues.push(
        this.info(
          'no-open-graph',
          'No Open Graph tags found',
          'Open Graph tags control how this page appears when shared on social networks (Facebook, LinkedIn, etc.).',
          ctx.url,
          {
            fix: 'Add og:title, og:description, og:url, and og:image meta tags.',
            docs: 'https://ogp.me/',
          },
        ),
      );
    } else if (missing.length > 0) {
      issues.push(
        this.warning(
          'incomplete-open-graph',
          'Incomplete Open Graph tags',
          `Missing Open Graph tags: ${missing.join(', ')}.`,
          ctx.url,
          {
            value: missing.join(', '),
            fix: 'Add the missing Open Graph meta tags for complete social sharing support.',
          },
        ),
      );
    } else {
      issues.push(this.pass('open-graph-ok', 'Open Graph tags are complete', ctx.url));
    }

    return issues;
  }

  private checkTwitterCard(ctx: AnalyzerContext): Issue[] {
    const twitterCard = ctx.dom.querySelector('meta[name="twitter:card"]');

    if (!twitterCard) {
      return [
        this.info(
          'no-twitter-card',
          'No Twitter Card meta tag',
          'Twitter Card tags control how this page appears when shared on Twitter/X.',
          ctx.url,
          {
            fix: 'Add <meta name="twitter:card" content="summary_large_image"> and related tags.',
            docs: 'https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards',
          },
        ),
      ];
    }

    return [this.pass('twitter-card-ok', 'Twitter Card meta tag is present', ctx.url)];
  }
}
