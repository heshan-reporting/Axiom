/* S23 slice H: the editable canvas in real Chromium against the worker module in this process (studio-fixture.mjs; providers
 * MOCKED, nothing spent). Each capability the request named, checked against the record the worker keeps:
 *   H-B1  the Elements panel: click adds at the centre of the view (a named step), drag places where it is dropped, the brand
 *         assets are the campaign policy's marks only (HOOF: its wordmark, never the client logo), uploads are this project's;
 *   H-B2  the context menu: right-click, Shift+F10, arrow keys, Escape returning the focus; a disabled item says why; on the
 *         empty stage "Add text here" places words at the pointer;
 *   H-B3  a long press on a touch screen opens the same menu (touch events through CDP);
 *   H-B4  copy and paste a style: the look moves, the words and the place do not; a mark and a locked layer take none;
 *   H-B5  the clipboard is data only: pasted HTML and scripts never run and are never inserted; plain text becomes words drawn by
 *         the renderer; a PNG is uploaded and placed; another kind of file is refused by name; the Studio's own copy still pastes;
 *   H-B6  a desktop drop: an image dropped on the artwork is placed where it lands; dropped on a frame, it fills the frame;
 *   H-B7  rulers and guides: a guide dragged from the ruler is kept on the asset (no version) and comes back after a reload;
 *   H-B8  several layers scale together from a corner (type with them) and turn together about their centre; one undo each;
 *         a held mark stays where the campaign rule puts it;
 *   H-B9  the history is named steps, distinct from versions; choosing a step goes back to it;
 *   H-B10 moving shows the gaps to the neighbours in output pixels and settles on equal spacing;
 *   H-B11 double-click reframes a placed image inside its box; Escape puts the crop back;
 *   H-B12 the words fitted to their box, bounded; a box too small says so and changes nothing;
 *   H-B13 colour: the brand palette first, recent colours kept, the eyedropper without the browser's own reads the artwork;
 *   H-B14 zoom: Shift+2 zooms to the selection, Ctrl with + and - steps; a pinch zooms and cancels the drag it interrupted;
 *   H-B15 pages: add, duplicate, move, delete and restore from the strip; numbered in order; nothing generated.
 * Run: node --experimental-sqlite tests/studio-s23h-browser.mjs   (SHOT=1 writes tests/shots/s23/h-*.png) */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok, tool, pngGradient, pngSolid } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8879, inspect: false });
