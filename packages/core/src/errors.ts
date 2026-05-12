/**
 * Error codes used throughout the auditor.
 */
export type AuditorErrorCode =
  | 'FETCH_FAILED'
  | 'TIMEOUT'
  | 'INVALID_URL'
  | 'ROBOTS_BLOCKED'
  | 'PARSE_ERROR'
  | 'PUPPETEER_UNAVAILABLE'
  | 'CONFIG_INVALID';

/**
 * Typed error class for all auditor-originated errors.
 */
export class AuditorError extends Error {
  public readonly code: AuditorErrorCode;
  public readonly url: string | undefined;

  constructor(message: string, code: AuditorErrorCode, url?: string) {
    super(message);
    this.name = 'AuditorError';
    this.code = code;
    this.url = url;
  }
}