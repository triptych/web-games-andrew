import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.join(HERE, 'package');
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const LV = +(process.env.LV ?? 0);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); const f = path.join(PKG, rel); if (!fs.existsSync(f)) return route.abort(); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type(), m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('pageerror', e.message, e.stack?.slice(0, 600)));
await page.goto('http://127.0.0.1:8054/game-054/index.html?debug=1');
await page.waitForFunction(() => window.__pe && window.__pe.state() === 'title', null, { timeout: 90000 });
await page.evaluate((lv) => __pe.start(1, lv), LV);
await page.waitForFunction(() => __pe.game.cardReady, null, { timeout: 90000 });
await page.evaluate(() => __pe.begin());
await page.waitForTimeout(500);
const groups = (process.env.ARCH ?? 'husk,imp,hound,wisp|gazer,skitter,brute,revenant|hierophant,juggernaut,pylon|overseer|mother|archon').split('|');
let gi = 0;
for (const g of groups) {
  const res = await page.evaluate((list) => {
    const S = __pe.S, P = __pe.player;
    __pe.god(true);
    for (const m of S.monsters) { m.remove(); }
    S.monsters.length = 0;
    // find the biggest room and stand at one end of it
    const L = S.L;
    const r = [...L.rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const cx = (r.x + r.w / 2) * 2, cz = (r.y + r.h / 2) * 2;
    P.x = cx; P.z = cz + 3; P.y = L.floor[S.world.cellAt(P.x, P.z)];
    P.yaw = 0; P.pitch = /overseer|mother|archon/.test(list) ? 0.25 : 0.0;
    const arr = list.split(',');
    const big = arr.some((a) => ['overseer', 'mother', 'archon'].includes(a));
    arr.forEach((a, i) => {
      const x = cx + (i - (arr.length - 1) / 2) * (big ? 0 : 2.4);
      const z = P.z - (big ? 11 : 6);
      const m = S.spawnMonster(a, x, z, { angle: Math.PI, counted: false });
      m.yaw = Math.PI; m.awake = false; m._place();
    });
    S.demo = true;
    return { room: r.w + 'x' + r.h };
  }, g);
  await page.waitForTimeout(1200);
  await page.evaluate(() => { __pe.S.demo = false; });
  await page.screenshot({ path: `${OUT}/gallery_${gi++}.png` });
  console.log(g, res);
}
await browser.close();