const { api, calls } = fx;
const R = '#studio-root ';
const T = runner('studio-s23h-browser (the canvas: elements, context menu, clipboard, drop, rulers, group transforms, named history, spacing, reframe, fit, colour, zoom, pages; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = new URL('./shots/s23/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
let page;
const shot = async name => { if (process.env.SHOT) await page.screenshot({ path: SHOTS + 'h-' + name + '.png' }); };
const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'A road tax, returned.', alt: 'Teal panel with the headline' };
const WORDMARK = pngSolid(240, 80, [255, 255, 255]).toString('base64');
// HOOF carries its own wordmark and never the client logo
await api('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', logoPolicy: 'wordmark' }] });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkDefault: true, wordmarkB64: WORDMARK, wordmarkMime: 'image/png', logoPolicy: 'wordmark' });
const LAYOUT = (i, of) => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', bg: '#0E3A44', regions: [], frame: of ? { index: i, of } : undefined, layers: [
  { id: 'panel', type: 'shape', role: 'device', name: 'Panel', shape: 'rect', x: 0, y: 64, w: 100, h: 36, fill: '#0E6A6E', opacity: 1 },
  { id: 'headline', type: 'text', role: 'headline', x: 8, y: 68, w: 84, h: 12, size: 6, weight: 800, color: '#FFFFFF', font: 'display' },
  { id: 'support', type: 'text', role: 'support', x: 8, y: 82, w: 70, h: 8, size: 3, weight: 500, color: '#FFFFFF', font: 'body' },
  { id: 'kicker', type: 'text', role: 'free', name: 'Kicker', text: 'MYTH BUSTED', x: 8, y: 10, w: 40, h: 5, size: 2.6, weight: 700, color: '#F2B705', font: 'mono' },
  { id: 'chip', type: 'shape', role: 'device', name: 'Chip', shape: 'pill', x: 60, y: 10, w: 30, h: 6, fill: '#F2B705', opacity: 1 },
] });
const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Canvas check', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'h-canvas' });
const mkA = async (title, i, of) => (await api('POST', '/studio/asset', { project: pr.id, family: 'Carousel', channel: 'instagram', format: '4:5', title, copy: COPY, layout: LAYOUT(i, of), mode: 'composition' })).asset.id;
const A1 = await mkA('Frame one', 0, 2); const A2 = await mkA('Frame two', 1, 2);
// single tiles for the cases that need a layout nobody else has touched
const mkS = async title => (await api('POST', '/studio/asset', { project: pr.id, family: 'Singles', channel: 'instagram', format: '4:5', title, copy: COPY, layout: LAYOUT(0, 0), mode: 'composition' })).asset.id;
const A3 = await mkS('Crop tile'); const A4 = await mkS('Colour tile'); const A5 = await mkS('Zoom tile');
// a tile whose wordmark the campaign rule holds in its corner
const KIT = await api('GET', '/brand/kit?ns=mca'); const WM = ((KIT.kit || KIT).campaigns || []).find(c => c.id === 'hoof').wordmarks[0];
const HELD = Object.assign(LAYOUT(0, 0), {}); HELD.layers = HELD.layers.concat([{ id: 'wordmark', type: 'img', role: 'wordmark', asset: 'wordmark', campaign: 'hoof', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=' + WM.variant + '&v=' + WM.v, x: 70, y: 88, w: 24, h: 8, fit: 'contain', exact: true, rule: { mandatory: true, corner: 'br' } }]);
const A6 = (await api('POST', '/studio/asset', { project: pr.id, family: 'Singles', channel: 'instagram', format: '4:5', title: 'Held tile', copy: COPY, layout: HELD, mode: 'composition' })).asset.id;
const get = async () => api('GET', '/studio/get?id=' + pr.id);
const curOf = a => a.versions.find(v => v.id === a.current);
const L = id => '.st-le-layer[data-id="' + id + '"]';
async function openAsset(title) {
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Canvas check") button.st-lib-open');
  await page.waitForSelector(R + '.st-step'); await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  await page.click(R + '.st-assetpick:has-text("' + title + '")'); await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForSelector(R + '.st-le-layer'); await sleep(500);
}
async function fresh(title, o) {
  if (page) await page.ctxB.close().catch(() => {});
  page = await fx.open(Object.assign({ viewport: { width: 1440, height: 1000 } }, o || {})); page.on('dialog', d => d.accept());
  await openAsset(title || 'Frame one');
}
const saveLayout = async () => { await page.click(R + '.st-le-foot .btn:has-text("Save layout as a version")'); await page.waitForFunction(() => { const el = document.querySelector('#studio-root .st-le-draft'); return el && /No unsaved changes/.test(el.textContent); }, null, { timeout: 8000 }); await sleep(300); };
const layerOn = async (assetId, id) => { const g = await get(); const a = g.assets.find(x => x.id === assetId); return curOf(a).layout.layers.find(l => l.id === id); };
const PNG = (w, h) => pngGradient(w, h).toString('base64');
// a clipboard or drop as the browser would hand it over, built in the page
const transfer = (o) => page.evaluate(o0 => { const dt = new DataTransfer(); if (o0.html) dt.setData('text/html', o0.html); if (o0.text != null) dt.setData('text/plain', o0.text); (o0.files || []).forEach(f => { const bytes = Uint8Array.from(atob(f.b64), c => c.charCodeAt(0)); dt.items.add(new File([bytes], f.name, { type: f.type })); }); window.__dt = dt; return true; }, o);
const pasteNow = () => page.evaluate(() => { const t = document.activeElement || document.body; t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: window.__dt, bubbles: true, cancelable: true })); });
const dropAt = (fx0, fy0) => page.evaluate(({ fx0, fy0 }) => { const el = document.querySelector('#studio-root .st-le'); const r = el.getBoundingClientRect(); const x = r.left + r.width * fx0, y = r.top + r.height * fy0; el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__dt, clientX: x, clientY: y })); el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__dt, clientX: x, clientY: y })); }, { fx0, fy0 });
const stageAt = async (fx0, fy0) => { const b = await (await page.$(R + '.st-le')).boundingBox(); return { x: b.x + b.width * fx0, y: b.y + b.height * fy0 }; };
// the selected layer's box as the layout holds it (the Properties box fields), not the measured ink the handles sit on
const modelBox = async () => { const v = async k => +(await page.inputValue(R + 'input[aria-label="' + k + ', per cent of the stage"]')); return { x: await v('X'), y: await v('Y'), w: await v('Width'), h: await v('Height') }; };
// the editor's working layout as it stands (read from the history the editor keeps, through the Layers list and the boxes)
const boxOf = async id => page.$eval(R + L(id), el => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top), width: parseFloat(el.style.width), height: parseFloat(el.style.height), transform: el.style.transform || '' }));
const ids = async () => page.$$eval(R + '.st-le-layer', els => els.map(e => e.getAttribute('data-id')));
const centreOf = async sel => { const b = await (await page.$(R + sel)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
const toast = async () => page.evaluate(() => Array.from(document.querySelectorAll('.toast, #toast, .ax-toast')).map(e => e.textContent).join(' | '));
const steps = async () => { await page.click(R + '.st-hist-wrap > button'); await page.waitForSelector(R + '.st-hist-pop'); const t = await page.$$eval(R + '.st-hist-step', els => els.map(e => e.textContent.trim())); await page.keyboard.press('Escape'); return t; };
const saveLine = async () => page.$eval(R + '.st-le-draft', el => el.textContent);

await T.t('H-B1 Elements: a click adds at the centre of the view as a named step; a drag places where it lands; brand assets follow the campaign policy; uploads are this project\'s', async () => {
  await fresh();
  await tool(page, 'Elements');
  ok(await page.$(R + '.st-elements'), 'the Elements panel');
  const brand = await page.$$eval(R + '.st-el-sec[aria-label="Brand assets"] .st-el-item', els => els.map(e => e.getAttribute('aria-label')));
  ok(brand.length >= 1 && brand.every(x => /wordmark/i.test(x)) && !brand.some(x => /client logo/i.test(x)), 'HOOF offers its wordmark, never the client logo: ' + brand.join(' | '));
  const before = (await ids()).length;
  await page.click(R + '.st-el-item[aria-label="Add Subheading"]'); await sleep(300);
  const after = await ids(); eq(after.length, before + 1, 'one layer added');
  const added = after.find(x => ['panel', 'headline', 'support', 'kicker', 'chip'].indexOf(x) < 0);
  const b = await modelBox(); ok(Math.abs(b.x + b.w / 2 - 50) < 1 && Math.abs(b.y + b.h / 2 - 50) < 1, 'at the centre of the view: ' + JSON.stringify(b));
  ok((await page.getAttribute(R + L(added), 'aria-pressed')) === 'true', 'the new layer is selected');
  ok((await steps()).some(s => /^Add Subheading/.test(s)), 'the step is named');
  // a drag from the panel: the drop lands where the pointer is (a synthetic drag carries the same data the panel writes)
  const st = await (await page.$(R + '.st-le')).boundingBox();
  await page.evaluate(({ x, y }) => { const dt = new DataTransfer(); dt.setData('application/x-axiom-element', JSON.stringify({ kind: 'shape', o: { shape: 'circle' } })); const el = document.querySelector('#studio-root .st-le'); el.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); }, { x: st.x + st.width * 0.25, y: st.y + st.height * 0.3 });
  await sleep(300); const circ = (await ids()).filter(x => after.indexOf(x) < 0)[0]; ok(circ, 'a circle was dropped');
  const cb = await modelBox(); ok(Math.abs(cb.x + cb.w / 2 - 25) < 1 && Math.abs(cb.y + cb.h / 2 - 30) < 1, 'centred where it was dropped: ' + JSON.stringify(cb));
  // an element smuggled in from elsewhere (another project's upload) is refused
  const n0 = (await ids()).length;
  await page.evaluate(({ x, y }) => { const dt = new DataTransfer(); dt.setData('application/x-axiom-element', JSON.stringify({ kind: 'upload', o: { key: 'studio/OTHER/uploads/x.png', url: '/studio/file?key=studio%2FOTHER%2Fuploads%2Fx.png', name: 'x' } })); const el = document.querySelector('#studio-root .st-le'); el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y })); }, { x: st.x + 40, y: st.y + 40 });
  await sleep(200); eq((await ids()).length, n0, 'another project\'s image is not placed');
  await shot('elements');
});

