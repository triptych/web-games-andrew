/**
 * preview.mjs — the 1200×630 share and Garden Library picture: a guardian in the corridor, mid-fight.
 *
 * The generic dev/screenshots.mjs photographs the title over the town; this one sets up the picture
 * through the debug hooks. It writes dev/shots/preview.jpg; copy it to garden/img/games/game-101.jpg,
 * then `ONLY=game-101 node dev/add-meta.mjs`.
 *
 *   python3 -m http.server 8101          # from the REPO ROOT
 *   node game-101/dev/preview.mjs
 *   cp game-101/dev/shots/preview.jpg garden/img/games/game-101.jpg
 *
 * Env: BASE (default http://127.0.0.1:8101), THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8101';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (r) => {
        const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort();
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-101/index.html?debug=1&fast=4`);
await page.waitForFunction(() => window.__pc);
await page.evaluate(async () => {
    __pc.start(12);
    const G = __pc.G;
    G.maxDepth = 10;
    // a party that has been somewhere
    for (const m of G.party) { m.lvl = 9; }
    __pc.go(10);
    const f = G.floor, dn = f.feat[`${f.down.x},${f.down.y}`];
    for (const m of G.party) { const s = (await import('/game-101/js/sim/party.js')).calc(m); m.hp = Math.round(s.maxhp * 0.8); m.mp = s.maxmp; }
    __pc.act({ t: 'debugBattle', enemies: [{ ...dn.guard }], opts: { boss: true } });
});
await page.waitForFunction(() => __pc.ui.q.length === 0 && __pc.ui.wait <= 0, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(HERE, 'shots', 'preview.jpg'), type: 'jpeg', quality: 82 });
console.log('wrote dev/shots/preview.jpg');
await browser.close();
