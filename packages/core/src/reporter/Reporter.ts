import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { JsonFormatter } from './formatters/JsonFormatter.js';
import { HtmlFormatter } from './formatters/HtmlFormatter.js';
import { MarkdownFormatter } from './formatters/MarkdownFormatter.js';
import type { AuditReport } from '../types/index.js';

export type ReportFormat = 'json' | 'html' | 'markdown';

export interface ReporterOptions {
  format: ReportFormat;
  outputPath: string;
}

/**
 * Writes an AuditReport to disk in the requested format.
 */
export class Reporter {
  private readonly jsonFormatter = new JsonFormatter();
  private readonly htmlFormatter = new HtmlFormatter();
  private readonly mdFormatter = new MarkdownFormatter();

  /**
   * Serialize and write a report to the given path.
   * Creates parent directories automatically.
   */
  async write(report: AuditReport, options: ReporterOptions): Promise<string> {
    const content = this.serialize(report, options.format);
    const absPath = resolve(options.outputPath);

    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, content, 'utf-8');

    return absPath;
  }

  /**
   * Serialize a report to a string in the given format.
   */
  serialize(report: AuditReport, format: ReportFormat): string {
    switch (format) {
      case 'json':
        return this.jsonFormatter.format(report);
      case 'html':
        return this.htmlFormatter.format(report);
      case 'markdown':
        return this.mdFormatter.format(report);
      default: {
        const _exhaustive: never = format;
        throw new Error(`Unknown report format: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * Infer the format from a file extension.
   */
  static inferFormat(filePath: string): ReportFormat {
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case '.html':
      case '.htm':
        return 'html';
      case '.md':
        return 'markdown';
      default:
        return 'json';
    }
  }
}
