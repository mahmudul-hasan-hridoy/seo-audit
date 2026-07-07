import { EventEmitter } from 'node:events';
import pLimit from 'p-limit';
import { Crawler } from './crawler/Crawler.js';
import { OnPageAnalyzer } from './analyzers/OnPageAnalyzer.js';
import { TechnicalAnalyzer } from './analyzers/TechnicalAnalyzer.js';
import { PerformanceAnalyzer } from './analyzers/PerformanceAnalyzer.js';
import { ImageAnalyzer } from './analyzers/ImageAnalyzer.js';
import { LinkAnalyzer } from './analyzers/LinkAnalyzer.js';
import { ContentAnalyzer } from './analyzers/ContentAnalyzer.js';
import { MobileAnalyzer } from './analyzers/MobileAnalyzer.js';
import { SchemaAnalyzer } from './analyzers/SchemaAnalyzer.js';
import { ScoreEngine } from './scoring/ScoreEngine.js';
import { AuditorError } from './errors.js';
import type { BaseAnalyzer, AnalyzerContext } from './analyzers/BaseAnalyzer.js';
import type { AuditConfig, ResolvedAuditConfig, AnalyzerName, AuditReport } from './types/index.js';
import type { PageAudit } from './types/audit.types.js';
import type { CrawledPage } from './crawler/Crawler.js';

const ALL_ANALYZERS: AnalyzerName[] = [
  'onpage',
  'technical',
  'performance',
  'images',
  'links',
  'content',
  'mobile',
  'schema',
];

const DEFAULT_USER_AGENT =
  'seo-auditor/1.0.0 (+https://github.com/mahmudul-hasan-hridoy/seo-audit)';

/**
 * Events emitted by the Auditor during a run.
 */
export interface AuditorEvents {
  'crawl:start': () => void;
  'crawl:done': (totalPages: number) => void;
  progress: (current: number, total: number) => void;
  'page:audited': (page: PageAudit) => void;
  error: (err: Error, url?: string) => void;
}

/**
 * Main entry point for seo-auditor.
 *
 * @example
 * ```ts
 * const auditor = new Auditor({ url: 'https://mysite.com', maxPages: 50 });
 * auditor.on('page:audited', page => console.log(page.url, page.score));
 * const report = await auditor.run();
 * ```
 */
export class Auditor extends EventEmitter {
  private readonly config: ResolvedAuditConfig;
  private readonly analyzers: BaseAnalyzer[];
  private readonly scoreEngine = new ScoreEngine();

  constructor(config: AuditConfig) {
    super();
    this.config = this.resolveConfig(config);
    this.analyzers = this.buildAnalyzers(this.config.analyzers);
  }

  /**
   * Run the full site audit and return the aggregated report.
   */
  async run(): Promise<AuditReport> {
    const startedAt = new Date();
    const startMs = Date.now();

    this.validateConfig();
    this.emit('crawl:start');

    const crawler = new Crawler(this.config);

    let crawledPages: CrawledPage[] = [];

    try {
      crawledPages = await crawler.crawl(
        (current, total) => {
          this.emit('progress', current, total);
        },
        (err) => {
          // robots.txt load/parse failure — surfaced as a non-fatal error event
          this.emit(
            'error',
            new Error(`robots.txt could not be loaded: ${err.message}. Crawling without restrictions.`),
          );
        },
      );
    } finally {
      await crawler.dispose();
    }

    this.emit('crawl:done', crawledPages.length);

    // Analyze pages in parallel (bounded by the configured concurrency).
    const limit = pLimit(this.config.concurrency);

    const pageAudits = (
      await Promise.all(
        crawledPages.map((crawled) =>
          limit(async (): Promise<PageAudit | null> => {
            try {
              const pageAudit = await this.auditPage(crawled);
              this.emit('page:audited', pageAudit);
              return pageAudit;
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              this.emit('error', error, crawled.url);
              return null;
            }
          }),
        ),
      )
    ).filter((p): p is PageAudit => p !== null);

    // Build report
    const siteScore = this.scoreEngine.computeSiteScore(pageAudits);
    const report: AuditReport = {
      siteUrl: this.config.url,
      totalPages: pageAudits.length,
      siteScore,
      grade: this.scoreEngine.scoreToGrade(siteScore),
      summary: this.scoreEngine.aggregateSummary(pageAudits),
      pages: pageAudits,
      topIssues: this.scoreEngine.topIssues(pageAudits, 10),
      auditedAt: startedAt,
      durationMs: Date.now() - startMs,
    };

    return report;
  }

