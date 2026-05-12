import chalk from 'chalk';

export const theme = {
  error: chalk.red,
  warning: chalk.yellow,
  pass: chalk.green,
  info: chalk.blue,
  muted: chalk.gray,
  accent: chalk.magenta,
  bold: chalk.bold,
  url: chalk.cyan,
  score: (score: number): string => {
    if (score >= 90) return chalk.green.bold(score.toString());
    if (score >= 75) return chalk.blue.bold(score.toString());
    if (score >= 60) return chalk.yellow.bold(score.toString());
    if (score >= 40) return chalk.red(score.toString());
    return chalk.red.bold(score.toString());
  },
  grade: (grade: string): string => {
    const map: Record<string, (s: string) => string> = {
      A: (s) => chalk.green.bold(s),
      B: (s) => chalk.blue.bold(s),
      C: (s) => chalk.yellow.bold(s),
      D: (s) => chalk.red(s),
      F: (s) => chalk.red.bold(s),
    };
    return (map[grade] ?? chalk.white)(grade);
  },
  severityIcon: (severity: string): string => {
    const map: Record<string, string> = {
      error: chalk.red('❌'),
      warning: chalk.yellow('⚠️ '),
      pass: chalk.green('✅'),
      info: chalk.blue('ℹ️ '),
    };
    return map[severity] ?? severity;
  },
} as const;
