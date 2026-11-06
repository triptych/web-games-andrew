/**
 * preview.mjs — the 1200×630 preview for the Garden's library and share links.
 *   node game-122/dev/preview.mjs        → garden/img/games/game-122.jpg
 * Sets up a moment through the debug hooks: dusk on the heath, the cursed castle ahead, a Kindle
 * seal burning, Nib at your side, the Focus glowing in your hand.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PKG = [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8122';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-122/index.html?debug=1&q=high`);
await page.waitForFunction(() => window.__ww, null, { timeout: 90000 });
await page.evaluate(() => {
    __ww.start(31, 'Rowan');
    const G = __ww.G, L = G.laws;
    G.hasWand = true; G.glyphs = L.glyphs.map((g) => g.id);
    for (const r in L.reagents) G.bag[r] = 4;
    G.tod = 0.535;
    __ww.put(-1, 86, 0.5, 0.1);
    const kr = Object.keys(L.reagents).find((r) => L.reagents[r].essence === 'kindle');
    const fire = L.order === 'shape-first' ? [L.glyphOf.seal, L.glyphOf.kindle] : [L.glyphOf.kindle, L.glyphOf.seal];
    G.p.yaw = 0.7;
    __ww.act({ t: 'inscribe', slot: 0, glyphs: fire, feed: fire.map((g) => (g === L.glyphOf.kindle ? kr : null)), n: 2 });
    __ww.act({ t: 'cast' });
    __ww.put(-6, 96, 0.08, 0.1);
    const lr = Object.keys(L.reagents).find((r) => L.reagents[r].essence === 'lumen');
    const sp = L.order === 'shape-first' ? [L.glyphOf.bolt, L.glyphOf.lumen] : [L.glyphOf.lumen, L.glyphOf.bolt];
    __ww.act({ t: 'inscribe', slot: 1, glyphs: sp, feed: sp.map((g) => (g === L.glyphOf.lumen ? lr : null)), n: 3 });
    __ww.act({ t: 'select', slot: 1 });
    G.notes.glyphs[L.glyphOf.lumen] = { essence: 'lumen', not: [] }; G.notes.colors.lumen = L.color.lumen;
    G.nib.mode = 'follow'; G.nib.x = -4.6; G.nib.z = 92.6; G.nib.y = __ww.view.W.height(-4.6, 92.6); G.nib.yaw = 2.6;
    for (const id of ['hud', 'toasts', 'back-link']) document.getElementById(id).style.visibility = 'hidden';
});
await page.waitForTimeout(6000);
const out = path.join(ROOT, 'garden/img/games/game-122.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 86, timeout: 180000 });
console.log('wrote', path.relative(ROOT, out));
await browser.close();
