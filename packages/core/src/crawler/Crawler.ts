import pLimit from 'p-limit';
import { fetch } from 'undici';
import { parseHTML } from 'linkedom';
import { Queue } from './Queue.js';
import { PageFetcher } from './PageFetcher.js';
import { LinkExtractor } from './LinkExtractor.js';
import type { ResolvedAuditConfig } from '../types/index.js';
import type { FetchedPage } from './PageFetcher.js';

export interface CrawledPage extends FetchedPage {
  dom: Document;
  internalLinks: string[];
  depth: number;
}

export type CrawlProgressCallback = (current: number, total: number, url: string) => void;

/**
 * Orchestrates the full BFS crawl of a site.
 * Respects robots.txt, concurrency limits, and depth/page limits.
 */
export class Crawler {
  private readonly config: ResolvedAuditConfig;
  private readonly fetcher: PageFetcher;
  private disallowedPaths = new Set<string>();

  constructor(config: ResolvedAuditConfig) {
    this.config = config;
    this.fetcher = new PageFetcher(config);
  }

  /**
   * Run the full crawl and return all crawled pages.
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
      // Drain as many concurrent tasks as the limit allows
      const batch: Array<Promise<void>> = [];

      while (queue.hasMore && results.length + batch.length < this.config.maxPages) {
        const item = queue.dequeue();
        if (!item) break;

        const { url, depth } = item;

        if (this.isIgnored(url)) continue;
        if (this.isDisallowed(url)) continue;

        const task = limit(async (): Promise<void> => {
          try {
            const fetched = await this.fetcher.fetch(url);
            const { document: dom } = parseHTML(fetched.html);

            const { internal } = linkExtractor.extract(dom as unknown as Document);
            const internalUrls = internal.map((l) => l.url);

            // Enqueue discovered internal links
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
          } catch {
            // Non-fatal: skip failed pages, they get reported as issues
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

  /**
   * Fetch and parse robots.txt to extract disallowed paths.
   */
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
   * Naive robots.txt parser targeting the audit bot's user agent and *.
   */
  private parseRobotsTxt(content: string): void {
    const lines = content.split('\n');
    let applicable = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.startsWith('User-agent:')) {
        const agent = line.slice('User-agent:'.length).trim().toLowerCase();
        applicable = agent === '*' || agent === 'seo-auditor';
      }

      if (applicable && line.startsWith('Disallow:')) {
        const path = line.slice('Disallow:'.length).trim();
        if (path) this.disallowedPaths.add(path);
      }
    }
  }

  private isDisallowed(url: string): boolean {
    try {
      const { pathname } = new URL(url);
      for (const pattern of this.disallowedPaths) {
        if (pathname.startsWith(pattern)) return true;
      }
    } catch {
      return true;
    }
    return false;
  }

  private isIgnored(url: string): boolean {
    for (const pattern of this.config.ignorePatterns) {
      // Simple glob: support trailing * wildcard
      const escaped = pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&');
      const regexStr = escaped.replace(/\*/g, '.*');
      try {
        if (new RegExp(regexStr).test(url)) return true;
      } catch {
        // invalid pattern — skip
      }
    }
    return false;
  }
}
