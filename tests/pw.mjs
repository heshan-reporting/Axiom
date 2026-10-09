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
const pw = await load();
/* PW_CPU_THROTTLE=4 runs every page four times slower (Chrome's CPU throttling): the way to find a harness that races
 * the page here before a slower machine (CI) finds it. Unset, Playwright is untouched. */
const RATE = Number(process.env.PW_CPU_THROTTLE || 0);
async function throttle(page) { try { const s = await page.context().newCDPSession(page); await s.send('Emulation.setCPUThrottlingRate', { rate: RATE }); } catch (e) {} return page; }
function slowContext(ctx) { const np = ctx.newPage.bind(ctx); ctx.newPage = async (...a) => throttle(await np(...a)); return ctx; }
export const chromium = RATE > 1 ? Object.assign(Object.create(pw.chromium), {
  async launch(...a) {
    const b = await pw.chromium.launch(...a); const nc = b.newContext.bind(b), np = b.newPage.bind(b);
    b.newContext = async (...x) => slowContext(await nc(...x)); b.newPage = async (...x) => throttle(await np(...x)); return b;
  },
}) : pw.chromium;
export const DOCS = new URL('../docs', import.meta.url).pathname;
/* S23: the other engines, for the cross-browser harness (installed with npx playwright install firefox webkit) */
export const firefox = pw.firefox; export const webkit = pw.webkit;
