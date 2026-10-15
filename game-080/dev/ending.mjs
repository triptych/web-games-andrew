/**
 * ending.mjs — the last stretch in a real browser: fast-forward a new game with the bot until it
 * reaches the Undercroft, then let the in-page autoplay bot (which waits for the real dialogue box
 * and battle director like a person) calm the Blot. Passes if the ending screen appears with no
 * console or page errors. Screenshots: dev/shots/end-blot.png, end-screen.png, end-after.png.
 *
 *   python3 -m http.server 8080          # repo root
 *   node game-080/dev/ending.mjs         # SEED=11 by default; takes a few minutes under SwiftShader
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8080';
const SEED = +(process.env.SEED || 11);
const shot = (n) => path.join(HERE, 'shots', n);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${BASE}/game-080/index.html?debug=1&fast=10`);
await page.waitForFunction(() => window.__el);
await page.evaluate((s) => { __el.start(s); __el.ff(99999, { until: (G) => G.map === 'undercroft' }); }, SEED);
console.log('reached', await page.evaluate(() => ({ map: __el.G.map, books: __el.G.books.length, lvl: __el.G.lvl, gameMin: Math.round(__el.G.t / 60) })));
await page.evaluate(() => __el.autoplay(true));
let shotBattle = false, ended = false;
for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => ({ ending: !document.getElementById('ending').hidden, boss: __el.G.battle?.boss, round: __el.G.battle?.round }));
    if (s.boss === 'blot' && !shotBattle) { await page.waitForTimeout(2500); await page.screenshot({ path: shot('end-blot.png') }); shotBattle = true; }
    if (s.ending) { ended = true; await page.waitForTimeout(800); await page.screenshot({ path: shot('end-screen.png') }); console.log(`ending after ${i} s`); break; }
}
await page.evaluate(() => { __el.autoplay(false); document.getElementById('ending-go')?.click(); });
await page.waitForTimeout(1500);
await page.screenshot({ path: shot('end-after.png') });
const won = await page.evaluate(() => !!__el.G.flags.won);
await browser.close();
const ok = ended && won && !errs.length;
console.log(ok ? 'ok the Blot is calmed, the ending shows, and Marigold is home' : `FAIL ended=${ended} won=${won} errors=${JSON.stringify(errs.slice(0, 5))}`);
process.exit(ok ? 0 : 1);
