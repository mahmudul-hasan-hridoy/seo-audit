import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import type { Issue } from '../types/index.js';

const TITLE_MIN = 10;
const TITLE_MAX = 60;
const META_DESC_MIN = 120;
const META_DESC_MAX = 160;

/**
 * Checks on-page SEO fundamentals:
 * - Title tag presence, length, uniqueness
 * - Meta description presence and length
 * - H1 presence and uniqueness
 * - Heading hierarchy
 */
export class OnPageAnalyzer extends BaseAnalyzer {
  readonly name = 'onpage' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    issues.push(...this.checkTitle(ctx));
    issues.push(...this.checkMetaDescription(ctx));
    issues.push(...this.checkHeadings(ctx));
    issues.push(...this.checkLang(ctx));

    return issues;
  }

  private checkTitle(ctx: AnalyzerContext): Issue[] {
    const issues: Issue[] = [];
    const titleEl = ctx.dom.querySelector('title');

    if (!titleEl) {
      issues.push(
        this.error(
          'missing-title-tag',
          'Missing title tag',
          'The page has no <title> tag. Search engines use this as the primary clickable text in results.',
          ctx.url,
          {
            fix: 'Add a descriptive <title> tag between 50–60 characters.',
            docs: 'https://developers.google.com/search/docs/appearance/title-link',
          },
        ),
      );
      return issues;
    }

    const title = titleEl.textContent?.trim() ?? '';

    if (!title) {
      issues.push(
        this.error(
          'empty-title-tag',
          'Empty title tag',
          'The <title> tag exists but is empty.',
          ctx.url,
          {
            fix: 'Provide meaningful, keyword-rich title text.',
          },
        ),
      );
      return issues;
    }

    const len = title.length;

    if (len < TITLE_MIN) {
      issues.push(
        this.warning(
          'title-too-short',
          'Title tag too short',
          `Title is ${len} characters. Titles under ${TITLE_MIN} characters are too brief to be descriptive.`,
          ctx.url,
          {
            value: len,
            expected: `${TITLE_MIN}–${TITLE_MAX}`,
            fix: 'Expand the title to 50–60 characters.',
          },
        ),
      );
    } else if (len > TITLE_MAX) {
      issues.push(
        this.warning(
          'title-too-long',
          'Title tag too long',
          `Title is ${len} characters. Titles over ${TITLE_MAX} characters are truncated in search results.`,
          ctx.url,
          {
            value: len,
            expected: `${TITLE_MIN}–${TITLE_MAX}`,
            fix: 'Shorten the title to under 60 characters.',
          },
        ),
      );
    } else {
      issues.push(this.pass('title-length-ok', 'Title tag length is optimal', ctx.url));
    }

    issues.push(this.pass('title-tag-present', 'Title tag is present', ctx.url));
    return issues;
  }

  private checkMetaDescription(ctx: AnalyzerContext): Issue[] {
    const issues: Issue[] = [];
    const metaEl = ctx.dom.querySelector('meta[name="description"]');

    if (!metaEl) {
      issues.push(
        this.warning(
          'missing-meta-description',
          'Missing meta description',
          'No meta description found. Search engines may auto-generate a snippet, often poorly.',
          ctx.url,
          {
            fix: 'Add <meta name="description" content="..."> with 120–160 characters.',
            docs: 'https://developers.google.com/search/docs/appearance/snippet',
          },
        ),
      );
      return issues;
    }

    const content = metaEl.getAttribute('content')?.trim() ?? '';
    const len = content.length;

    if (!content) {
      issues.push(
        this.warning(
          'empty-meta-description',
          'Empty meta description',
          'Meta description tag exists but has no content.',
          ctx.url,
          {
            fix: 'Add descriptive content to the meta description.',
          },
        ),
      );
      return issues;
    }

    if (len < META_DESC_MIN) {
      issues.push(
        this.warning(
          'meta-description-too-short',
          'Meta description too short',
          `Meta description is ${len} characters. Aim for ${META_DESC_MIN}–${META_DESC_MAX}.`,
          ctx.url,
          { value: len, expected: `${META_DESC_MIN}–${META_DESC_MAX}` },
        ),
      );
    } else if (len > META_DESC_MAX) {
      issues.push(
        this.warning(
          'meta-description-too-long',
          'Meta description too long',
          `Meta description is ${len} characters and will be truncated in search results.`,
          ctx.url,
          {
            value: len,
            expected: `${META_DESC_MIN}–${META_DESC_MAX}`,
            fix: 'Trim to under 160 characters.',
          },
        ),
      );
    } else {
      issues.push(
        this.pass('meta-description-length-ok', 'Meta description length is optimal', ctx.url),
      );
    }

    issues.push(this.pass('meta-description-present', 'Meta description is present', ctx.url));
    return issues;
  }

  private checkHeadings(ctx: AnalyzerContext): Issue[] {
    const issues: Issue[] = [];
    const h1s = ctx.dom.querySelectorAll('h1');
    const h1Count = h1s.length;

    if (h1Count === 0) {
      issues.push(
        this.error(
          'missing-h1',
          'Missing H1 tag',
          'No H1 heading found. H1 is the most important on-page SEO signal after the title.',
          ctx.url,
          {
            fix: 'Add a single descriptive H1 tag that includes your primary keyword.',
            docs: 'https://developers.google.com/search/docs/appearance/structured-data/article',
          },
        ),
      );
    } else if (h1Count > 1) {
      issues.push(
        this.error(
          'multiple-h1',
          'Multiple H1 tags',
          `Found ${h1Count} H1 tags. Pages should have exactly one H1.`,
          ctx.url,
          { value: h1Count, expected: 1, fix: 'Consolidate to a single H1 tag.' },
        ),
      );
    } else {
      issues.push(this.pass('h1-present', 'Single H1 tag present', ctx.url));
    }

    // Check heading hierarchy
    const hierarchy = this.extractHeadingLevels(ctx.dom);
    if (!this.isHierarchyValid(hierarchy)) {
      issues.push(
        this.warning(
          'heading-hierarchy-invalid',
          'Heading hierarchy is broken',
          'Headings skip levels (e.g. H1 → H3 without H2). This confuses screen readers and crawlers.',
          ctx.url,
          {
            fix: 'Ensure headings follow a logical order: H1 → H2 → H3.',
            value: hierarchy.join(', '),
          },
        ),
      );
    } else if (hierarchy.length > 1) {
      issues.push(this.pass('heading-hierarchy-ok', 'Heading hierarchy is valid', ctx.url));
    }

    return issues;
  }

  private extractHeadingLevels(dom: Document): number[] {
    const headings = dom.querySelectorAll('h1, h2, h3, h4, h5, h6');
    return Array.from(headings).map((el) => parseInt(el.tagName.slice(1), 10));
  }

  private isHierarchyValid(levels: number[]): boolean {
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1];
      const curr = levels[i];
      if (prev !== undefined && curr !== undefined && curr > prev + 1) {
        return false;
      }
    }
    return true;
  }

  private checkLang(ctx: AnalyzerContext): Issue[] {
    const htmlEl = ctx.dom.querySelector('html');
    const lang = htmlEl?.getAttribute('lang')?.trim();

    if (!lang) {
      return [
        this.warning(
          'missing-lang-attribute',
          'Missing lang attribute on <html>',
          'The lang attribute helps screen readers and search engines understand the page language.',
          ctx.url,
          { fix: 'Add lang="en" (or appropriate language code) to the <html> element.' },
        ),
      ];
    }

    return [this.pass('lang-attribute-present', 'Language attribute is set', ctx.url)];
  }
}
