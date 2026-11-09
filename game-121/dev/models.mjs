/**
 * models.mjs — every Meshy character, seated across the table, one screenshot each (and a contact sheet).
 *
 *   node game-121/dev/models.mjs                      # all eleven
 *   NAMES=marta,caspian node game-121/dev/models.mjs
 *   MODE=walk node game-121/dev/models.mjs            # standing at the door instead of seated
 *   W=390 H=844 TOUCH=1 SUFFIX=-phone node game-121/dev/models.mjs
 *
 * It starts a game, then overrides View.wanted() so a chosen model is the guest, and waits for it to arrive. Screenshots
 * go to dev/shots/models/<name><SUFFIX>.png. Software WebGL is slow, so each one waits a few real seconds.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8121';
const W = +(process.env.W || 1280), H = +(process.env.H || 760), TOUCH = process.env.TOUCH === '1', SUF = process.env.SUFFIX || '';
const NAMES = (process.env.NAMES || 'marta,pip,elias,mirabel,stranger,oswin,wren,hester,bram,seraphine,caspian').split(',');
const MODE = process.env.MODE || 'seat';
const OUT = path.join(HERE, 'shots', 'models'); fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: TOUCH, isMobile: TOUCH })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
let bad = 0;
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { bad++; console.log(`[${m.type()}]`, m.text()); } });
page.on('pageerror', (e) => { bad++; console.log('[pageerror]', e.message); });
await page.goto(`${BASE}/game-121/index.html?debug=1&fast=1`);
await page.waitForFunction(() => window.__aw, null, { timeout: 90000 });
await page.evaluate(() => { __aw.start(11); __aw.playTo((G) => G.phase === 'ready'); });
await page.evaluate(() => { document.querySelector('#tip-close')?.click(); });

for (const name of NAMES) {
    await page.evaluate(({ name, mode }) => {
        const v = __aw.view;
        if (v.person) { v.scene.remove(v.person.p.group); v.person.p.dispose(); v.person = null; }   // the previous guest leaves
        v.wanted = () => ({ key: 'c:' + name, look: { model: name, skin: '#e2b894', hair: '#222', robe: '#555', body: 'tall' }, go: mode === 'walk' ? 0.4 : 1 });
    }, { name, mode: MODE });
    // wait until the model has loaded (and been swapped in), seated, and the walk has finished
    await page.waitForFunction((want) => { const P = __aw.view.person; return P && P.p.model && P.u >= want; }, MODE === 'walk' ? 0.39 : 0.999, { timeout: 120000, polling: 250 }).catch(() => {});
    await page.waitForTimeout(MODE === 'walk' ? 800 : 1800);
    const info = await page.evaluate(() => ({ model: !!__aw.view.person?.p.model, u: +(__aw.view.person?.u ?? -1).toFixed(2) }));
    const file = path.join(OUT, `${name}${SUF}.png`);
    await page.screenshot({ path: file, timeout: 180000 });
    console.log(name, JSON.stringify(info), path.relative(process.cwd(), file));
}
await browser.close();
if (bad) { console.log(bad, 'console problems'); process.exit(1); }
