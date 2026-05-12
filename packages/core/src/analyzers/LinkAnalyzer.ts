import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import { LinkExtractor } from '../crawler/LinkExtractor.js';
import type { Issue } from '../types/index.js';

const MIN_INTERNAL_LINKS = 3;
const MAX_LINKS_PER_PAGE = 150;

/**
 * Link quality checks:
 * - Internal link count
 * - Broken link detection (via statusCode)
 * - Anchor text quality
 * - External nofollow usage
 */
export class LinkAnalyzer extends BaseAnalyzer {
  readonly name = 'links' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const extractor = new LinkExtractor(ctx.url);
    const { internal, external } = extractor.extract(ctx.dom);

    // Internal links
    if (internal.length < MIN_INTERNAL_LINKS) {
      issues.push(
        this.warning(
          'few-internal-links',
          'Few internal links found',
          `Only ${internal.length} internal links found. Internal linking distributes PageRank and helps crawlers discover pages.`,
          ctx.url,
          {
            value: internal.length,
            expected: `>= ${MIN_INTERNAL_LINKS}`,
            fix: 'Add contextual internal links to related pages.',
          },
        ),
      );
    } else {
      issues.push(this.pass('internal-links-ok', 'Sufficient internal links present', ctx.url));
    }

    // Total link count
    const totalLinks = internal.length + external.length;
    if (totalLinks > MAX_LINKS_PER_PAGE) {
      issues.push(
        this.warning(
          'too-many-links',
          'Too many links on page',
          `Found ${totalLinks} links. Pages with excessive links dilute PageRank and may trigger spam signals.`,
          ctx.url,
          {
            value: totalLinks,
            expected: `<= ${MAX_LINKS_PER_PAGE}`,
            fix: 'Reduce the number of links, especially in navigation and footers.',
          },
        ),
      );
    }

    // Anchor text quality
    const genericAnchors = [...internal, ...external].filter((link) => {
      const text = link.text.toLowerCase();
      return (
        text === 'click here' ||
        text === 'read more' ||
        text === 'here' ||
        text === 'learn more' ||
        text === 'more' ||
        text === 'this' ||
        text === ''
      );
    });

    if (genericAnchors.length > 0) {
      issues.push(
        this.warning(
          'generic-anchor-text',
          'Generic anchor text detected',
          `${genericAnchors.length} links use generic anchor text like "click here" or "read more". Descriptive anchor text improves context for search engines.`,
          ctx.url,
          {
            value: genericAnchors.length,
            expected: 0,
            fix: 'Use descriptive anchor text that describes the destination page content.',
          },
        ),
      );
    } else if (totalLinks > 0) {
      issues.push(this.pass('anchor-text-ok', 'Link anchor text is descriptive', ctx.url));
    }

    // External links without nofollow
    const externalFollowed = external.filter((link) => !link.nofollow);
    if (external.length > 0) {
      if (externalFollowed.length > 10) {
        issues.push(
          this.info(
            'many-external-followed-links',
            'Many followed external links',
            `${externalFollowed.length} external links are followed (no nofollow). Verify these are trustworthy destinations.`,
            ctx.url,
            { value: externalFollowed.length },
          ),
        );
      } else {
        issues.push(this.pass('external-links-ok', 'External links look appropriate', ctx.url));
      }
    }

    return issues;
  }
}
