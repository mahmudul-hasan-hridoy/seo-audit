/**
 * Names of all available analyzers.
 */
export type AnalyzerName =
  | 'onpage'
  | 'performance'
  | 'technical'
  | 'images'
  | 'links'
  | 'content'
  | 'mobile'
  | 'schema';

/**
 * Configuration options for an audit run.
 */
export interface AuditConfig {
  /** The root URL to audit. Must be an absolute URL with protocol. */
  url: string;

  /** Maximum number of pages to crawl. Default: 100 */
  maxPages?: number;

  /** Maximum crawl depth from root URL. Default: 3 */
  crawlDepth?: number;

  /** Number of pages to fetch concurrently. Default: 5 */
  concurrency?: number;

  /** Request timeout in milliseconds. Default: 10000 */
  timeout?: number;

  /** Whether to respect robots.txt crawl rules. Default: true */
  respectRobotsTxt?: boolean;

  /** Use Puppeteer for JS-rendered pages. Default: false */
  renderJs?: boolean;

  /** Custom user agent string. */
  userAgent?: string;

  /** URL patterns (glob-style) to exclude from crawling. */
  ignorePatterns?: string[];

  /** Subset of analyzers to run. Default: all */
  analyzers?: AnalyzerName[];
}

/**
 * Resolved config with all defaults applied.
 */
export interface ResolvedAuditConfig extends Required<AuditConfig> {
  url: string;
  maxPages: number;
  crawlDepth: number;
  concurrency: number;
  timeout: number;
  respectRobotsTxt: boolean;
  renderJs: boolean;
  userAgent: string;
  ignorePatterns: string[];
  analyzers: AnalyzerName[];
}

/**
 * Identity helper for type inference in seo-audit.config.ts files.
 */
export function defineConfig(config: AuditConfig): AuditConfig {
  return config;
}
