/**
 * tour.mjs — photograph a set of places in one city, for judging the look.
 *
 *   node game-145/dev/tour.mjs [seed] [only,names]      → dev/shots/tour-<name>.png
 *
 * Places: home (where you wake), street (outside home), mall (the atrium), backrooms (a yellow office floor),
 * hospital (a corridor), factory (the hall), hall (Hall C with the ring), hotel (the VACANCY sign), stairs.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8145';
const seed = +(process.argv[2] || 7);
const only = (process.argv[3] || '').split(',').filter(Boolean);
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
await page.goto(`${BASE}/game-145/index.html?debug=1&q=${process.env.Q || 'medium'}`);
await page.waitForFunction(() => window.__va, null, { timeout: 60000 });
await page.evaluate((s) => __va.start(s), seed);
await page.waitForFunction(() => __va.mode === 'play', null, { timeout: 120000 });

// put the walker somewhere: a building of a type, on a level, at a free tile, facing yaw
const SPOTS = {
    home: `const s = G.story.start; Object.assign(G.p, { x: s.x, z: s.z, L: s.L, yaw: s.yaw + 2.6 }); __va.look(-0.1);`,
    street: `const b = G.city.buildings[G.story.home], e = b.entrances[0]; const D = [[0,-1],[1,0],[0,1],[-1,0]][e.dir]; Object.assign(G.p, { x: (b.x0 + e.x + 0.5 + D[0] * 4) * 2, z: (b.z0 + e.z + 0.5 + D[1] * 4) * 2, L: 0, yaw: Math.atan2(D[0], -D[1]) + 0.5 }); __va.look(0.05);`,
    mall: `place('mall', 0, (I, x, z) => x === 6 && z === 7, 2.3); __va.look(0.25);`,
    mall2: `place('mall', 1, (I, x, z) => x === 4 && z === 16, 0.9); __va.look(-0.1);`,
    backrooms: `place((b) => b.type === 'office' && b.floors > 2, -1, (I, x, z, lv) => lv.rooms[lv.room[z * I.w + x]]?.backrooms, 0.7, true);`,
    hospital: `place('hospital', 1, (I, x, z, lv) => lv.rooms[lv.room[z * I.w + x]]?.kind === 'corridor', 0);`,
    factory: `place('factory', 0, (I, x, z) => z > 6 && x > 3, 0.4); __va.look(0.2);`,
    hall: `const t = G.thingById.get('master'); Object.assign(G.p, { x: t.x, z: t.z + 9, L: 0, yaw: 0 }); __va.look(0.18); G.power = true;`,
    hotel: `const b = G.city.buildings.find((b) => b.type === 'hotel'), e = b.entrances[0]; const D = [[0,-1],[1,0],[0,1],[-1,0]][e.dir]; Object.assign(G.p, { x: (b.x0 + e.x + 0.5 + D[0] * 6) * 2 + D[1] * 5, z: (b.z0 + e.z + 0.5 + D[1] * 6) * 2 - D[0] * 5, L: 0 }); G.p.yaw = Math.atan2((b.x0 + e.x + 0.5) * 2 - G.p.x, -((b.z0 + e.z + 0.5) * 2 - G.p.z)); __va.look(0.28);`,
    stairs: `place('apartment', 0, (I, x, z, lv) => { const i = z * I.w + x; return lv.flags[i] === 0 && I.levels[0].stair[(z + 1) * I.w + x] === 1 + 2 * 16; }, Math.PI); __va.look(0.25);`,
};
const PRE = `
const G = __va.G, In = await import('/game-145/js/sim/interior.js'), F = In.F;
function place(type, L, pred, yaw = 0, anyLevel = false) {
    const bs = G.city.buildings.filter(typeof type === 'function' ? type : (b) => b.type === type);
    for (const b of bs) {
        const I = In.interiorOf(G.city, b);
        const Ls = anyLevel ? [...Array(I.floors).keys()].reverse() : [L];
        for (const LL of Ls) { const lv = I.levels[LL]; if (!lv) continue;
            for (let z = 1; z < I.d - 1; z++) for (let x = 1; x < I.w - 1; x++) {
                const i = z * I.w + x;
                if (lv.flags[i] & (F.SOLID | F.VOID | F.VOIDSTAIR | F.HOLE | F.STAIR) || lv.floor[i] === 0) continue;
                if (pred(I, x, z, lv)) { Object.assign(G.p, { x: I.x0 + (x + 0.5) * 2, z: I.z0 + (z + 0.5) * 2, L: LL, yaw }); return; }
            } }
    }
    throw new Error('no spot for ' + type);
}`;
for (const [name, code] of Object.entries(SPOTS)) {
    if (only.length && !only.includes(name)) continue;
    try {
        await page.evaluate(`(async () => { ${PRE}; ${code}; G.p.y = G.p.L * (G.city.buildings.find((b) => true) ? 1 : 0); const W = await import('/game-145/js/sim/world.js'); G.p.y = W.groundAt(G.city, G.p.L, G.p.x, G.p.z); __va.view.camY = G.p.y + 1.62; __va.view.update(G, 0, true); })()`);
        // let the stream build what is near
        await page.waitForFunction(() => { const v = __va.view; return v.want && !v.want.levels.slice(0, 6).some((l) => !v.levels.has(l.key)) && !v.want.chunks.slice(0, 6).some((c) => !v.chunks.has(c.key)); }, null, { timeout: 120000 }).catch(() => console.log('  (stream not finished)'));
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(HERE, 'shots', `tour-${name}.png`) });
        console.log('shot', name);
    } catch (err) { console.log('FAIL', name, err.message.split('\n')[0]); }
}
await browser.close();
