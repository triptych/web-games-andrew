import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.join(HERE, 'package');
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const LV = +(process.env.LV ?? 2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); const f = path.join(PKG, rel); if (!fs.existsSync(f)) return route.abort(); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type(), m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('pageerror', e.message, e.stack?.slice(0, 800)));
await page.goto('http://127.0.0.1:8054/game-054/index.html?debug=1');
await page.waitForFunction(() => window.__pe && window.__pe.state() === 'title', null, { timeout: 90000 });
await page.evaluate((lv) => __pe.start(1, lv), LV);
await page.waitForFunction(() => __pe.game.cardReady, null, { timeout: 90000 });
await page.evaluate(() => { __pe.begin(); __pe.giveAll(); __pe.god(true); });
const weapons = (process.env.W ?? 'shotgun,chaingun,rocket,plasma,rail,bfg,ssg').split(',');
let n = 0;
for (const w of weapons) {
  const info = await page.evaluate((w) => {
    const S = __pe.S, P = __pe.player;
    // move into the biggest room and spawn a pack ahead
    const L = S.L;
    const r = [...L.rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const cx = (r.x + r.w / 2) * 2, cz = (r.y + r.h / 2) * 2;
    P.x = cx; P.z = cz + r.h * 0.6; P.y = L.floor[S.world.cellAt(P.x, P.z)]; P.yaw = 0; P.pitch = 0;
    for (const m of S.monsters) if (m.alive) m.die(9999, null, {});
    const pack = ['imp', 'husk', 'imp', 'brute', 'gazer'];
    pack.forEach((a, i) => { const m = S.spawnMonster(a, cx + (i - 2) * 2, P.z - 9 - (i % 2) * 2, { awake: true, counted: false }); m.wake(P); });
    __pe.weapons.select(w);
    return S.monsters.filter((m) => m.alive).length;
  }, w);
  await page.waitForTimeout(800);
  await page.evaluate(() => { __pe.input.fire = true; });
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/combat_${n}_${k}.png` });
  }
  await page.evaluate(() => { __pe.input.fire = false; });
  const res = await page.evaluate(() => ({ alive: __pe.S.monsters.filter((m) => m.alive).length, proj: __pe.S.proj.list.length, ammo: { ...__pe.player.ammo }, hp: __pe.player.health, cur: __pe.weapons.current }));
  console.log(w, info, res);
  n++;
}
await browser.close();
