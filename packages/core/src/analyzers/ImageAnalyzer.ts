import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import type { Issue } from '../types/index.js';

/**
 * Image SEO and performance checks:
 * - Alt attribute presence
 * - Lazy loading
 * - Next-gen format hints
 * - Explicit width/height to prevent CLS
 */
export class ImageAnalyzer extends BaseAnalyzer {
  readonly name = 'images' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];
    const images = Array.from(ctx.dom.querySelectorAll('img'));

    if (images.length === 0) {
      issues.push(this.pass('no-images', 'No images found on page', ctx.url));
      return issues;
    }

    const missingAlt: string[] = [];
    const missingDimensions: string[] = [];
    const missingLazy: number[] = [];
    let nextGenCount = 0;
    const totalImages = images.length; // was incorrectly `let` — never re-assigned

    images.forEach((img, index) => {
      const src = img.getAttribute('src') ?? '';
      const alt = img.getAttribute('alt');
      const width = img.getAttribute('width');
      const height = img.getAttribute('height');
      const loading = img.getAttribute('loading');
      const srcset = img.getAttribute('srcset') ?? '';

      // Alt text check
      if (alt === null) {
        missingAlt.push(src || `image[${index}]`);
      }

      // Dimensions check (prevents CLS)
      if (!width || !height) {
        missingDimensions.push(src || `image[${index}]`);
      }

      // Lazy loading check (skip above-the-fold heuristic — flag all without loading="lazy")
      if (loading !== 'lazy') {
        missingLazy.push(index);
      }

      // Next-gen format detection
      const isNextGen =
        src.includes('.webp') ||
        src.includes('.avif') ||
        srcset.includes('.webp') ||
        srcset.includes('.avif');
      if (isNextGen) nextGenCount++;
    });

    // Alt text issues
    if (missingAlt.length > 0) {
      issues.push(
        this.error(
          'images-missing-alt',
          'Images missing alt text',
          `${missingAlt.length} of ${totalImages} images are missing alt attributes. Alt text is critical for accessibility and image SEO.`,
          ctx.url,
          {
            value: missingAlt.length,
            expected: 0,
            fix: 'Add descriptive alt attributes to all content images. Use alt="" for decorative images.',
            docs: 'https://developers.google.com/search/docs/appearance/google-images#descriptive-alt-text',
          },
        ),
      );
    } else {
      issues.push(this.pass('images-alt-ok', 'All images have alt attributes', ctx.url));
    }

    // Dimensions issues (CLS prevention)
    if (missingDimensions.length > 0) {
      issues.push(
        this.warning(
          'images-missing-dimensions',
          'Images missing width/height attributes',
          `${missingDimensions.length} images are missing explicit width and height attributes. This can cause Cumulative Layout Shift (CLS).`,
          ctx.url,
          {
            value: missingDimensions.length,
            expected: 0,
            fix: 'Add width and height attributes matching the intrinsic image dimensions.',
            docs: 'https://web.dev/optimize-cls/',
          },
        ),
      );
    } else {
      issues.push(
        this.pass('images-dimensions-ok', 'All images have explicit dimensions', ctx.url),
      );
    }

    // Lazy loading
    const lazyRatio = (totalImages - missingLazy.length) / totalImages;
    if (lazyRatio < 0.5 && totalImages > 2) {
      issues.push(
        this.warning(
          'images-not-lazy-loaded',
          'Most images are not lazy loaded',
          `Only ${totalImages - missingLazy.length} of ${totalImages} images use loading="lazy". Lazy loading defers off-screen images and improves LCP.`,
          ctx.url,
          {
            value: missingLazy.length,
            fix: 'Add loading="lazy" to all images below the fold.',
            docs: 'https://web.dev/lazy-loading-images/',
          },
        ),
      );
    } else if (totalImages > 0) {
      issues.push(this.pass('images-lazy-loaded', 'Images use lazy loading', ctx.url));
    }

    // Next-gen formats
    const nextGenRatio = nextGenCount / totalImages;
    if (nextGenRatio < 0.5 && totalImages > 0) {
      issues.push(
        this.info(
          'images-not-next-gen',
          'Images are not in next-gen formats',
          `Only ${nextGenCount} of ${totalImages} images use WebP or AVIF formats. These can be 25–50% smaller than JPEG/PNG.`,
          ctx.url,
          {
            fix: 'Convert images to WebP or AVIF, or use a CDN that serves modern formats automatically.',
            docs: 'https://web.dev/uses-webp-images/',
          },
        ),
      );
    } else if (nextGenRatio >= 0.5) {
      issues.push(this.pass('images-next-gen', 'Images use next-gen formats', ctx.url));
    }

    return issues;
  }
}
