/**
 * preview.mjs — the 1200×630 share and Garden Library picture: a Sunspire board at golden hour with
 * two heroes standing on it (one has just bound her row to the Prism oath), the Fallen Seraph on the
 * dais, the HUD tidied away.
 *
 * The generic dev/screenshots.mjs photographs the title screen; this one sets a battle up through the
 * debug hooks and waits for the board to settle before shooting. It writes dev/shots/preview.jpg; copy
 * it to garden/img/games/game-108.jpg, then `ONLY=game-108 node dev/add-meta.mjs`.
 *
 *   python3 -m http.server 8108          # from the REPO ROOT
 *   node game-108/dev/preview.mjs [seed] [stage 0-17]
 *   cp game-108/dev/shots/preview.jpg garden/img/games/game-108.jpg
 *
 * Env: BASE (default http://127.0.0.1:8108), THREE_PKG, PW_CHROMIUM_PATH, WAIT (ms after settling).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8108';
const [seed = '11', stage = '14'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-108/index.html?debug=1&fast=8`);
await page.waitForFunction(() => window.__os, null, { timeout: 60000 });
await page.evaluate(([s, st]) => {
    __os.start(s);
    const G = __os.G;
    G.progress = 17;
    for (const id of ['aurelia', 'nyx', 'vesper', 'lyra']) G.roster[id] = { lv: 12, xp: 0, rank: 1 };
    G.party = ['aurelia', 'nyx', 'vesper', 'lyra'];
    G.calls = ['nyx', 'thalos'];
    __os.fight(st);
    // the second hero arrives on the first refill
    G.B.callIn = 0;
}, [+seed, +stage]);
await page.waitForFunction(() => __os.ready, null, { timeout: 120000, polling: 200 });
// two bot moves: the second hero is called after the first and falls in on the next refill
await page.evaluate(() => __os.ff(1));
await page.waitForFunction(() => __os.ready, null, { timeout: 120000, polling: 200 });
await page.evaluate(() => __os.ff(1));
await page.waitForFunction(() => __os.ready, null, { timeout: 120000, polling: 200 });
await page.evaluate(() => {
    document.getElementById('hud').hidden = true;
    document.getElementById('back-link').style.display = 'none';
    document.getElementById('floats').innerHTML = '';
    __os.view.setPad({ top: 10, bottom: 10, left: 0, right: 0 });
});
await page.waitForTimeout(+(process.env.WAIT || 3000));
await page.screenshot({ path: path.join(HERE, 'shots', 'preview.jpg'), type: 'jpeg', quality: 88 });
console.log('wrote game-108/dev/shots/preview.jpg');
await browser.close();
