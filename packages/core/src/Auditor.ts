import { EventEmitter } from 'node:events';
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

const DEFAULT_USER_AGENT = 'seo-auditor/0.1.0 (+https://github.com/mahmudul-hasan-hridoy/seo-audit)';

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
      crawledPages = await crawler.crawl((current, total) => {
        this.emit('progress', current, total);
      });
    } finally {
      await crawler.dispose();
    }

    this.emit('crawl:done', crawledPages.length);

    // Analyze each page
    const pageAudits: PageAudit[] = [];

    for (const crawled of crawledPages) {
      try {
        const pageAudit = await this.auditPage(crawled);
        pageAudits.push(pageAudit);
        this.emit('page:audited', pageAudit);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.emit('error', error, crawled.url);
      }
    }

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
