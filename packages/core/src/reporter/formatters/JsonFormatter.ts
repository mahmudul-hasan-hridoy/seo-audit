import type { AuditReport } from '../../types/index.js';

/**
 * Formats an AuditReport as JSON.
 */
export class JsonFormatter {
  /**
   * Serialize the report to a pretty-printed JSON string.
   */
  format(report: AuditReport, pretty = true): string {
    return JSON.stringify(report, this.replacer, pretty ? 2 : 0);
  }

  /**
   * Custom replacer to ensure Date objects are ISO-stringified.
   */
  private replacer(_key: string, value: unknown): unknown {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }
}
