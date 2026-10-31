/**
 * preview.mjs — the 1200×630 share and Garden Library picture: the legion and a goblin host closing on
 * each other mid-battle, intents up and a hand of cards fanned below.
 *
 * The generic dev/screenshots.mjs photographs the title; this one sets the moment up through the debug
 * hooks (a richer legion, stacks moved toward the middle). It writes dev/shots/preview.jpg and copies
 * it to garden/img/games/game-112.jpg; then run `ONLY=game-112 node dev/add-meta.mjs`.
 *
 *   python3 -m http.server 8112          # from the REPO ROOT
 *   node game-112/dev/preview.mjs
 *
 * Env: BASE (default http://127.0.0.1:8112), THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8112';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (r) => {
        const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(f)) return r.abort();
        r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-112/index.html?debug=1`);
await page.waitForFunction(() => window.__ql);
await page.evaluate(async () => {
    const G = __ql.start(21);
    G.army.push({ key: 'griffins', count: 6, full: 6 }, { key: 'knights', count: 3, full: 3 });
    const n = G.map.nodes.find((x) => x.f === 0);
    __ql.send({ t: 'go', id: n.id });
    __ql.send({ t: 'begin' });
    const B = __ql.G.battle;
    // close the two hosts for the picture
    const spots = { p: [[3, 2], [2, 3], [3, 4], [4, 1], [2, 1]], e: [[5, 2], [5, 3], [6, 4], [7, 2]] };
    const used = { p: 0, e: 0 };
    for (const s of B.stacks) { const sp = spots[s.side][used[s.side]++]; if (sp) [s.c, s.r] = sp; }
    B.rocks = [4 * 16 + 5, 6 * 16 + 0];
    __ql.view.sync();
    __ql.play.refresh();
    await new Promise((r) => setTimeout(r, 300));
    const c = B.hand.find((x) => x.id === 'strike') || B.hand[0];
    __ql.play.onCard(c.uid);
});
await page.waitForTimeout(3500);
const out = path.join(HERE, 'shots', 'preview.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
fs.copyFileSync(out, path.join(HERE, '../../garden/img/games/game-112.jpg'));
console.log('wrote dev/shots/preview.jpg and garden/img/games/game-112.jpg');
await browser.close();
