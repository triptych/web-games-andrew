/**
 * smoke.mjs — quick look: title, then a few seconds of an operation, a boss,
 * and screenshots of each. Prints console errors.
 *
 *   python3 -m http.server 8055        # from the repo root
 *   node game-055/dev/smoke.mjs        OP=0..5  W=1280 H=720  BOSS=1
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? 'http://127.0.0.1:8055';
const OP = +(process.env.OP ?? 0);
const VW = +(process.env.W ?? 1280), VH = +(process.env.H ?? 720);
const SEED = process.env.SEED ?? '1234';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-055/index.html?debug=1&seed=${SEED}&fast=${process.env.FAST ?? 6}`);
await page.waitForFunction(() => window.__rs && window.__rs.ui === 'title', null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, `title.png`) });
await page.evaluate((op) => window.__rs.startOp(op), OP);
const wait = async (sec) => { const t0 = await page.evaluate(() => window.__rs.world.t); await page.waitForFunction((t) => window.__rs.world.t > t, t0 + sec, { timeout: 120000 }); };
await page.evaluate(() => window.__rs.god(true));
await wait(6);
await page.screenshot({ path: path.join(OUT, `op${OP}-a.png`) });
await wait(8);
await page.screenshot({ path: path.join(OUT, `op${OP}-b.png`) });
if (process.env.BOSS !== '0') {
    await page.evaluate(() => window.__rs.skipToBoss());
    await page.waitForFunction(() => window.__rs.world.boss && !window.__rs.world.boss.entering, null, { timeout: 120000 });
    await wait(4);
    await page.screenshot({ path: path.join(OUT, `op${OP}-boss.png`) });
}
const probe = await page.evaluate(() => window.__rs.terrainProbe(30));
console.log('terrain probe', JSON.stringify(probe));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