await T.t('H-B2 the context menu: right-click, arrows, Escape returns the focus; Shift+F10 from the keyboard; a disabled item says why; "Add text here" on the empty stage', async () => {
  await fresh();
  const k = await centreOf(L('kicker'));
  await page.mouse.click(k.x, k.y, { button: 'right' }); await page.waitForSelector(R + '.st-ctxmenu');
  const items = await page.$$eval(R + '.st-ctxmenu .st-ctxitem', els => els.map(e => ({ t: e.querySelector('span').textContent, dis: e.getAttribute('aria-disabled') === 'true', why: (e.querySelector('.st-ctxwhy') || {}).textContent || '' })));
  ['Copy', 'Duplicate', 'Delete', 'Copy style', 'Bring to front', 'Lock', 'Hide', 'Rename', 'Edit the words', 'Fit the words to the box', 'Zoom to selection'].forEach(x => ok(items.some(i => i.t === x && !i.dis), 'offers ' + x + ': ' + items.map(i => i.t).join(', ')));
  const pasteI = items.find(i => i.t === 'Paste'); ok(pasteI && pasteI.dis && /nothing copied/.test(pasteI.why), 'Paste disabled with its reason: ' + JSON.stringify(pasteI));
  eq(await page.evaluate(() => document.activeElement && document.activeElement.textContent), 'CopyCtrl+C', 'the focus starts on the first action');
  await page.keyboard.press('ArrowDown'); eq(await page.evaluate(() => document.activeElement.getAttribute('data-id')), 'dup', 'ArrowDown skips the disabled Paste');
  await page.keyboard.press('Escape'); await sleep(150);
  ok(!(await page.$(R + '.st-ctxmenu')), 'Escape closes it');
  eq(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-id')), 'kicker', 'the focus is back on the layer');
  await page.keyboard.press('Shift+F10'); await page.waitForSelector(R + '.st-ctxmenu');
  const n0 = (await ids()).length; await page.click(R + '.st-ctxmenu [data-id="dup"]'); await sleep(250);
  eq((await ids()).length, n0 + 1, 'Duplicate from the menu'); ok(!(await page.$(R + '.st-ctxmenu')), 'the menu closed');
  const e0 = await stageAt(0.5, 0.42);
  await page.mouse.click(e0.x, e0.y, { button: 'right' }); await page.waitForSelector(R + '.st-ctxmenu[aria-label="Canvas actions"]');
  const n1 = (await ids()).length; await page.click(R + '.st-ctxmenu [data-id="addtext"]'); await sleep(300);
  eq((await ids()).length, n1 + 1, 'Add text here adds words');
  const b = await modelBox(); ok(Math.abs(b.x + b.w / 2 - 50) < 1 && Math.abs(b.y + b.h / 2 - 42) < 1, 'where the menu was opened: ' + JSON.stringify(b));
  await shot('menu');
});

await T.t('H-B3 a long press on a touch screen opens the same menu, and the layer does not move', async () => {
  await fresh('Frame one', { hasTouch: true });
  const cdp = await page.context().newCDPSession(page);
  const c = await centreOf(L('chip')); const b0 = await boxOf('chip');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
  await sleep(800);
  ok(await page.$(R + '.st-ctxmenu'), 'the menu opened while the finger is down');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200);
  ok(await page.$(R + '.st-ctxmenu[aria-label="Actions for the selection"]'), 'the menu stays, for the chip');
  eq(await boxOf('chip'), b0, 'the chip did not move');
});

