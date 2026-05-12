import { BaseAnalyzer, type AnalyzerContext } from './BaseAnalyzer.js';
import type { Issue } from '../types/index.js';

const MIN_WORD_COUNT = 300;
const THIN_CONTENT_THRESHOLD = 150;

/**
 * Content quality checks:
 * - Word count / thin content
 * - Readability estimation
 * - Keyword stuffing signals
 */
export class ContentAnalyzer extends BaseAnalyzer {
  readonly name = 'content' as const;

  async analyze(ctx: AnalyzerContext): Promise<Issue[]> {
    const issues: Issue[] = [];

    const textContent = this.extractBodyText(ctx.dom);
    const wordCount = this.countWords(textContent);

    issues.push(...this.checkWordCount(ctx, wordCount));
    issues.push(...this.checkReadability(ctx, textContent, wordCount));

    return issues;
  }

  private extractBodyText(dom: Document): string {
    // Remove script, style, and nav elements before extracting text
    const body = dom.querySelector('body');
    if (!body) return '';

    const clone = body.cloneNode(true) as Element;
    clone.querySelectorAll('script, style, nav, header, footer, aside').forEach((el) => {
      el.remove();
    });

    return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  private checkWordCount(ctx: AnalyzerContext, wordCount: number): Issue[] {
    if (wordCount < THIN_CONTENT_THRESHOLD) {
      return [
        this.error(
          'thin-content',
          'Thin content detected',
          `Page has only ${wordCount} words. Pages with very little content are considered low-quality by search engines.`,
          ctx.url,
          {
            value: wordCount,
            expected: `>= ${MIN_WORD_COUNT}`,
            fix: 'Add substantive content that genuinely serves the user. Aim for at least 300 words for informational pages.',
            docs: 'https://developers.google.com/search/docs/essentials/creating-helpful-content',
          },
        ),
      ];
    }

    if (wordCount < MIN_WORD_COUNT) {
      return [
        this.warning(
          'low-word-count',
          'Low word count',
          `Page has ${wordCount} words. Short content may struggle to rank for competitive keywords.`,
          ctx.url,
          {
            value: wordCount,
            expected: `>= ${MIN_WORD_COUNT}`,
            fix: 'Expand the content with useful information that serves the reader.',
          },
        ),
      ];
    }

    return [this.pass('word-count-ok', 'Page has sufficient content', ctx.url)];
  }

  private checkReadability(ctx: AnalyzerContext, text: string, wordCount: number): Issue[] {
    if (wordCount < 50) return [];

    // Flesch Reading Ease approximation
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const sentenceCount = Math.max(sentences.length, 1);
    const syllables = this.estimateSyllables(text);

    const avgWordsPerSentence = wordCount / sentenceCount;
    const avgSyllablesPerWord = wordCount > 0 ? syllables / wordCount : 1;

    const fleschScore = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

    if (avgWordsPerSentence > 25) {
      return [
        this.info(
          'long-sentences',
          'Sentences are very long on average',
          `Average sentence length is ${avgWordsPerSentence.toFixed(0)} words. Long sentences reduce readability.`,
          ctx.url,
          {
            value: avgWordsPerSentence.toFixed(1),
            expected: '<= 20 words',
            fix: 'Break long sentences into shorter ones to improve readability.',
          },
        ),
      ];
    }

    if (fleschScore < 30) {
      return [
        this.info(
          'low-readability',
          'Content may be difficult to read',
          `Estimated readability score is low (Flesch: ${fleschScore.toFixed(0)}). Consider simplifying language.`,
          ctx.url,
          { value: fleschScore.toFixed(0), expected: '> 50' },
        ),
      ];
    }

    return [this.pass('readability-ok', 'Content readability is acceptable', ctx.url)];
  }

  /**
   * Rough syllable count estimator for Flesch score.
   */
  private estimateSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    return words.reduce((count, word) => {
      // Count vowel groups as syllable proxy
      const vowelGroups = word.match(/[aeiouy]+/g);
      return count + (vowelGroups ? vowelGroups.length : 1);
    }, 0);
  }
}
