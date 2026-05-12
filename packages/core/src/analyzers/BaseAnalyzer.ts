import type { Issue, AnalyzerName } from '../types/index.js';

/**
 * Context passed to each analyzer for a single page.
 */
export interface AnalyzerContext {
  /** The canonical URL of the page. */
  url: string;

  /** Raw HTML source of the page. */
  html: string;

  /** Parsed DOM document. */
  dom: Document;

  /** Response headers (lowercase keys). */
  headers: Record<string, string>;

  /** HTTP status code. */
  statusCode: number;

  /** Total load time in milliseconds. */
  loadTimeMs: number;

  /** Redirect chain (empty if no redirects). */
  redirectChain: string[];

  /** Internal links found on this page. */
  internalLinks: string[];
}

/**
 * Abstract base class for all SEO analyzers.
 * Each analyzer checks a specific aspect of the page and returns issues.
 *
 * Implementation rules:
 * - Never throw — catch internally and return an info issue if something fails
 * - Return `pass` severity issues for checks that succeed (for score calculation)
 * - All issues must have unique, stable `id` values
 */
export abstract class BaseAnalyzer {
  /** Unique name of this analyzer, matching AnalyzerName. */
  abstract readonly name: AnalyzerName;

  /**
   * Analyze the given page context and return a list of issues.
   * Both failures (error/warning) AND passes should be returned.
   */
  abstract analyze(ctx: AnalyzerContext): Promise<Issue[]>;

  /**
   * Build a pass issue — used to count passing checks in scoring.
   */
  protected pass(id: string, title: string, url: string): Issue {
    return {
      id,
      title,
      description: `${title} check passed.`,
      severity: 'pass',
      category: this.name,
      affectedUrl: url,
    };
  }

  /**
   * Build an error issue.
   */
  protected error(
    id: string,
    title: string,
    description: string,
    url: string,
    extras?: Partial<Issue>,
  ): Issue {
    return {
      id,
      title,
      description,
      severity: 'error',
      category: this.name,
      affectedUrl: url,
      ...extras,
    };
  }

  /**
   * Build a warning issue.
   */
  protected warning(
    id: string,
    title: string,
    description: string,
    url: string,
    extras?: Partial<Issue>,
  ): Issue {
    return {
      id,
      title,
      description,
      severity: 'warning',
      category: this.name,
      affectedUrl: url,
      ...extras,
    };
  }

  /**
   * Build an info issue.
   */
  protected info(
    id: string,
    title: string,
    description: string,
    url: string,
    extras?: Partial<Issue>,
  ): Issue {
    return {
      id,
      title,
      description,
      severity: 'info',
      category: this.name,
      affectedUrl: url,
      ...extras,
    };
  }
}
