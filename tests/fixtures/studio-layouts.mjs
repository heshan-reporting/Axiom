/* Layout fixtures for the Studio renderer and validation tests.
 * HOOF_REPRO is a RECONSTRUCTION of the HOOF tile reported on 1 October 2026 (headline "A new tax on the people who grow
 * our food" overlapping its support line, a blue wordmark low on contrast). The original asset and version were not
 * retrievable from the build sandbox (the live worker is unreachable from it), so the geometry here is read off the
 * screenshot: a 4:5 plan layout with a gold kicker, a rule, a three-line headline in a box sized for two, the support
 * line placed straight after it, a gold CTA button and the wordmark bottom right over a dark scrim. It is a fixture,
 * not the client's asset. */
export const HOOF_COPY = { headline: 'A new tax on the people who grow our food', support: 'Fuel tax credits are not a subsidy. They return a road tax never meant to apply to fuel used off-road.', cta: 'Sign the petition', caption: 'Not a subsidy.' };
export const HOOF_REPRO = {
  v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'photo-cinematic', mediumName: 'cinematic photography', approach: 'editable', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a farmer at a diesel tank at dawn', refs: [] }],
  palette: { primary: '#0E6A6E' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, marks: { policy: 'wordmark', campaign: 'hoof' }, markPlacement: { corner: 'br', basis: 'default' }, incomplete: [], unsupported: [],
  layers: [
    { id: 'scrim', type: 'shape', role: 'overlay', shape: 'rect', x: 0, y: 44, w: 100, h: 56, fill: 'rgba(6,10,16,0.92)', gradient: true, dir: 'up', opacity: 1 },
    { id: 'kicker', type: 'text', role: 'kicker', text: 'ACTIVISTS ARE TARGETING FUEL TAX CREDITS', x: 6, y: 58.6, w: 86, h: 3, size: 2.4, weight: 700, color: '#E8B23A', align: 'left', font: 'body', letterSpacing: 0.08 },
    { id: 'rule', type: 'shape', role: 'device', shape: 'rule', x: 6, y: 63.3, w: 14, h: 0.5, fill: '#E8B23A' },
    { id: 'headline', type: 'text', role: 'headline', x: 6, y: 64.6, w: 76, h: 12, size: 6.8, weight: 800, color: '#FFFFFF', align: 'left', font: 'display' },
    { id: 'support', type: 'text', role: 'support', x: 6, y: 80.8, w: 82, h: 6.4, size: 2.9, weight: 500, color: '#FFFFFF', align: 'left', font: 'body' },
    { id: 'cta', type: 'text', role: 'cta', x: 6, y: 88.6, w: 32, h: 4.6, size: 2.6, weight: 700, color: '#141414', bg: '#E8B23A', align: 'center', font: 'body' },
    { id: 'wordmark', type: 'img', role: 'wordmark', asset: 'wordmark', campaign: 'hoof', x: 71, y: 88, w: 23, h: 6, src: '/brand/wordmark?ns=mca&campaign=hoof&variant=blue&v=b1', exact: true, variants: [{ variant: 'blue', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=blue&v=b1', tone: 'colour' }, { variant: 'white', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=w1', tone: 'light' }, { variant: 'black', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=black&v=k1', tone: 'dark' }] },
  ],
};
/* HOOF_STRADDLE is a RECONSTRUCTION of the tile reported on 5 October 2026 (the second screenshot): a cream fact panel above
 * a dark green footer, the white HOOF wordmark placed so its ink crosses the panel/footer boundary (the upper lettering on
 * cream, unreadable; the lower on green), a small information label at the top, the CTA a filled chip that also carries a
 * box emphasis (the "wide outline" seen round the button), and the headline and URL on the panel. Again the asset itself was
 * not retrievable from the sandbox; the geometry is read off the screenshot. It is a fixture, not the client's asset. The
 * footer here is a LIVE shape (so the correction can move the mark into it); the bitmap-footer case is made in the harness
 * by painting the footer into the photograph instead. */
export const HOOF_STRADDLE_COPY = { headline: 'Fuel tax credits are not a subsidy', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Get the facts', caption: 'Not a subsidy.' };
export const HOOF_STRADDLE = {
  v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image', refs: [] }],
  palette: { primary: '#1E5B3A' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, marks: { policy: 'wordmark', campaign: 'hoof' }, markPlacement: { corner: 'bl', basis: 'default' }, incomplete: [], unsupported: [],
  layers: [
    { id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 0, y: 46, w: 100, h: 40, fill: '#F2EBDD', opacity: 1, radius: 0 },
    { id: 'footer', type: 'shape', role: 'footer', shape: 'rect', x: 0, y: 86, w: 100, h: 14, fill: '#1E5B3A', opacity: 1, radius: 0 },
    { id: 'label', type: 'text', role: 'label', text: 'MYTH', x: 6, y: 48.5, w: 20, h: 3.2, size: 2.2, weight: 700, color: '#1E5B3A', align: 'left', font: 'mono', letterSpacing: 0.12 },
    { id: 'headline', type: 'text', role: 'headline', x: 6, y: 53, w: 88, h: 14, size: 6.4, weight: 800, color: '#14281C', align: 'left', font: 'display' },
    { id: 'support', type: 'text', role: 'support', x: 6, y: 68.5, w: 86, h: 6.4, size: 2.9, weight: 500, color: '#2B3A30', align: 'left', font: 'body' },
    { id: 'cta', type: 'text', role: 'cta', x: 6, y: 77, w: 40, h: 4.6, size: 2.5, weight: 700, color: '#FFFFFF', bg: '#1E5B3A', emphasis: 'box', emphasisColor: '#1E5B3A', align: 'left', font: 'body' },
    { id: 'url', type: 'text', role: 'free', text: 'handsoffourfuel.com.au', x: 6, y: 91.5, w: 40, h: 3, size: 2.1, weight: 600, color: '#FFFFFF', align: 'left', font: 'body' },
    { id: 'wordmark', type: 'img', role: 'wordmark', asset: 'wordmark', campaign: 'hoof', x: 62, y: 81.5, w: 32, h: 9, src: '/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=w1', exact: true, variants: [{ variant: 'white', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=w1', tone: 'light' }, { variant: 'blue', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=blue&v=b1', tone: 'colour' }, { variant: 'black', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=black&v=k1', tone: 'dark' }] },
  ],
};
/** A deterministic mark for pixel arithmetic: two solid bars (rows 10-50 and 70-110 of a 480 x 120 canvas, columns 8-472), so a
 *  test can compute how much ink lies above a boundary from the geometry alone. `colours` paints the left half in the first
 *  colour and the right half in the second (a multicolour mark) when two are given. */
export const BARS_SCRIPT = (colours) => `(() => { const c = document.createElement('canvas'); c.width = 480; c.height = 120; const x = c.getContext('2d'); const cols = ${JSON.stringify([].concat(colours))}; const draw = (x0, x1) => { x.fillRect(x0, 10, x1 - x0, 40); x.fillRect(x0, 70, x1 - x0, 40); }; if (cols.length > 1) { x.fillStyle = cols[0]; draw(8, 240); x.fillStyle = cols[1]; draw(240, 472); } else { x.fillStyle = cols[0]; draw(8, 472); } return c.toDataURL('image/png'); })()`;
export const BARS_INK = { x0: 8, x1: 472, w: 480, h: 120, rows: [[10, 50], [70, 110]] };
/** A synthetic photograph with a flat dark footer painted INTO the image (the bitmap-footer case): cream above y = 86%. */
export const PHOTO_FOOTER_SCRIPT = `(() => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d'); x.fillStyle = '#F2EBDD'; x.fillRect(0, 0, 1080, 1350); const g = x.createLinearGradient(0, 0, 0, 620); g.addColorStop(0, '#d9a26a'); g.addColorStop(1, '#8a6a4a'); x.fillStyle = g; x.fillRect(0, 0, 1080, 620); x.fillStyle = '#1E5B3A'; x.fillRect(0, 1161, 1080, 189); return c.toDataURL('image/png'); })()`;
/** A synthetic wordmark bitmap drawn in the page (the real HOOF files are client assets and are not in the repo). */
export const WORDMARK_SCRIPT = (colour) => `(() => { const c = document.createElement('canvas'); c.width = 480; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '${colour}'; x.font = '900 46px sans-serif'; x.textBaseline = 'top'; x.fillText('HANDS OFF', 8, 6); x.fillText('OUR FUEL', 8, 60); return c.toDataURL('image/png'); })()`;
/** A synthetic dawn photograph: warm sky, dark field (not real imagery). */
export const PHOTO_SCRIPT = `(() => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, '#d9a26a'); g.addColorStop(0.45, '#8a6a4a'); g.addColorStop(0.6, '#2b2a22'); g.addColorStop(1, '#14130f'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350); x.fillStyle = '#3a4a3a'; x.fillRect(560, 520, 420, 380); x.fillStyle = '#6b5a48'; x.beginPath(); x.arc(760, 420, 70, 0, 7); x.fill(); return c.toDataURL('image/jpeg', 0.9); })()`;