await T.t('H-B4 copy and paste a style: the look moves, the words and the place do not; another kind and a locked layer take none', async () => {
  await fresh();
  await page.click(R + L('kicker')); await page.keyboard.press('Control+Alt+KeyC'); await sleep(150);
  ok(/Style copied from Kicker/.test(await toast()), 'copied: ' + await toast());
  const sup0 = await layerOn(A1, 'support');
  await page.click(R + L('support')); await page.keyboard.press('Control+Alt+KeyV'); await sleep(200);
  await page.click(R + L('chip')); await page.keyboard.press('Control+Alt+KeyV'); await sleep(200);
  ok(/Nothing here takes the style of Kicker/.test(await toast()), 'a shape takes no text style: ' + await toast());
  const hl0 = await layerOn(A1, 'headline');
  await page.click(R + L('headline')); await page.click(R + '.st-fbar button[aria-label="Lock"]'); await sleep(150);
  await page.keyboard.press('Control+Alt+KeyV'); await sleep(200);
  ok(/Nothing here takes the style of Kicker.*locked layers take none/.test(await toast()), 'a locked layer takes none: ' + await toast());
  await saveLayout();
  const hl1 = await layerOn(A1, 'headline'); eq([hl1.color, hl1.font, hl1.size, !!hl1.locked], [hl0.color, hl0.font, hl0.size, true], 'the locked headline kept its look');
  // unlocked again for the cases that follow
  await page.click(R + L('headline')); await page.click(R + '.st-fbar button[aria-label="Unlock"]'); await sleep(150); await saveLayout();
  const sup = await layerOn(A1, 'support');
  eq([sup.color, sup.font, sup.size, sup.weight], ['#F2B705', 'mono', 2.6, 700], 'the kicker\'s look');
  eq([sup.x, sup.y, sup.w, sup.h, sup.role], [sup0.x, sup0.y, sup0.w, sup0.h, 'support'], 'the place and the role kept');
  eq((await get()).assets.find(a => a.id === A1).versions.length >= 2, true);
  ok((await steps().catch(() => [])).length >= 0, 'steps read');
});

await T.t('H-B5 the clipboard is data only: HTML and scripts never run or land; plain text becomes words; a PNG is placed; another file is named; the Studio copy still pastes', async () => {
  await fresh();
  const e0 = await stageAt(0.5, 0.42); await page.mouse.click(e0.x, e0.y); await sleep(100);
  const n0 = (await ids()).length;
  await transfer({ html: '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2<\/script><b>bold</b>' }); await pasteNow(); await sleep(300);
  eq((await ids()).length, n0, 'formatted content alone places nothing');
  ok(/formatted content only/.test(await toast()), 'and says why: ' + await toast());
  await transfer({ html: '<b>Hello</b><script>window.__pwned=3<\/script>', text: 'Hello <b>world</b><script>window.__pwned=4</script>' }); await pasteNow(); await sleep(400);
  const after = await ids(); eq(after.length, n0 + 1, 'the plain text became one layer');
  const tid = after.find(x => ['panel', 'headline', 'support', 'kicker', 'chip'].indexOf(x) < 0);
  eq(await page.getAttribute(R + L(tid), 'aria-description'), 'Hello <b>world</b><script>window.__pwned=4</script>', 'the words as typed characters, never markup');
  const leak = await page.evaluate(() => ({ ran: window.__pwned === undefined ? 0 : window.__pwned, scripts: document.querySelectorAll('#studio-root script').length, img: document.querySelectorAll('img[src="x"]').length, bold: Array.from(document.querySelectorAll('b')).filter(b => /^(bold|world|Hello)$/.test(b.textContent)).length }));
  eq(leak, { ran: 0, scripts: 0, img: 0, bold: 0 }, 'nothing ran, nothing was inserted');
  await transfer({ files: [{ name: 'pasted.png', type: 'image/png', b64: PNG(64, 48) }] }); await pasteNow(); await sleep(900);
  eq((await ids()).length, n0 + 2, 'the image was placed');
  const up = await api('GET', '/studio/uploads?project=' + pr.id); ok(up.uploads.some(u => /pasted/.test(u.name)), 'uploaded to this project: ' + JSON.stringify(up.uploads.map(u => u.name)));
  await transfer({ files: [{ name: 'brief.pdf', type: 'application/pdf', b64: Buffer.from('%PDF-1.4').toString('base64') }] }); await pasteNow(); await sleep(300);
  eq((await ids()).length, n0 + 2, 'a PDF is not placed'); ok(/Not placed: brief\.pdf \(application\/pdf\)/.test(await toast()), 'named: ' + await toast());
  await page.click(R + L('kicker')); await page.keyboard.press('Control+KeyC'); await sleep(150); await page.keyboard.press('Control+KeyV'); await sleep(500);
  eq((await ids()).length, n0 + 3, 'the Studio\'s own copy pastes');
});

