// sprites.mjs — render a sprite sheet of painters into dev/shots/sprites-<what>.png
//   node dev/sprites.mjs heart|people|monsters|items|buildings|objects
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:8043';
const what = process.argv[2] ?? 'heart';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1200, height: 1700 } });
await p.goto(`${BASE}/game-043/index.html`); await p.waitForTimeout(800);
await p.evaluate(async what => {
    const W = await import('./js/gen/art/world.js'), P = await import('./js/gen/art/people.js'), I = await import('./js/gen/art/items.js');
    const { ITEMS } = await import('./js/data/items.js'); const { BUILDINGS } = await import('./js/data/buildings.js'); const { O } = await import('./js/data/tiles.js');
    const g = window.__glim.ui.game ?? null;
    const list = [];
    if (what === 'heart') for (let s = 0; s <= 5; s++) for (const se of [0, 2, 3]) list.push(W.paintHeartwood(s, se));
    if (what === 'people') for (let k = 0; k < 8; k++) for (let d = 0; d < 4; d++) list.push(P.paintPerson({ skin: k, hair: k, hairColor: (k * 3) % 10, eyes: k % 6, top: k, bottom: 9 - k, acc: k % 6 }, d, 0));
    if (what === 'monsters') { const { generateSpecies } = await import('./js/gen/monsters.js'); for (const s of Object.values(generateSpecies(7).species)) list.push(P.paintMonster(s, 0, s.boss ? 32 : 16)); }
    if (what === 'items') for (const it of ITEMS) list.push(I.paintItem(it));
    if (what === 'buildings') { for (const bb of BUILDINGS) list.push(W.paintBuilding(bb.id, {})); list.push(W.paintBuilding('hall', { shape: 'tent' }), W.paintBuilding('hall', { shape: 'hall', roof: 205, wall: 40 }), W.paintBuilding('cabin', { roof: 355, wall: 32, chimney: true })); }
    if (what === 'objects') for (const o of Object.values(O)) for (const rg of [0, 3, 4, 5]) { const r = W.paintObject(o, 1, rg, 0, { item: 'mint', kind: 'shrine', awake: true, gem: 'ruby' }); if (r) list.push(r.p); }
    const sc = what === 'items' || what === 'objects' ? 3 : what === 'heart' ? 2 : 4;
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1700; c.id = 'sheet';
    Object.assign(c.style, { position: 'fixed', left: 0, top: 0, zIndex: 9999, background: '#6a9a5a' });
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#7aa86a'; x.fillRect(0, 0, 1200, 1700);
    let px = 4, py = 4, rowH = 0;
    for (const pix of list) { const cv = pix.toCanvas(); const w = cv.width * sc, h = cv.height * sc; if (px + w > 1196) { px = 4; py += rowH + 4; rowH = 0; } x.drawImage(cv, px, py, w, h); px += w + 4; rowH = Math.max(rowH, h); }
    document.body.append(c);
}, what);
await p.waitForTimeout(200);
await p.screenshot({ path: new URL(`./shots/sprites-${what}.png`, import.meta.url).pathname });
await b.close();
