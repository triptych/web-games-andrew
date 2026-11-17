/**
 * preview.mjs — the Garden's 1200×630 preview of CLEAN SLATE: a night in progress against Lady Corvina, a few pairs
 * already settled, a card in hand chosen so its matches glow, the HUD up, no stories or toasts in the way.
 *
 *   node game-139/dev/preview.mjs [seed]          # writes garden/img/games/game-139.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8139';
const [seed = '21'] = process.argv.slice(2);
const OUT = path.join(HERE, '../../garden/img/games/game-139.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// the first-night tutorial (v1.1.0) would cover the table: start as a player who has turned it off
await page.addInitScript(() => {
    try { localStorage.setItem('clean-slate.v1.settings', JSON.stringify({ tutorial: 'off', tutorialDone: true, tips: [] })); } catch { /* ignore */ }
});
await page.goto(`${BASE}/game-139/index.html?debug=1`);
await page.waitForFunction(() => window.__cs && __cs.mode === 'title', null, { timeout: 90000 });
await page.evaluate((s) => {
    __cs.start(+s);
    __cs.skipStory();
    const G = __cs.G;
    G.night = 3; G.letters = ['corvina'];
    __cs.act({ t: 'host', id: 'corvina' });
    __cs.skipStory();
    // settle a few pairs with the bot's own moves
    for (let i = 0; i < 3; i++) { const m = __cs.legal().find((x) => x.t === "pair" && !x.a.hand && !x.b.hand) || (i === 0 && __cs.legal().find((x) => x.t === "pair")); if (m) __cs.act(m); }
}, seed);
await page.waitForTimeout(3500);
await page.evaluate(() => {
    const F = __cs.G.fight;
    const m = __cs.legal().find((x) => x.t === 'pair' && (x.a.hand || x.b.hand));
    const uid = m ? (m.a.hand || m.b.hand) : F.hand[0];
    const p = __cs.screenOf({ hand: uid });
    document.getElementById('view').dispatchEvent(new PointerEvent('pointerdown', { clientX: p.x, clientY: p.y, bubbles: true }));
    for (const id of ['toasts', 'back-link']) document.getElementById(id).style.visibility = 'hidden';
});
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();