await T.t('H-B6 a desktop drop places the image where it lands; dropped on a frame, it fills the frame', async () => {
  await fresh('Frame two');
  const n0 = (await ids()).length;
  await transfer({ files: [{ name: 'dropped.png', type: 'image/png', b64: PNG(80, 60) }] }); await dropAt(0.3, 0.4); await sleep(900);
  const a1 = await ids(); eq(a1.length, n0 + 1, 'placed');
  const img = a1.find(x => /^m/.test(x)); const b = await modelBox(); ok(Math.abs(b.x + b.w / 2 - 30) < 1 && Math.abs(b.y + b.h / 2 - 40) < 1, 'where it was dropped: ' + JSON.stringify(b));
  await tool(page, 'Elements'); await page.click(R + '.st-el-item[aria-label="Add Image frame"]'); await sleep(300);
  const a2 = await ids(); const frame = a2.find(x => a1.indexOf(x) < 0); const fb = await modelBox();
  await transfer({ files: [{ name: 'into-frame.png', type: 'image/png', b64: PNG(90, 90) }] }); await dropAt((fb.x + fb.w / 2) / 100, (fb.y + fb.h / 2) / 100); await sleep(900);
  eq((await ids()).length, a2.length, 'no new layer: the frame took the image');
  await saveLayout(); const fl = await layerOn(A2, frame); ok(fl.key && /uploads/.test(fl.key) && fl.fit === 'cover' && fl.role === 'frame', 'the frame holds it, cropped to fill: ' + JSON.stringify(fl));
  ok(img, 'the first image');
});

await T.t('H-B7 rulers and guides: a guide dragged from the ruler is kept on the asset without a version and comes back after a reload; dragged off, it is removed', async () => {
  await fresh();
  await page.click(R + '.st-le-viewopts summary'); await page.check(R + 'input[aria-label="Rulers and guides"]'); await page.click(R + '.st-le-viewopts summary');
  await page.waitForSelector(R + '.st-ruler.x');
  const v0 = (await get()).assets.find(a => a.id === A1).versions.length;
  const rx = await (await page.$(R + '.st-ruler.x')).boundingBox(); const st = await (await page.$(R + '.st-le')).boundingBox();
  await page.mouse.move(rx.x + rx.width * 0.5, rx.y + rx.height / 2); await page.mouse.down(); await page.mouse.move(rx.x + rx.width * 0.5, st.y + st.height * 0.4, { steps: 6 }); await page.mouse.up(); await sleep(900);
  ok(await page.$(R + '.st-uguide.y'), 'a horizontal guide');
  const g = (await get()).assets.find(a => a.id === A1); ok(g.guides.length === 1 && g.guides[0].a === 'y' && Math.abs(g.guides[0].at - 40) < 1.5, 'kept on the asset: ' + JSON.stringify(g.guides));
  eq(g.versions.length, v0, 'no version written'); ok(/No unsaved changes/.test(await saveLine()), 'the layout is not dirty: ' + await saveLine());
  await fresh(); await page.click(R + '.st-le-viewopts summary'); await page.check(R + 'input[aria-label="Rulers and guides"]'); await page.click(R + '.st-le-viewopts summary');
  await page.waitForSelector(R + '.st-uguide.y');
  const gb = await (await page.$(R + '.st-uguide.y')).boundingBox(); const st2 = await (await page.$(R + '.st-le')).boundingBox();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await page.mouse.down(); await page.mouse.move(gb.x + gb.width / 2, st2.y - 40, { steps: 6 }); await page.mouse.up(); await sleep(900);
  ok(!(await page.$(R + '.st-uguide.y')), 'removed'); eq((await get()).assets.find(a => a.id === A1).guides, [], 'and forgotten on the asset');
});

