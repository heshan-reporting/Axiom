/* The sign-in link (index.html#k=<key>&v=<view>), in real Chromium against the worker module in this process.
 * The key in the fragment is stored as the browser's access key and struck out of the address at once (no key in the
 * history, nothing sent to the server); #v= opens that view; a read key signs in as read; a link without a key leaves
 * the stored key alone; a malformed key is ignored. Providers MOCKED.
 * Run: node --experimental-sqlite tests/access-link-browser.mjs */
import { makeStudio, runner, eq, ok, place, tool } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8801 });
const T = runner('access-link-browser (a link that signs a browser in: the key stored, struck from the address, the view opened; providers MOCKED)');
const base = 'http://127.0.0.1:' + fx.PORT + '/index.html';

await T.t('#k=<full key>&v=studio stores the key, strips it from the address and opens the Studio', async () => {
  const page = await fx.open({ go: false });
  await page.goto(base + '?l=1#k=full-key&v=studio', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#studio-root .st-head', { timeout: 15000 });
  const st = await page.evaluate(() => ({ key: localStorage.getItem('axiom_access_key'), hash: location.hash, href: location.href, view: document.querySelector('.view.on') && document.querySelector('.view.on').id, hdr: axHeaders()['X-Axiom-Key'] }));
  eq(st.key, 'full-key', 'the key from the link is the stored access key');
  eq(st.hdr, 'full-key', 'requests carry it at once');
  eq(st.hash, '#v=studio', 'the key is struck out of the address; the view stays');
  ok(st.href.indexOf('full-key') < 0, 'nothing of the key is left in the address');
  eq(st.view, 'v-studio', 'the Studio view is open');
  const lib = await page.textContent('#studio-root');
  ok(/projects|New project|Studio/i.test(lib), 'the Studio library rendered with the key');
  await page.ctxB.close();
});

await T.t('a read key signs in as read: the Studio opens but shows no mutating entry', async () => {
  const page = await fx.open({ go: false });
  await page.goto(base + '?l=2#k=read-key&v=studio', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#studio-root .st-head', { timeout: 15000 });
  eq(await page.evaluate(() => localStorage.getItem('axiom_access_key')), 'read-key', 'the read key is stored');
  const r = await fx.api('GET', '/studio/status', null, 'read-key'); ok(r.ok, 'a read key reads');
  const w = await fx.handler.fetch(new Request('https://w.test/studio/project', { method: 'POST', headers: { 'X-Axiom-Key': 'read-key', 'Content-Type': 'application/json' }, body: '{"ns":"mca","title":"x"}' }), fx.env, {});
  eq(w.status, 403, 'and cannot write');
  await page.ctxB.close();
});

await T.t('a link without a key leaves the stored key alone; a malformed key is ignored', async () => {
  const page = await fx.open({ go: false });
  await page.goto(base + '?l=3#v=studio', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#studio-root .st-head', { timeout: 15000 });
  eq(await page.evaluate(() => localStorage.getItem('axiom_access_key')), 'full-key', 'the fixture key (set before the page ran) stands');
  await page.goto(base + '?l=4#k=bad!key&v=studio', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function');
  eq(await page.evaluate(() => localStorage.getItem('axiom_access_key')), 'full-key', 'a key with characters outside [A-Za-z0-9_-] is not taken');
  await page.ctxB.close();
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
