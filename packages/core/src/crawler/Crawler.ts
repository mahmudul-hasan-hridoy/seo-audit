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

interface RobotsChecker {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

/**
 * Orchestrates the full BFS crawl of a site.
 * Respects robots.txt (via robots-parser), depth limits, and concurrency.
 */
export class Crawler {
  private readonly config: ResolvedAuditConfig;
  private readonly fetcher: PageFetcher;
  /** Robots checker loaded once per crawl run. null = not yet loaded. */
  private robots: RobotsChecker | null = null;
  /**
   * Whether robots.txt was successfully loaded when `respectRobotsTxt` is true.
   * false = load was attempted but failed (surfaced as a warning via onProgress context).
   */
  private robotsLoadFailed = false;
  /** Pre-compiled ignore-pattern regexes (compiled once at construction, not per URL). */
  private readonly ignoreRegexes: RegExp[];

  constructor(config: ResolvedAuditConfig) {
    this.config = config;
    this.fetcher = new PageFetcher(config);
    this.ignoreRegexes = this.compileIgnorePatterns(config.ignorePatterns);
  }

  /**
   * Run the full crawl and return all successfully fetched pages.
   * If `respectRobotsTxt` is enabled and robots.txt cannot be loaded/parsed,
   * the error is emitted on the returned array's `robotsError` property so
   * callers can surface it as a warning without aborting the crawl.
   */
  async crawl(
    onProgress?: CrawlProgressCallback,
    onRobotsError?: (err: Error) => void,
  ): Promise<CrawledPage[]> {
    const rootUrl = new URL(this.config.url);

    if (this.config.respectRobotsTxt) {
      const robotsErr = await this.loadRobotsTxt(rootUrl.origin);
      if (robotsErr) {
        this.robotsLoadFailed = true;
        onRobotsError?.(robotsErr);
      }
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
            // NOT_HTML: silently discard — expected for sitemaps, robots.txt, PDFs, images, etc.
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

  /**
   * Load and parse robots.txt for the given origin.
   * Returns an Error if loading or parsing fails, null on success.
   * Failures are non-fatal but must be surfaced to the caller.
   */
  private async loadRobotsTxt(origin: string): Promise<Error | null> {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.config.userAgent },
      });
      if (!response.ok) {
        // 404 is perfectly normal — no robots.txt means no restrictions.
        if (response.status === 404) return null;
        return new Error(`robots.txt responded with HTTP ${response.status}`);
      }
      const text = await response.text();

      // Dynamically import robots-parser (CJS) to avoid ESM interop issues at module level.
      const mod = await import('robots-parser');
      // robots-parser ships as CJS: the callable is at .default (via esModuleInterop) or mod itself.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parser: (url: string, content: string) => RobotsChecker = (mod as any).default ?? mod;
      this.robots = parser(robotsUrl, text);
      return null;
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  }

  /**
   * Check whether a URL is disallowed by robots.txt.
   * If robots loading failed and respectRobotsTxt is true, we fail-open
   * (allow crawling) but the caller was already notified via onRobotsError.
   */
  private isDisallowed(url: string): boolean {
    if (!this.robots) return false;
    const allowed = this.robots.isAllowed(url, this.config.userAgent);
    // isAllowed returns undefined when no matching rule exists — treat as allowed
    return allowed === false;
  }

  // ─── Ignore patterns ─────────────────────────────────────────────────────────

  /**
   * Pre-compile ignore patterns to RegExp objects once at construction time.
   * Supports glob-style wildcards (*).
   */
  private compileIgnorePatterns(patterns: string[]): RegExp[] {
    const compiled: RegExp[] = [];
    for (const pattern of patterns) {
      try {
        const escaped = pattern.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&');
        const regexStr = escaped.replace(/\*/g, '.*');
        compiled.push(new RegExp(`^${regexStr}$`));
      } catch {
        // Invalid pattern — skip silently
      }
    }
    return compiled;
  }

  private isIgnored(url: string): boolean {
    for (const regex of this.ignoreRegexes) {
      if (regex.test(url)) return true;
    }
    return false;
  }
}
