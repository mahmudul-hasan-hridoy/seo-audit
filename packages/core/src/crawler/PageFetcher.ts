import { fetch, Agent } from 'undici';
import { AuditorError } from '../errors.js';
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

const DEFAULT_USER_AGENT = 'seo-auditor/0.1.0 (https://github.com/your-org/seo-auditor)';

/**
 * Fetches pages via HTTP (undici) or Puppeteer when renderJs is enabled.
 * Lazy-loads Puppeteer to avoid hard dependency.
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
      maxRedirections: 5,
    });
  }

  /**
   * Fetch a single page and return its content.
   */
  async fetch(url: string): Promise<FetchedPage> {
    if (this.config.renderJs) {
      return this.fetchWithPuppeteer(url);
    }
    return this.fetchWithUndici(url);
  }

  /**
   * Clean up resources (close Puppeteer browser if open).
   */
  async dispose(): Promise<void> {
    if (this.puppeteerBrowser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.puppeteerBrowser as any).close();
      this.puppeteerBrowser = null;
    }
    this.agent.destroy();
  }

  private async fetchWithUndici(url: string): Promise<FetchedPage> {
    const start = Date.now();
    const redirectChain: string[] = [];
    let currentUrl = url;

    try {
      const response = await fetch(currentUrl, {
        headers: { 'User-Agent': this.config.userAgent || DEFAULT_USER_AGENT },
        dispatcher: this.agent,
        redirect: 'follow',
      });

      const loadTimeMs = Date.now() - start;
      const finalUrl = response.url || currentUrl;
      const html = await response.text();

      // Build redirect chain from response URL
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
      const message = err instanceof Error ? err.message : 'Unknown fetch error';
      if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
        throw new AuditorError(`Request timed out: ${url}`, 'TIMEOUT', url);
      }
      throw new AuditorError(`Fetch failed: ${message}`, 'FETCH_FAILED', url);
    }
  }

  private async fetchWithPuppeteer(url: string): Promise<FetchedPage> {
    const browser = await this.getPuppeteerBrowser();
    const start = Date.now();
    const redirectChain: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (browser as any).newPage();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).setUserAgent(this.config.userAgent || DEFAULT_USER_AGENT);

      let statusCode = 200;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      page.on('response', (response: any) => {
        if (response.url() === url) {
          statusCode = response.status() as number;
        }
        if (response.status() >= 300 && response.status() < 400) {
          redirectChain.push(response.url() as string);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      const finalUrl: string = (page as any).url();
      const html: string = await (page as any).content();
      const loadTimeMs = Date.now() - start;
      const headers: Record<string, string> = {};

      return {
        url,
        finalUrl,
        statusCode,
        headers,
        html,
        loadTimeMs,
        redirectChain,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Puppeteer error';
      throw new AuditorError(`Puppeteer fetch failed: ${message}`, 'FETCH_FAILED', url);
    } finally {
      await (page as any).close();
    }
  }

  private async getPuppeteerBrowser(): Promise<unknown> {
    if (this.puppeteerBrowser) return this.puppeteerBrowser;

    try {
      const puppeteer = await import('puppeteer');
      this.puppeteerBrowser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
