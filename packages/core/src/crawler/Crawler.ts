import pLimit from 'p-limit';
import { fetch } from 'undici';
import { parseHTML } from 'linkedom';
import { Queue } from './Queue.js';
import { PageFetcher } from './PageFetcher.js';
import { LinkExtractor } from './LinkExtractor.js';
import { isNonHtmlUrl } from './urlUtils.js';
import { AuditorError } from '../errors.js';
import type { ResolvedAuditConfig } from '../types/index.js';
import type { FetchedPage } from './PageFetcher.js';

export interface CrawledPage extends FetchedPage {
  dom: Document;
  internalLinks: string[];
  depth: number;
}

export type CrawlProgressCallback = (current: number, total: number, url: string) => void;

interface RobotsRule {
  pattern: string;
  allow: boolean;
}

/**
 * Orchestrates the full BFS crawl of a site.
 * Respects robots.txt (with Allow/Disallow + wildcard), concurrency limits,
 * and depth/page limits.
 */
export class Crawler {
  private readonly config: ResolvedAuditConfig;
  private readonly fetcher: PageFetcher;
  /** Ordered list of robots.txt rules (most-specific wins). */
  private robotsRules: RobotsRule[] = [];

  constructor(config: ResolvedAuditConfig) {
    this.config = config;
    this.fetcher = new PageFetcher(config);
  }

  /**
   * Run the full crawl and return all successfully fetched pages.
   */
  async crawl(onProgress?: CrawlProgressCallback): Promise<CrawledPage[]> {
    const rootUrl = new URL(this.config.url);

    if (this.config.respectRobotsTxt) {
      await this.loadRobotsTxt(rootUrl.origin);
    }

    const queue = new Queue(this.config.crawlDepth);
    queue.enqueue(this.config.url, 0);

    const limit = pLimit(this.config.concurrency);
    const results: CrawledPage[] = [];
    const linkExtractor = new LinkExtractor(this.config.url);
    let processed = 0;

    while (queue.hasMore && results.length < this.config.maxPages) {
      const batch: Array<Promise<void>> = [];

      while (queue.hasMore && results.length + batch.length < this.config.maxPages) {
        const item = queue.dequeue();
        if (!item) break;

        const { url, depth } = item;

        if (this.isIgnored(url)) continue;
        if (this.isDisallowed(url)) continue;
        // Belt-and-suspenders: skip non-HTML URLs that slipped past the Queue
        if (isNonHtmlUrl(url)) continue;

        const task = limit(async (): Promise<void> => {
          try {
            const fetched = await this.fetcher.fetch(url);
            const { document: dom } = parseHTML(fetched.html);

            const { internal } = linkExtractor.extract(dom as unknown as Document);
            const internalUrls = internal.map((l) => l.url);

            for (const link of internalUrls) {
              queue.enqueue(link, depth + 1);
            }

            const crawled: CrawledPage = {
              ...fetched,
              dom: dom as unknown as Document,
              internalLinks: internalUrls,
              depth,
            };

            results.push(crawled);
            processed++;
            onProgress?.(processed, Math.min(queue.totalSeen, this.config.maxPages), url);
          } catch (err) {
            // NOT_HTML: silently discard — this is expected for sitemap.xml, robots.txt,
            // PDFs, images, etc. Don't count them as processed audit pages.
            if (err instanceof AuditorError && err.code === 'NOT_HTML') {
              return;
            }
            // All other failures: non-fatal — skip and continue crawling.
            processed++;
            onProgress?.(processed, Math.min(queue.totalSeen, this.config.maxPages), url);
          }
        });

        batch.push(task);
      }

      await Promise.all(batch);
    }

    return results;
  }

  /**
   * Release all resources (Puppeteer browser, HTTP agents).
   */
  async dispose(): Promise<void> {
    await this.fetcher.dispose();
  }

  // ─── robots.txt ──────────────────────────────────────────────────────────────

  private async loadRobotsTxt(origin: string): Promise<void> {
    try {
      const response = await fetch(`${origin}/robots.txt`, {
        headers: { 'User-Agent': this.config.userAgent },
      });
      if (!response.ok) return;
      const text = await response.text();
      this.parseRobotsTxt(text);
    } catch {
      // robots.txt is optional — silently continue
    }
  }

  /**
   * Full-featured robots.txt parser:
   * - Targets User-agent: * and User-agent: seo-auditor
   * - Handles both Disallow: and Allow: directives
   * - Supports simple wildcard patterns (*)
   * - More-specific patterns take precedence (longer pattern wins)
   */
  private parseRobotsTxt(content: string): void {
    const rules: RobotsRule[] = [];
    let applicable = false;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.split('#')[0]?.trim() ?? '';
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const directive = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();

      if (directive === 'user-agent') {
        const agent = value.toLowerCase();
        applicable = agent === '*' || agent === 'seo-auditor';
        continue;
      }

      if (!applicable) continue;

      if (directive === 'disallow' && value) {
        rules.push({ pattern: value, allow: false });
      } else if (directive === 'allow' && value) {
        rules.push({ pattern: value, allow: true });
      }
    }

    // Sort by specificity: longer patterns take precedence
    this.robotsRules = rules.sort((a, b) => b.pattern.length - a.pattern.length);
  }

  /**
   * Check whether a URL is disallowed by robots.txt.
   * Allow directives override Disallow for the same path prefix.
   */
  private isDisallowed(url: string): boolean {
    if (this.robotsRules.length === 0) return false;

    try {
      const { pathname } = new URL(url);

      for (const rule of this.robotsRules) {
        if (this.matchesRobotsPattern(pathname, rule.pattern)) {
          return !rule.allow;
        }
      }
    } catch {
      return true;
    }

    return false;
  }

  /**
   * Matches a URL path against a robots.txt pattern.
   * Supports * wildcard and $ end-of-string anchor.
   */
  private matchesRobotsPattern(pathname: string, pattern: string): boolean {
    // Convert robots.txt pattern to regex
    const escaped = pattern
      .replace(/[.+?^{}()|[\]\\]/g, '\\$&') // escape special chars except * and $
      .replace(/\*/g, '.*'); // * → .*

    const anchor = escaped.endsWith('\\$') ? '' : '';
    const regexStr = `^${escaped.replace(/\\\$$/, '$')}`;

    try {
      return new RegExp(regexStr).test(pathname);
    } catch {
      // Fallback to plain prefix match
      return pathname.startsWith(pattern.replace(/\*.*/, ''));
    }
  }

  private isIgnored(url: string): boolean {
    for (const pattern of this.config.ignorePatterns) {
      // Support glob-style wildcards
      const escaped = pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&');
      const regexStr = escaped.replace(/\*/g, '.*');
      try {
        if (new RegExp(`^${regexStr}$`).test(url) || new RegExp(regexStr).test(url)) return true;
      } catch {
        // invalid pattern — skip
      }
    }
    return false;
  }
}
