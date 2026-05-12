import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AuditConfig } from 'seo-auditor';

const CONFIG_FILENAMES = ['seo-audit.config.ts', 'seo-audit.config.js', 'seo-audit.config.mjs'];

/**
 * Attempt to load a seo-audit.config.ts / .js from the given directory.
 * Returns null if no config file is found.
 */
export async function loadConfig(cwd = process.cwd()): Promise<AuditConfig | null> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = join(cwd, filename);
    if (!existsSync(configPath)) continue;

    try {
      const fileUrl = pathToFileURL(resolve(configPath)).toString();
      const mod = (await import(fileUrl)) as { default?: AuditConfig };

      if (mod.default && typeof mod.default === 'object') {
        return mod.default;
      }

      console.warn(`[seo-audit] Config file ${filename} has no default export.`);
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[seo-audit] Failed to load config from ${filename}: ${message}`);
      return null;
    }
  }

  return null;
}
