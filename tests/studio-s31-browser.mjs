/* S31: the 4 November external audit of p47 (CREATIVE-STUDIO.md s.57) in real Chromium against the worker module in this process,
 * every provider MOCKED. Each case fails on ac22dd1 and passes with its fix.
 *   SC  a guest link scoped to the synthetic client lists that client only, and opens on it whatever the browser last chose
 *   MK  a mark the worker could not read from the measured PNG (here an opaque wordmark file) is said in Checks as "checked in the
 *       browser only", with why, and the approval dialog says it before a person approves; approval stays possible
 * Run: node --experimental-sqlite tests/studio-s31-browser.mjs   (S31_PORT picks the static server's port, default 8887) */
import { makeStudio, runner, ok, eq, place } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';
import { pngForVersion } from './png.mjs';
import { stubReport } from './studio-measure-stub.mjs';
import zlib from 'node:zlib';
import { chunk } from './png.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.S31_PORT || 8887), inspect: false });
const { api, env } = fx;
env.AXIOM_GUEST_KEYS = JSON.stringify({ 'guest-synth-key1': { n: 'Synth tester', r: 'full', until: '2099-01-01', ns: 'synthdemo' } });
const T = runner('S31: guest client scope and browser-only mark checks in the browser');

await T.t('SC: a guest link scoped to the synthetic client lists that client only, even when the browser last chose MCA', async () => {
  const page = await fx.open({ key: 'guest-synth-key1', store: { ax_studio_v1: JSON.stringify({ client: 'mca' }) } });
  try {
    await page.waitForSelector(R + 'select.st-client', { timeout: 20000 });
    let opts = []; for (let i = 0; i < 40; i++) { opts = await page.$$eval(R + 'select.st-client option', o => o.map(x => x.value)); if (opts.length && opts.every(v => v === 'synthdemo')) break; await sleep(250); }
    eq(opts, ['synthdemo'], 'only the scoped client is offered');
    eq(await page.$eval(R + 'select.st-client', s => s.value), 'synthdemo', 'and it is the one shown');
  } finally { await page.context().close(); }
});

await T.t('MK: an opaque wordmark the worker could not read is "checked in the browser only" in Checks and in the approval dialog', async () => {
  const s = await seedStages(fx, { prefix: 'S31', only: ['design'] });
  // an opaque wordmark file (a white field, no transparency): the worker cannot tell its ink from its field
  const W = 300, H = 80, row = 1 + W * 3, raw = Buffer.alloc(row * H, 255); for (let y = 0; y < H; y++) raw[y * row] = 0;
  const hd = Buffer.alloc(13); hd.writeUInt32BE(W, 0); hd.writeUInt32BE(H, 4); hd[8] = 8; hd[9] = 2;
  const opaque = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', hd), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  const k = await api('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'solid', wordmarkTone: 'light', wordmarkB64: opaque.toString('base64'), wordmarkMime: 'image/png' });
  ok(k._status === 200, 'stored: ' + JSON.stringify(k).slice(0, 160));
  const kit = await api('GET', '/brand/kit?ns=mca'); const wm = ((kit.kit || kit).campaigns.find(c => c.id === 'hoof').wordmarks || []).find(x => x.variant === 'solid');
  const g = await api('GET', '/studio/get?id=' + s.design); const a = g.assets.find(x => (x.versions.find(v => v.id === x.current) || {}).mode !== 'copy'); const v0 = a.versions.find(v => v.id === a.current);
  const layout = JSON.parse(JSON.stringify(v0.layout)); layout.layers = (layout.layers || []).filter(l => l.role !== 'wordmark' && l.role !== 'logo').concat([{ id: 'wordmark', type: 'img', role: 'wordmark', asset: 'wordmark', campaign: 'hoof', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=solid&v=' + wm.v, x: 62, y: 84, w: 30, h: 8, fit: 'contain', exact: true }]);
  const nv = await api('POST', '/studio/version', { asset: a.id, project: s.design, layout, note: 'the solid wordmark' }); ok(nv._status === 200, 'version: ' + JSON.stringify(nv).slice(0, 200));
  const g2 = await api('GET', '/studio/get?id=' + s.design); const a2 = g2.assets.find(x => x.id === a.id); const v = a2.versions.find(x => x.id === a2.current);
  const val = await api('POST', '/studio/validation', { asset: a.id, version: v.id, report: stubReport(v, a2), imageB64: pngForVersion(v, { fill: 3 }) });
  ok(val.readiness && val.readiness.browserOnly && val.readiness.browserOnly[0].element === 'wordmark', 'the worker lists it: ' + JSON.stringify(val.readiness && val.readiness.browserOnly));
  const page = await fx.open({});
  try {
    await openProject(page, 'S31 at design'); await sleep(500);
    await goStep(page, 'Design'); await sleep(800);
    await page.click(R + '.st-pagechip:has-text("' + a.title.slice(0, 18) + '")').catch(() => {}); await sleep(600);
    await place(page, 'checks'); await page.waitForSelector(R + '.st-readydetail');
    await page.waitForSelector(R + '.st-ready-browseronly', { timeout: 15000 });
    const t = (await page.textContent(R + '.st-ready-browseronly')).replace(/\s+/g, ' ');
    ok(/checked in the browser only/.test(t) && /wordmark/.test(t) && /transparent/.test(t), 'Checks says it, with why: ' + t);
    // the approval dialog says it before a person approves (Review, design, Approve)
    await goStep(page, 'Review'); await sleep(800);
    const btn = page.locator(R + 'button:has-text("Approve design")').first();
    if (await btn.count()) {
      await btn.click(); await page.waitForSelector('.st-dialog', { timeout: 8000 });
      const d = (await page.textContent('.st-dialog')).replace(/\s+/g, ' ');
      ok(/checked in the browser only/.test(d), 'the approval dialog says it: ' + d.slice(0, 300));
    } else ok(false, 'no Approve design button in Review');
  } finally { await page.context().close(); }
});

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
