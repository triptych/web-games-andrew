import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.join(HERE, 'package');
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); const f = path.join(PKG, rel); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('http://127.0.0.1:8054/game-054/index.html?debug=1&seed=5');
await page.waitForFunction(() => window.__pe && __pe.state() === 'title', null, { timeout: 90000 });
await page.evaluate(() => __pe.start(1, 0));
await page.waitForFunction(() => __pe.game.cardReady, null, { timeout: 90000 });
await page.evaluate(() => { __pe.begin(); __pe.god(true); document.getElementById('hud').hidden = true; });
const rows = [['stim','medkit','vial','soul','shard','vest','mega'], ['clip','ammobox','shells','shellbox','rocket1','rocketbox','cell','cellpack'], ['backpack','berserk','overdrive','haste','invuln','cloak','suit','surveyor'], ['key_blue','key_yellow','key_red','w_shotgun','w_ssg','w_chaingun','w_rocket','w_plasma','w_rail','w_bfg']];
let i = 0;
for (const row of rows) {
  await page.evaluate((row) => {
    const S = __pe.S, P = __pe.player, L = S.L;
    for (const m of S.monsters) m.remove(); S.monsters.length = 0;
    for (const p of S.pickups) { S.root.remove(p.group); p.taken = true; }
    const r = [...L.rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const cx = (r.x + r.w / 2) * 2, cz = (r.y + r.h / 2) * 2;
    P.x = cx; P.z = cz + 4; P.y = L.floor[S.world.cellAt(P.x, P.z)]; P.yaw = 0; P.pitch = -0.25;
    row.forEach((id, k) => { const p = S._addPickup(id, cx + (k - (row.length - 1) / 2) * 0.9, cz + 1.2); p.taken = true; });
  }, row);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/pick_${i++}.png`, clip: { x: 160, y: 250, width: 960, height: 330 } });
}
await browser.close();
