import { isNonHtmlUrl } from './urlUtils.js';

/**
 * Extracts and classifies links from a parsed document.
 * Non-HTML hrefs (images, PDFs, scripts, sitemaps, etc.) are filtered
 * out so only crawlable HTML pages are returned as internal links.
 */
export class LinkExtractor {
  private readonly baseUrl: string;
  private readonly origin: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    const parsed = new URL(baseUrl);
    this.origin = parsed.origin;
  }

  /**
   * Extract all href links from anchor tags in the document.
   * Returns separate arrays for internal and external links.
   */
  extract(dom: Document): ExtractedLinks {
    const anchors = dom.querySelectorAll('a[href]');
    const internal: LinkInfo[] = [];
    const external: LinkInfo[] = [];
    const seen = new Set<string>();

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href) return;

      const resolved = this.resolve(href);
      if (!resolved) return;
      if (seen.has(resolved.url)) return;
      // Skip non-HTML resources — they are assets, not pages
      if (resolved.isInternal && isNonHtmlUrl(resolved.url)) return;
      seen.add(resolved.url);

      const relAttr = anchor.getAttribute('rel') ?? undefined;
      const info: LinkInfo = {
        url: resolved.url,
        text: (anchor.textContent ?? '').trim().slice(0, 200),
        ...(relAttr !== undefined ? { rel: relAttr } : {}),
        nofollow: (anchor.getAttribute('rel') ?? '').includes('nofollow'),
      };

      if (resolved.isInternal) {
        internal.push(info);
      } else {
        external.push(info);
      }
    });

    return { internal, external };
  }

  /**
   * Resolve an href to an absolute URL.
   * Returns null for non-HTTP URLs (mailto:, tel:, javascript:, #).
   */
  private resolve(href: string): { url: string; isInternal: boolean } | null {
    const trimmed = href.trim();

    // Skip fragments-only, javascript:, mailto:, tel:, data:
    if (
      trimmed.startsWith('#') ||
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('data:')
    ) {
      return null;
    }

    try {
      const resolved = new URL(trimmed, this.baseUrl);

      // Only follow http/https
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        return null;
      }

      const isInternal = resolved.origin === this.origin;
      return { url: resolved.href, isInternal };
    } catch {
      return null;
    }
  }
}

export interface LinkInfo {
  url: string;
  text: string;
  rel?: string;
  nofollow: boolean;
}

export interface ExtractedLinks {
  internal: LinkInfo[];
  external: LinkInfo[];
}
