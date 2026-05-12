import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import type { Issue } from '../types/index.js';

/**
 * Mobile-friendliness checks:
 * - Viewport meta tag
 * - Font size readability
 * - No user-scalable=no (accessibility)
 */
export class MobileAnalyzer extends BaseAnalyzer {
  readonly name = 'mobile' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    issues.push(...this.checkViewport(ctx));
    issues.push(...this.checkFontScaling(ctx));
    issues.push(...this.checkTapTargets(ctx));

    return issues;
  }

  private checkViewport(ctx: AnalyzerContext): Issue[] {
    const viewportMeta = ctx.dom.querySelector('meta[name="viewport"]');

    if (!viewportMeta) {
      return [
        this.error(
          'missing-viewport-meta',
          'Missing viewport meta tag',
          'No viewport meta tag found. Mobile browsers will render the page at desktop width, making it appear zoomed out.',
          ctx.url,
          {
            fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.',
            docs: 'https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing',
          },
        ),
      ];
    }

    const content = viewportMeta.getAttribute('content') ?? '';
    const issues: Issue[] = [];

    // Check for user-scalable=no — bad for accessibility
    if (content.includes('user-scalable=no') || content.includes('maximum-scale=1')) {
      issues.push(
        this.warning(
          'viewport-no-scaling',
          'Viewport prevents user zooming',
          'user-scalable=no or maximum-scale=1 prevents users from zooming. This is harmful for accessibility and may affect rankings.',
          ctx.url,
          {
            value: content,
            fix: 'Remove user-scalable=no and maximum-scale=1 from the viewport meta tag.',
          },
        ),
      );
    }

    if (!content.includes('width=device-width')) {
      issues.push(
        this.warning(
          'viewport-not-responsive',
          'Viewport not set to device width',
          `Viewport content "${content}" does not include width=device-width. The page may not scale correctly on mobile.`,
          ctx.url,
          {
            fix: 'Set content="width=device-width, initial-scale=1".',
          },
        ),
      );
    } else {
      issues.push(this.pass('viewport-ok', 'Viewport meta tag is configured correctly', ctx.url));
    }

    return issues;
  }

  private checkFontScaling(ctx: AnalyzerContext): Issue[] {
    // Check for text-size-adjust: none in inline styles (heuristic)
    const allElements = ctx.dom.querySelectorAll('[style]');
    let foundTextSizeAdjustNone = false;

    allElements.forEach((el) => {
      const style = el.getAttribute('style') ?? '';
      if (
        style.includes('text-size-adjust: none') ||
        style.includes('-webkit-text-size-adjust: none')
      ) {
        foundTextSizeAdjustNone = true;
      }
    });

    if (foundTextSizeAdjustNone) {
      return [
        this.warning(
          'text-size-adjust-none',
          'text-size-adjust: none detected',
          'Elements with text-size-adjust: none prevent browsers from scaling text on mobile devices.',
          ctx.url,
          { fix: 'Remove text-size-adjust: none from stylesheets.' },
        ),
      ];
    }

    return [this.pass('font-scaling-ok', 'No font scaling overrides detected', ctx.url)];
  }

  private checkTapTargets(ctx: AnalyzerContext): Issue[] {
    // Heuristic: count interactive elements with very small explicit dimensions
    const interactiveEls = ctx.dom.querySelectorAll('a, button, input, select, textarea');
    let smallTargets = 0;

    interactiveEls.forEach((el) => {
      const style = el.getAttribute('style') ?? '';
      // Look for explicit inline height/width < 24px
      const heightMatch = style.match(/height:\s*(\d+)px/);
      const widthMatch = style.match(/width:\s*(\d+)px/);

      if (heightMatch) {
        const h = parseInt(heightMatch[1] ?? '0', 10);
        if (h > 0 && h < 24) smallTargets++;
      } else if (widthMatch) {
        const w = parseInt(widthMatch[1] ?? '0', 10);
        if (w > 0 && w < 24) smallTargets++;
      }
    });

    if (smallTargets > 0) {
      return [
        this.warning(
          'small-tap-targets',
          'Small tap targets detected',
          `${smallTargets} interactive elements may be too small for comfortable tapping on mobile (< 24px).`,
          ctx.url,
          {
            value: smallTargets,
            expected: 0,
            fix: 'Ensure tap targets are at least 44×44px as recommended by Google.',
            docs: 'https://web.dev/tap-targets/',
          },
        ),
      ];
    }

    return [this.pass('tap-targets-ok', 'No obviously small tap targets detected', ctx.url)];
  }
}
