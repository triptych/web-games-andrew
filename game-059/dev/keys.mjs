/** keys.mjs — play the real game with the keyboard for a few seconds and screenshot along the way. */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, '../../dev/package');
const stage = +(process.argv[2] || 0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(`http://127.0.0.1:8059/game-059/index.html?debug=1`);
await page.waitForFunction(() => window.__sc && __sc.mode === 'title', null, { timeout: 90000 });
await page.evaluate((s) => __sc.start('arcade', 'normal', s), stage);
await page.waitForFunction(() => __sc.mode === 'play', null, { timeout: 30000 });
const k = page.keyboard;
await k.down('ArrowRight'); await page.waitForTimeout(2600); await k.up('ArrowRight');
for (let r = 0; r < 14; r++) {
  // face the nearest enemy and line up depth, then attack
  const st = await page.evaluate(() => { const w = __sc.world, p = w.player; const e = w.fighters.filter(f => f.team === 'enemy' && f.state !== 'dead').sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; return e ? { dx: e.x - p.x, dz: e.z - p.z } : null; });
  if (st) {
    if (Math.abs(st.dz) > 5) { const key = st.dz > 0 ? 'ArrowUp' : 'ArrowDown'; await k.down(key); await page.waitForTimeout(Math.min(400, Math.abs(st.dz) * 12)); await k.up(key); }
    if (Math.abs(st.dx) > 34) { const key = st.dx > 0 ? 'ArrowRight' : 'ArrowLeft'; await k.down(key); await page.waitForTimeout(Math.min(500, (Math.abs(st.dx) - 26) * 8)); await k.up(key); }
    else if (Math.sign(st.dx) !== 0) { await k.press(st.dx > 0 ? 'ArrowRight' : 'ArrowLeft'); }
  }
  for (let i = 0; i < 4; i++) { await k.press('j'); await page.waitForTimeout(120); }
}
for (let i = 0; i < 12; i++) { await k.press('j'); await page.waitForTimeout(110); }
await page.screenshot({ path: path.join(HERE, 'shots', 'keys-1.png') });
await k.press('l'); await page.waitForTimeout(250);
await page.screenshot({ path: path.join(HERE, 'shots', 'keys-2.png') });
await k.down('ArrowRight'); await k.press('l'); await k.up('ArrowRight'); await page.waitForTimeout(200);
await k.press('k'); await page.waitForTimeout(150); await k.press('j'); await page.waitForTimeout(500);
for (let i = 0; i < 20; i++) { await k.press('j'); await page.waitForTimeout(90); if (i % 5 === 4) { await k.press('k'); await k.press('l'); } }
await page.screenshot({ path: path.join(HERE, 'shots', 'keys-3.png') });
const info = await page.evaluate(() => ({ mode: __sc.mode, hp: __sc.world.player.hp, x: __sc.world.player.x, kos: __sc.world.stats.kos, hits: __sc.world.stats.hits }));
console.log(JSON.stringify(info));
if (errs.length) console.log(errs.join('\n'));
await browser.close();
