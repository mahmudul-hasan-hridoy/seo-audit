/**
 * BFS URL queue for the crawler.
 * Tracks visited URLs and queued URLs separately to avoid revisits.
 */
export class Queue {
  private readonly pending: Array<{ url: string; depth: number }> = [];
  private readonly visited = new Set<string>();
  private readonly maxDepth: number;

  constructor(maxDepth: number) {
    this.maxDepth = maxDepth;
  }

  /**
   * Enqueue a URL if it hasn't been visited and is within depth limit.
   */
  enqueue(url: string, depth: number): void {
    const normalized = this.normalize(url);
    if (!normalized) return;
    if (this.visited.has(normalized)) return;
    if (depth > this.maxDepth) return;

    this.visited.add(normalized);
    this.pending.push({ url: normalized, depth });
  }

  /**
   * Dequeue the next URL to crawl.
   */
  dequeue(): { url: string; depth: number } | undefined {
    return this.pending.shift();
  }

  /**
   * Whether the queue has pending URLs.
   */
  get hasMore(): boolean {
    return this.pending.length > 0;
  }

  /**
   * Total number of unique URLs seen (visited + queued).
   */
  get totalSeen(): number {
    return this.visited.size;
  }

  /**
   * Number of URLs currently waiting to be crawled.
   */
  get pendingCount(): number {
    return this.pending.length;
  }

  /**
   * Check whether a URL has already been visited.
   */
  hasVisited(url: string): boolean {
    const normalized = this.normalize(url);
    return normalized ? this.visited.has(normalized) : true;
  }

  /**
   * Normalize a URL by removing trailing slash and hash fragments.
   */
  private normalize(url: string): string | null {
    try {
      const parsed = new URL(url);
      // Remove hash — crawl canonical paths only
      parsed.hash = '';
      // Normalize trailing slash: keep root '/', strip others
      if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }
}
