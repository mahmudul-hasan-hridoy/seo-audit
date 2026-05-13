/**
 * Shared URL classification utilities for the crawler.
 */

/**
 * File extensions that are never HTML pages and should never be crawled
 * or graded as content pages.
 *
 * This is the single source-of-truth used by both the Queue (pre-fetch
 * filtering) and PageFetcher (post-fetch Content-Type check).
 */
const NON_HTML_EXTENSIONS = new Set([
  // Structured data / feeds
  'xml', 'rss', 'atom', 'json', 'jsonld',
  // Plain text / configs
  'txt', 'md', 'csv', 'yaml', 'yml', 'toml', 'ini', 'env',
  // Documents
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'ods', 'odp',
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'svg', 'ico', 'webp', 'avif', 'bmp', 'tiff', 'tif',
  // Fonts
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  // Scripts / styles
  'css', 'js', 'mjs', 'cjs', 'ts', 'map',
  // Archives
  'zip', 'gz', 'tar', 'bz2', '7z', 'rar',
  // Audio / video
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'avi', 'mov', 'flac', 'aac',
  // Binary / misc
  'wasm', 'exe', 'dmg', 'apk', 'bin',
]);

/**
 * Returns true if the URL's path extension indicates a non-HTML resource.
 * Query strings and hashes are ignored for this check.
 *
 * Examples that return true:
 *   https://example.com/sitemap.xml       → true
 *   https://example.com/llms.txt          → true
 *   https://example.com/robots.txt        → true
 *   https://example.com/logo.png          → true
 *   https://example.com/feed.rss          → true
 *   https://example.com/resume.pdf        → true
 *   https://example.com/app.js            → true
 *
 * Examples that return false (should be crawled):
 *   https://example.com/                  → false
 *   https://example.com/about             → false
 *   https://example.com/blog/post-1       → false
 *   https://example.com/page.html         → false  (explicit html is fine)
 *   https://example.com/page.htm          → false
 *   https://example.com/page.xhtml        → false
 *   https://example.com/api/data.json.bak → true   (last extension wins)
 */
export function isNonHtmlUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop() ?? '';
    const dotIdx = lastSegment.lastIndexOf('.');
    if (dotIdx === -1) return false; // No extension — assume HTML
    const ext = lastSegment.slice(dotIdx + 1).toLowerCase();
    // Explicit HTML extensions are always fine
    if (ext === 'html' || ext === 'htm' || ext === 'xhtml' || ext === 'asp' || ext === 'aspx' || ext === 'php') return false;
    return NON_HTML_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

/**
 * Returns true if a Content-Type header value indicates an HTML response.
 * Handles multi-value headers such as "text/html; charset=utf-8".
 */
export function isHtmlContentType(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return lower.includes('text/html') || lower.includes('application/xhtml+xml');
}
