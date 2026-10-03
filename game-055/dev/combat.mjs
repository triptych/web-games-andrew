/**
 * combat.mjs — close-up screenshots of combat effects: a pack of enemies is
 * spawned in front of a fully upgraded Kestrel and frames are captured as
 * they die (explosions, wrecks, craters, tracers, missiles, the EMP).
 *   node game-055/dev/combat.mjs        OP=0..5
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const OP = +(process.env.OP ?? 0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 560, height: 820 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto('http://127.0.0.1:8055/game-055/index.html?debug=1&seed=77&fast=1');
await page.waitForFunction(() => window.__rs && window.__rs.ui === 'title', null, { timeout: 90000 });
await page.evaluate(() => { const p = window.__rs.profile; p.owned = { g_dmg: 3, g_rof: 3, g_fan: 1, g_wide: 1, o_msl: 1, o_mslx: 2, o_rkt: 2, o_drone: 2, a_arm: 3, s_bomb: 2 }; });
await page.evaluate((op) => window.__rs.startOp(op), OP);
await page.evaluate(() => window.__rs.god(true));
const spawn = () => page.evaluate(() => {
    const w = window.__rs.world;
    for (let i = 0; i < 5; i++) w.spawn('gunship', 120 + i * 75, 200 + (i % 2) * 60, { mv: { type: 'hover', tx: 120 + i * 75, ty: 200 + (i % 2) * 60, hold: 30 } });
    for (let i = 0; i < 4; i++) w.director.ground('tank', 100 + i * 110, 0, 380);
});
await page.waitForTimeout(3000);
await spawn();
for (let i = 0; i < 6; i++) { await page.waitForTimeout(1600); await page.screenshot({ path: path.join(OUT, `combat${OP}-${i}.png`) }); }
await page.keyboard.press('KeyX');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, `combat${OP}-emp.png`) });
await browser.close();