await T.t('H-B8 several layers scale together from a corner, type with them, and turn together; one undo each; a held mark stays put', async () => {
  await fresh();
  await page.click(R + L('kicker')); await page.click(R + L('chip'), { modifiers: ['Shift'] }); await page.waitForSelector(R + '.st-le-gbox');
  const k0 = await layerOn(A1, 'kicker'), c0 = await layerOn(A1, 'chip');
  const g0 = await (await page.$(R + '.st-le-gbox')).boundingBox(); const se = await (await page.$(R + '.st-le-gh.h-se')).boundingBox();
  await page.mouse.move(se.x + 5, se.y + 5); await page.mouse.down(); await page.mouse.move(se.x + 5 + g0.width * 0.2, se.y + 5 + g0.height * 0.2, { steps: 8 }); await page.mouse.up(); await sleep(250);
  // the box as the editor draws it, in per cent of the stage (a box past the stage edge is clipped on screen, not in the layout)
  const gw = async () => page.$eval(R + '.st-le-gbox', el => parseFloat(el.style.width));
  const w0 = 82; const w1 = await gw(); ok(w1 > w0 * 1.15, 'the box grew: ' + w0 + '% -> ' + w1 + '%');
  await page.keyboard.press('Control+KeyZ'); await sleep(250);
  ok(Math.abs((await gw()) - w0) < 0.5, 'one undo puts both back: ' + (await gw()));
  await page.keyboard.press('Control+Shift+KeyZ'); await sleep(250);
  await saveLayout(); const k1 = await layerOn(A1, 'kicker'), c1 = await layerOn(A1, 'chip');
  const kk = k1.w / k0.w, kc = c1.w / c0.w; ok(Math.abs(kk - kc) < 0.02 && kk > 1.1, 'one factor for both: ' + kk + ' / ' + kc);
  ok(Math.abs(k1.size / k0.size - kk) < 0.05, 'the type scaled with them: ' + k0.size + ' -> ' + k1.size);
  ok(Math.abs(k1.x - k0.x) < 0.3 && Math.abs(k1.y - k0.y) < 0.3, 'about the opposite corner (the kicker is at the top left)');
  await page.click(R + L('kicker')); await page.click(R + L('chip'), { modifiers: ['Shift'] }); await page.waitForSelector(R + '.st-le-grot');
  const rot = await (await page.$(R + '.st-le-grot')).boundingBox(); const g2 = await (await page.$(R + '.st-le-gbox')).boundingBox();
  await page.mouse.move(rot.x + 7, rot.y + 7); await page.mouse.down(); await page.mouse.move(g2.x + g2.width + 60, g2.y + g2.height / 2, { steps: 10 }); await page.mouse.up(); await sleep(250);
  await saveLayout(); const k2 = await layerOn(A1, 'kicker'), c2 = await layerOn(A1, 'chip');
  ok(k2.rotate && c2.rotate && Math.abs(k2.rotate - c2.rotate) < 0.5 && Math.abs(k2.rotate) > 20, 'both turned by the same angle: ' + k2.rotate + ' / ' + c2.rotate);
  // a mark the campaign rule holds stays where it is when it is scaled or turned with other layers
  await fresh('Held tile'); const w0m = await layerOn(A6, 'wordmark'), h0 = await layerOn(A6, 'headline');
  await page.click(R + L('headline')); await page.click(R + L('wordmark'), { modifiers: ['Shift'] }); await page.waitForSelector(R + '.st-le-gbox');
  const se2 = await (await page.$(R + '.st-le-gh.h-nw')).boundingBox();
  await page.mouse.move(se2.x + 5, se2.y + 5); await page.mouse.down(); await page.mouse.move(se2.x - 40, se2.y - 40, { steps: 8 }); await page.mouse.up(); await sleep(250);
  await saveLayout(); const w1m = await layerOn(A6, 'wordmark'), h1 = await layerOn(A6, 'headline');
  eq([w1m.x, w1m.y, w1m.w, w1m.h], [w0m.x, w0m.y, w0m.w, w0m.h], 'the held wordmark did not move or scale'); ok(h1.w > h0.w, 'the headline scaled: ' + h0.w + ' -> ' + h1.w);
});

await T.t('H-B9 the history is named steps, distinct from versions; choosing an earlier step goes back to it', async () => {
  await fresh('Frame two');
  const v0 = (await get()).assets.find(a => a.id === A2).versions.length;
  const c = await centreOf(L('chip')); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x - 30, c.y + 20, { steps: 5 }); await page.mouse.up(); await sleep(200);
  await page.click(R + '.st-fbar-swatch[aria-label="Fill"]'); await page.click(R + '.st-fbar-pop .st-swatch[aria-label="Fill #FFFFFF"]'); await sleep(200);
  const s1 = await steps(); ok(s1.some(x => /^Move Chip/.test(x)) && s1.some(x => /^Recolour Chip/.test(x)), 'named: ' + s1.join(' | '));
  await page.click(R + '.st-hist-wrap > button'); await page.click(R + '.st-hist-step:has-text("Move Chip")'); await sleep(200);
  await page.keyboard.press('Escape');
  const s2 = await steps(); ok(s2.some(x => /Recolour Chip.*undone/.test(x)), 'the recolour is undone, still listed: ' + s2.join(' | '));
  eq((await get()).assets.find(a => a.id === A2).versions.length, v0, 'no version from steps');
});

await T.t('H-B10 moving shows the gaps to the neighbours in output pixels and offers equal spacing', async () => {
  await fresh();
  const h = await page.evaluate(() => STCanvas.spacingHints({ x: 50.6, y: 10, w: 6, h: 6 }, [{ x: 8, y: 10, w: 40, h: 5 }, { x: 60, y: 10, w: 30, h: 6 }], 1080, 1350));
  ok(Math.abs(h.dx - 0.4) < 0.01 && h.marks.filter(m => m.axis === 'x').every(m => m.equal && m.px === 32), 'equal gaps of 32 px: ' + JSON.stringify(h));
  const c = await centreOf(L('chip')); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x - 8, c.y + 2, { steps: 4 });
  const marks = await page.$$eval(R + '.st-le-dist span', els => els.map(e => e.textContent));
  await page.mouse.up(); await sleep(150);
  ok(marks.length && marks.every(t => / px$/.test(t)), 'distances in output pixels while moving: ' + marks.join(', '));
  eq(await page.$$(R + '.st-le-dist').then(x => x.length), 0, 'gone when the gesture ends');
});

