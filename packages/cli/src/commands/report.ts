import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import chalk from 'chalk';
import { Reporter } from 'seo-auditor';
import type { AuditReport } from 'seo-auditor';

export interface ReportCommandOptions {
  format?: string;
  output?: string;
  open?: boolean;
}

/**
 * Implementation of the `seo-audit report <file>` command.
 * Reads a saved JSON audit report and converts it to the requested format.
 */
export async function runReportCommand(
  file: string,
  opts: ReportCommandOptions,
): Promise<void> {
  const inputPath = resolve(file);

  let raw: string;
  try {
    raw = await readFile(inputPath, 'utf-8');
  } catch {
    console.error(chalk.red(`Error: Cannot read file: ${inputPath}`));
    process.exit(1);
  }

  let report: AuditReport;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    report = {
      ...parsed,
      auditedAt: new Date(parsed['auditedAt'] as string),
      pages: (parsed['pages'] as Array<Record<string, unknown>>).map((p) => ({
        ...p,
        auditedAt: new Date(p['auditedAt'] as string),
      })),
    } as AuditReport;
  } catch {
    console.error(chalk.red(`Error: File is not a valid JSON audit report: ${inputPath}`));
    process.exit(1);
  }

  const format = (opts.format ?? 'html') as 'json' | 'html' | 'markdown';
  const ext = format === 'markdown' ? 'md' : format;
  const defaultOutput = inputPath.replace(/\.[^.]+$/, `.${ext}`);
  const outputPath = opts.output ? resolve(opts.output) : defaultOutput;

  const reporter = new Reporter();
  try {
    const savedPath = await reporter.write(report, { format, outputPath });
    console.log(chalk.green(`✓ Report saved → ${chalk.cyan(savedPath)}`));

    if (opts.open && format === 'html') {
      const { default: open } = await import('open');
      await open(savedPath);
    }
  } catch (err) {
    console.error(chalk.red(`Error saving report: ${String(err)}`));
    process.exit(1);
  }
}

function _unusedExt(p: string): string {
  return extname(p);
}
void _unusedExt;