  /**
   * Audit a single crawled page through all configured analyzers.
   */
  private async auditPage(crawled: CrawledPage): Promise<PageAudit> {
    const ctx: AnalyzerContext = {
      url: crawled.finalUrl,
      html: crawled.html,
      dom: crawled.dom,
      headers: crawled.headers,
      statusCode: crawled.statusCode,
      loadTimeMs: crawled.loadTimeMs,
      redirectChain: crawled.redirectChain,
      internalLinks: crawled.internalLinks,
    };

    // Run all analyzers in parallel
    const issueArrays = await Promise.all(
      this.analyzers.map((analyzer) =>
        analyzer.analyze(ctx).catch((err) => {
          const error = err instanceof Error ? err : new Error(String(err));
          this.emit('error', error, crawled.url);
          return [];
        }),
      ),
    );

    const issues = issueArrays.flat();
    const score = this.scoreEngine.computePageScore(issues);

    return {
      url: crawled.finalUrl,
      statusCode: crawled.statusCode,
      loadTimeMs: crawled.loadTimeMs,
      issues,
      score,
      grade: this.scoreEngine.scoreToGrade(score),
      auditedAt: new Date(),
    };
  }

  private resolveConfig(config: AuditConfig): ResolvedAuditConfig {
    return {
      url: config.url,
      maxPages: config.maxPages ?? 100,
      crawlDepth: config.crawlDepth ?? 3,
      concurrency: config.concurrency ?? 5,
      timeout: config.timeout ?? 10_000,
      respectRobotsTxt: config.respectRobotsTxt ?? true,
      renderJs: config.renderJs ?? false,
      userAgent: config.userAgent ?? DEFAULT_USER_AGENT,
      ignorePatterns: config.ignorePatterns ?? [],
      analyzers: config.analyzers ?? ALL_ANALYZERS,
    };
  }

  private validateConfig(): void {
    // URL validation
    if (!this.config.url || typeof this.config.url !== 'string') {
      throw new AuditorError('URL must be a non-empty string.', 'INVALID_URL');
    }
    try {
      new URL(this.config.url);
    } catch {
      throw new AuditorError(
        `Invalid URL: "${this.config.url}". Must be an absolute URL with protocol.`,
        'INVALID_URL',
        this.config.url,
      );
    }
    if (!this.config.url.startsWith('http')) {
      throw new AuditorError(
        `URL must start with http:// or https://`,
        'INVALID_URL',
        this.config.url,
      );
    }

    // Numeric range guards — protects p-limit and crawl loops from bad values.
    const { concurrency, maxPages, crawlDepth, timeout } = this.config;

    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) {
      throw new AuditorError(
        `concurrency must be an integer between 1 and 50 (got ${concurrency}).`,
        'CONFIG_INVALID',
      );
    }
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100_000) {
      throw new AuditorError(
        `maxPages must be an integer between 1 and 100,000 (got ${maxPages}).`,
        'CONFIG_INVALID',
      );
    }
    if (!Number.isInteger(crawlDepth) || crawlDepth < 0 || crawlDepth > 20) {
      throw new AuditorError(
        `crawlDepth must be an integer between 0 and 20 (got ${crawlDepth}).`,
        'CONFIG_INVALID',
      );
    }
    if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 120_000) {
      throw new AuditorError(
        `timeout must be between 1,000ms and 120,000ms (got ${timeout}).`,
        'CONFIG_INVALID',
      );
    }
  }

  private buildAnalyzers(names: AnalyzerName[]): BaseAnalyzer[] {
    const registry: Record<AnalyzerName, () => BaseAnalyzer> = {
      onpage: () => new OnPageAnalyzer(),
      technical: () => new TechnicalAnalyzer(),
      performance: () => new PerformanceAnalyzer(),
      images: () => new ImageAnalyzer(),
      links: () => new LinkAnalyzer(),
      content: () => new ContentAnalyzer(),
      mobile: () => new MobileAnalyzer(),
      schema: () => new SchemaAnalyzer(),
    };

    return names.map((name) => {
      const factory = registry[name];
      if (!factory) {
        throw new AuditorError(`Unknown analyzer: "${name}"`, 'CONFIG_INVALID');
      }
      return factory();
    });
  }

  // Type-safe event overrides
  on<K extends keyof AuditorEvents>(event: K, listener: AuditorEvents[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof AuditorEvents>(event: K, ...args: Parameters<AuditorEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