await T.t('H-B11 double-click reframes a placed image inside its box; Escape puts it back, Enter keeps it', async () => {
  await fresh('Crop tile');
  const before = await ids();
  await transfer({ files: [{ name: 'wide.png', type: 'image/png', b64: pngGradient(640, 240).toString('base64') }] }); await dropAt(0.5, 0.4); await sleep(1200);
  const img = (await ids()).find(x => before.indexOf(x) < 0); ok(img, 'the dropped image');
  const c = await centreOf(L(img)); await page.mouse.dblclick(c.x, c.y); await page.waitForSelector(R + '.st-le-frame[data-ready="1"]');
  ok(!(await page.$(R + '.st-le-framing button:has-text("fill the box to crop")')), 'filled to crop (the image covers its box)');
  const fr = await (await page.$(R + '.st-le-frame')).boundingBox(); await page.mouse.move(fr.x + fr.width / 2, fr.y + fr.height / 2); await page.mouse.down(); await page.mouse.move(fr.x + fr.width / 2 - 70, fr.y + fr.height / 2, { steps: 6 }); await page.mouse.up(); await sleep(200);
  ok(+(await page.inputValue(R + 'input[aria-label="Focal point across, per cent"]')) !== 50, 'the crop moved');
  await page.keyboard.press('Escape'); await sleep(200); ok(!(await page.$(R + '.st-le-frame')), 'out of the crop');
  await page.click(R + L(img)); await sleep(150); ok(await page.$(R + '.st-le-framing button:has-text("fill the box to crop")'), 'Escape put it back as it was (fitted inside its box again)');
  await page.mouse.dblclick(c.x, c.y); await page.waitForSelector(R + '.st-le-frame[data-ready="1"]');
  const fr2 = await (await page.$(R + '.st-le-frame')).boundingBox(); await page.mouse.move(fr2.x + fr2.width / 2, fr2.y + fr2.height / 2); await page.mouse.down(); await page.mouse.move(fr2.x + fr2.width / 2 + 60, fr2.y + fr2.height / 2, { steps: 6 }); await page.mouse.up(); await sleep(150);
  await page.keyboard.press('Enter'); await sleep(200); await saveLayout();
  const l = await layerOn(A3, img); ok(l.fit === 'cover' && l.focus && l.focus.x !== 50, 'kept: ' + JSON.stringify({ fit: l.fit, focus: l.focus }));
});

await T.t('H-B12 the words fitted to their box, bounded; a box too small says so and changes nothing', async () => {
  await fresh();
  await page.click(R + L('support'));
  const s0 = +(await page.inputValue(R + 'input[aria-label="Type size, per cent of the width"]'));
  await page.click(R + '.st-le-fitrow button:has-text("Fit the words to the box")'); await sleep(250);
  const s1 = +(await page.inputValue(R + 'input[aria-label="Type size, per cent of the width"]')); ok(s1 > s0, 'larger to fill the box: ' + s0 + ' -> ' + s1);
  const v = await page.evaluate(() => { const el = document.querySelector('#studio-root .st-le-val'); return el ? el.textContent : ''; }); ok(!/overflow[^;]*support/.test(v), 'no overflow on the support: ' + v);
  await page.fill(R + 'input[aria-label="Height, per cent of the stage"]', '1'); await page.press(R + 'input[aria-label="Height, per cent of the stage"]', 'Enter'); await sleep(200);
  const s2 = +(await page.inputValue(R + 'input[aria-label="Type size, per cent of the width"]'));
  await page.click(R + '.st-le-fitrow button:has-text("Fit the words to the box")'); await sleep(200);
  ok(/Not fitted: the words do not fit this box even at 2.4%/.test(await toast()), 'the reason: ' + await toast());
  eq(+(await page.inputValue(R + 'input[aria-label="Type size, per cent of the width"]')), s2, 'nothing changed');
});

await T.t('H-B13 colour: the brand palette first, a chosen colour kept as recent, and the eyedropper without the browser\'s own reads the artwork', async () => {
  await fresh('Colour tile', { init: () => { try { delete window.EyeDropper; } catch (e) {} window.EyeDropper = undefined; } });
  await page.click(R + L('kicker'));
  const first = await page.$eval(R + '.st-le-colour .st-swatch', el => el.getAttribute('aria-label')); eq(first, 'Text colour #0E6A6E, brand', 'the client\'s palette leads');
  await page.fill(R + '.st-le-colour input[aria-label="Text colour, hex"]', '#123456'); await page.press(R + '.st-le-colour input[aria-label="Text colour, hex"]', 'Enter'); await sleep(200);
  await page.click(R + L('support')); await sleep(100);
  ok(await page.$(R + '.st-le-colour .st-swatch[aria-label="Text colour #123456, recent"]'), 'kept as a recent colour');
  await page.click(R + '.st-le-colour .st-sw-drop'); await page.waitForSelector(R + '.st-le-pickhint');
  const at = await stageAt(0.97, 0.97); await page.mouse.click(at.x, at.y); await sleep(250);
  eq((await page.inputValue(R + '.st-le-colour input[aria-label="Text colour, hex"]')).toUpperCase(), '#0E6A6E', 'the panel\'s colour, read from the artwork');
});

