// node dev/tour.mjs — screenshots of specific level features (doors, stairs, pits, platforms, sky) per theme
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.join(HERE, 'package'), OUT = path.join(HERE, 'shots');
const LVS = (process.env.LVS ?? '1,4,7').split(',').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto('http://127.0.0.1:8054/game-054/index.html?debug=1&seed=' + (process.env.SEED ?? 4242));
await page.waitForFunction(() => window.__pe && __pe.state() === 'title', null, { timeout: 90000 });
const files = [];
for (const lv of LVS) {
  await page.evaluate((lv) => __pe.start(1, lv), lv);
  await page.waitForFunction(() => __pe.game.cardReady, null, { timeout: 90000 });
  await page.evaluate(() => { __pe.begin(); __pe.god(true); document.getElementById('hud').hidden = true; __pe.S.demo = true; for (const m of __pe.S.monsters) m.awake = false; });
  const spots = await page.evaluate(() => {
    const S = __pe.S, L = S.L, W = L.W;
    const out = [];
    const cc = (i) => [((i % W) + 0.5) * 2, (((i / W) | 0) + 0.5) * 2];
    // a door seen from 4 m back down its corridor
    // view a door from inside its room, 4 m back
    const backFrom = (d) => { for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = d.cell + dx + dz * W; if (L.region[n] === d.room) return [dx, dz]; } return [0, 1]; };
    const d = L.doors.find((q) => !q.secret && !q.key) ?? L.doors[0];
    if (d) out.push({ name: 'door', at: cc(d.cell), back: backFrom(d) });
    const k = L.doors.find((q) => q.key);
    if (k) out.push({ name: 'keydoor', at: cc(k.cell), back: backFrom(k) });
    // rooms with features
    for (const f of ['pit', 'platform', 'dais', 'crates', 'pillars']) {
      const r = L.rooms.find((q) => q.feature.includes(f) && q.kind !== 'start');
      if (r) out.push({ name: f, room: [r.x, r.y, r.w, r.h] });
    }
    const sky = L.rooms.find((q) => q.sky);
    if (sky) out.push({ name: 'sky', room: [sky.x, sky.y, sky.w, sky.h], up: true });
    // a stair corridor
    const c = L.corridors.find((q) => Math.abs(L.rooms[q.a].floor - L.rooms[q.b].floor) >= 1);
    if (c) out.push({ name: 'stairs', at: cc(c.cells[0]), look: cc(c.cells[c.cells.length - 1]) });
    return out;
  });
  for (const sp of spots) {
    await page.evaluate((sp) => {
      const S = __pe.S, L = S.L, P = __pe.player;
      if (sp.room) {
        const [x, y, w, h] = sp.room;
        P.x = (x + 1.2) * 2; P.z = (y + 1.2) * 2; __pe.lookAt((x + w) * 2, (y + h) * 2);
        P.pitch = sp.up ? 0.35 : -0.08;
      } else if (sp.back) {
        P.x = sp.at[0] + sp.back[0] * 4; P.z = sp.at[1] + sp.back[1] * 4; __pe.lookAt(sp.at[0], sp.at[1]); P.pitch = 0;
      } else { P.x = sp.at[0]; P.z = sp.at[1]; __pe.lookAt(sp.look[0], sp.look[1]); P.pitch = 0; }
      const c = S.world.cellAt(P.x, P.z);
      P.y = L.open[c] ? L.floor[c] : P.y;
    }, sp);
    await page.waitForTimeout(900);
    const f = `${OUT}/tour_${lv}_${sp.name}.png`;
    await page.screenshot({ path: f });
    files.push(f);
  }
}
fs.writeFileSync(path.join(OUT, 'tour.txt'), files.join('\n'));
await browser.close();
