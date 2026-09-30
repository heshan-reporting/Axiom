/* Playwright for the browser harnesses: the sandbox's global install by default, PLAYWRIGHT_MJS to point elsewhere
 * (e.g. a project install: PLAYWRIGHT_MJS=./node_modules/playwright/index.mjs). */
export const { chromium } = await import(process.env.PLAYWRIGHT_MJS || '/opt/node22/lib/node_modules/playwright/index.mjs');
export const DOCS = new URL('../docs', import.meta.url).pathname;
