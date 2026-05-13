import { fetch, Agent } from 'undici';
import { AuditorError } from '../errors.js';
import { isHtmlContentType } from './urlUtils.js';
import type { ResolvedAuditConfig } from '../types/index.js';

export interface FetchedPage {
  url: string;
  finalUrl: string; // After redirects
  statusCode: number;
  headers: Record<string, string>;
  html: string;
  loadTimeMs: number;
  redirectChain: string[];
}

const DEFAULT_USER_AGENT = 'seo-auditor/1.0.0 (https://github.com/mahmudul-hasan-hridoy/seo-audit)';
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1000, 2000];
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches pages via HTTP (undici) or Puppeteer when renderJs is enabled.
 * Includes automatic retry with exponential backoff for transient failures.
 */
export class PageFetcher {
  private readonly config: ResolvedAuditConfig;
  private readonly agent: Agent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private puppeteerBrowser: unknown = null;

  constructor(config: ResolvedAuditConfig) {
    this.config = config;
    this.agent = new Agent({
      connectTimeout: config.timeout,
      headersTimeout: config.timeout,
      bodyTimeout: config.timeout,
      maxRedirections: 10,
      keepAliveTimeout: 4000,
      keepAliveMaxTimeout: 10_000,
    });
  }

  /**
   * Fetch a single page with automatic retry on transient failures.
   */
  async fetch(url: string): Promise<FetchedPage> {
    if (this.config.renderJs) {
      return this.fetchWithPuppeteer(url);
    }
    return this.fetchWithRetry(url);
  }

  /**
   * Release all held resources (Puppeteer browser, HTTP agent).
   */
  async dispose(): Promise<void> {
    if (this.puppeteerBrowser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.puppeteerBrowser as any).close();
      this.puppeteerBrowser = null;
    }
    this.agent.destroy();
  }

  // ─── Retry wrapper ───────────────────────────────────────────────────────────

  private async fetchWithRetry(url: string): Promise<FetchedPage> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 2000;
        await sleep(delay);
      }

      try {
        const result = await this.fetchWithUndici(url);

        // Retry on known server-side transient errors
        if (RETRYABLE_STATUS_CODES.has(result.statusCode) && attempt < MAX_RETRIES) {
          lastError = new Error(`HTTP ${result.statusCode} — will retry`);
          continue;
        }

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof AuditorError) {
          // Non-retryable error codes — propagate immediately without retrying
          if (
            err.code === 'INVALID_URL' ||
            err.code === 'ROBOTS_BLOCKED' ||
            err.code === 'PUPPETEER_UNAVAILABLE' ||
            err.code === 'NOT_HTML'
          ) {
            throw err;
          }
          // TIMEOUT and FETCH_FAILED are retryable — fall through
        }

        if (attempt >= MAX_RETRIES) break;
      }
    }

    throw (
      lastError ??
      new AuditorError(`Fetch failed after ${MAX_RETRIES} retries: ${url}`, 'FETCH_FAILED', url)
    );
  }

  // ─── HTTP fetch via undici ────────────────────────────────────────────────────

  private async fetchWithUndici(url: string): Promise<FetchedPage> {
    const start = Date.now();
    const redirectChain: string[] = [];

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent || DEFAULT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
        },
        dispatcher: this.agent,
        redirect: 'follow',
      });

      const loadTimeMs = Date.now() - start;
      const finalUrl = response.url || url;

      // Check Content-Type BEFORE reading the body — skip non-HTML resources
      // (sitemaps, PDFs, images, scripts, fonts, etc.) without consuming bandwidth.
      const contentType = response.headers.get('content-type') ?? '';
      if (!isHtmlContentType(contentType)) {
        // Consume and discard the body to free the connection back to the pool
        await response.body?.cancel();
        throw new AuditorError(
          `Skipped non-HTML resource (Content-Type: ${contentType || 'unknown'})`,
          'NOT_HTML',
          url,
        );
      }

      const html = await response.text();

      if (finalUrl !== url) {
        redirectChain.push(url);
      }

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        url,
        finalUrl,
        statusCode: response.status,
        headers,
        html,
        loadTimeMs,
        redirectChain,
      };
    } catch (err) {
      // Re-throw AuditorErrors as-is (includes NOT_HTML, TIMEOUT, etc.)
      if (err instanceof AuditorError) throw err;

      const message = err instanceof Error ? err.message : 'Unknown fetch error';
      if (
        message.includes('timeout') ||
        message.includes('ETIMEDOUT') ||
        message.includes('UND_ERR_CONNECT_TIMEOUT') ||
        message.includes('UND_ERR_HEADERS_TIMEOUT') ||
        message.includes('UND_ERR_BODY_TIMEOUT')
      ) {
        throw new AuditorError(`Request timed out: ${url}`, 'TIMEOUT', url);
      }
      throw new AuditorError(`Fetch failed: ${message}`, 'FETCH_FAILED', url);
    }
  }

  // ─── Puppeteer fetch ──────────────────────────────────────────────────────────

  private async fetchWithPuppeteer(url: string): Promise<FetchedPage> {
    const browser = await this.getPuppeteerBrowser();
    const start = Date.now();
    const redirectChain: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (browser as any).newPage();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).setUserAgent(this.config.userAgent || DEFAULT_USER_AGENT);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).setViewport({ width: 1280, height: 800 });

      let statusCode = 200;
      const responseHeaders: Record<string, string> = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      page.on('response', (response: any) => {
        const respUrl = response.url() as string;
        const status = response.status() as number;

        if (respUrl === url) {
          statusCode = status;
          const hdrs = response.headers() as Record<string, string>;
          Object.assign(responseHeaders, hdrs);
        }
        if (status >= 300 && status < 400) {
          redirectChain.push(respUrl);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const finalUrl: string = (page as any).url();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html: string = await (page as any).content();
      const loadTimeMs = Date.now() - start;

      return {
        url,
        finalUrl,
        statusCode,
        headers: responseHeaders,
        html,
        loadTimeMs,
        redirectChain,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Puppeteer error';
      throw new AuditorError(`Puppeteer fetch failed: ${message}`, 'FETCH_FAILED', url);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).close();
    }
  }

  private async getPuppeteerBrowser(): Promise<unknown> {
    if (this.puppeteerBrowser) return this.puppeteerBrowser;

    try {
      const puppeteer = await import('puppeteer');
      this.puppeteerBrowser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      return this.puppeteerBrowser;
    } catch {
      throw new AuditorError(
        'Puppeteer is not installed. Run: npm install puppeteer',
        'PUPPETEER_UNAVAILABLE',
      );
    }
  }
}
