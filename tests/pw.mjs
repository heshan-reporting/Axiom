/* Playwright for the browser harnesses, found portably, in this order:
 *   1. PLAYWRIGHT_MJS - an explicit path to playwright's index.mjs
 *   2. the project install (npm ci; package-lock.json pins the version)
 *   3. the global install (npm root -g), e.g. a sandbox that ships Playwright
 * Chromium comes from PLAYWRIGHT_BROWSERS_PATH or `npx playwright install chromium`. A missing Playwright fails
 * with what to run, not with a machine-specific path. */
import { execSync } from 'node:child_process';
import path from 'node:path'; import fs from 'node:fs';
async function load() {
  if (process.env.PLAYWRIGHT_MJS) return import(process.env.PLAYWRIGHT_MJS);
  try { return await import('playwright'); } catch (e) { /* not installed in the project: try the global install */ }
  let root = ''; try { root = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) {}
  const g = root && path.join(root, 'playwright', 'index.mjs');
  if (g && fs.existsSync(g)) return import(g);
  throw new Error('Playwright is not installed. Run: npm ci && npx playwright install chromium   (or set PLAYWRIGHT_MJS to playwright/index.mjs)');
}
export const { chromium } = await load();
export const DOCS = new URL('../docs', import.meta.url).pathname;