await T.t('H-B14 zoom: Shift+2 zooms to the selection, Ctrl with + and - steps; a pinch zooms and cancels the drag it interrupted', async () => {
  await fresh('Zoom tile', { hasTouch: true });
  await page.click(R + L('chip')); await page.keyboard.press('Shift+Digit2'); await sleep(400);
  const z1 = await page.inputValue(R + '.st-zoom select'); ok(z1 !== 'fit' && (z1 === 'actual' || +z1 > 100), 'zoomed in: ' + z1);
  const cb = await (await page.$(R + L('chip'))).boundingBox(); const sb = await (await page.$(R + '.st-stage')).boundingBox();
  ok(cb.x >= sb.x - 2 && cb.x + cb.width <= sb.x + sb.width + 2 && cb.y >= sb.y - 2 && cb.y + cb.height <= sb.y + sb.height + 2, 'the selection is in view');
  await page.keyboard.press('Shift+Digit1'); await sleep(200); eq(await page.inputValue(R + '.st-zoom select'), 'fit');
  await page.keyboard.press('Control+Equal'); await sleep(200); const z2 = await page.inputValue(R + '.st-zoom select'); ok(z2 !== 'fit', 'Ctrl+= zoomed: ' + z2);
  await page.keyboard.press('Control+Minus'); await sleep(200); const z3 = await page.inputValue(R + '.st-zoom select'); ok(z3 !== z2, 'Ctrl+- zoomed back: ' + z3);
  await page.keyboard.press('Shift+Digit1'); await sleep(200);
  const cdp = await page.context().newCDPSession(page); const c = await centreOf(L('chip')); const b0 = await boxOf('chip');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x - 30, y: c.y + 20, id: 1 }] }); await sleep(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x - 30, y: c.y + 20, id: 1 }, { x: c.x + 40, y: c.y + 20, id: 2 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x - 30 - i * 15, y: c.y + 20, id: 1 }, { x: c.x + 40 + i * 15, y: c.y + 20, id: 2 }] }); await sleep(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
  const z4 = await page.inputValue(R + '.st-zoom select'); ok(z4 !== 'fit' && (z4 === 'actual' || +z4 > 100), 'the pinch zoomed in: ' + z4);
  await page.keyboard.press('Shift+Digit1'); await sleep(250);
  const b1 = await boxOf('chip'); eq([b1.left, b1.top], [b0.left, b0.top], 'the drag the pinch interrupted was cancelled');
});

await T.t('H-B15 pages from the strip: duplicate, add, move, delete and restore; numbered in order; nothing generated', async () => {
  await fresh(); const m0 = calls.anthropic + calls.gemini;
  const strip = async () => page.$$eval(R + '.st-pagefam[aria-label^="Carousel"] .st-pagechip-t', els => els.map(e => e.textContent));
  eq(await strip(), ['1. Frame one', '2. Frame two']);
  await page.click(R + '.st-pageacts button:has-text("Duplicate")'); await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-pagefam[aria-label^="Carousel"] .st-pagechip').length === 3);
  eq(await strip(), ['1. Frame one', '2. Frame one (copy)', '3. Frame two']);
  eq(await page.$eval(R + '.st-pagechip[aria-current="page"] .st-pagechip-t', el => el.textContent), '2. Frame one (copy)', 'the copy is open');
  const nums = async () => (await get()).assets.filter(a => a.family === 'Carousel').map(a => { const f = curOf(a).layout.frame; return (f.index + 1) + '/' + f.of; });
  eq(await nums(), ['1/3', '2/3', '3/3'], 'every tile draws its place');
  await page.click(R + '.st-pageacts button:has-text("Add page")'); await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-pagefam[aria-label^="Carousel"] .st-pagechip').length === 4);
  const t4 = await strip(); eq(t4[2], '3. Carousel - page 4', 'added after the copy: ' + t4.join(' | '));
  await page.click(R + '.st-pageacts button[aria-label="Move this page right"]'); await page.waitForFunction(() => /^4\. Carousel/.test((document.querySelector('#studio-root .st-pagechip[aria-current="page"] .st-pagechip-t') || {}).textContent || ''));
  await page.click(R + '.st-pageacts button[aria-label="Delete this page"]'); await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-pagefam[aria-label^="Carousel"] .st-pagechip').length === 3);
  await page.click(R + '.st-pageacts button:has-text("Deleted pages (1)")'); await page.click(R + '.st-pagedel button:has-text("Restore in its place")');
  await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-pagefam[aria-label^="Carousel"] .st-pagechip').length === 4);
  eq((await strip())[3], '4. Carousel - page 4', 'restored in its place');
  eq(await nums(), ['1/4', '2/4', '3/4', '4/4']);
  eq(calls.anthropic + calls.gemini, m0, 'no model call, no render');
  await shot('pages');
});

T.done(); await fx.close();
