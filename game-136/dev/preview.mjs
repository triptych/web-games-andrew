/**
 * preview.mjs — the Garden's 1200×630 preview of Pinch & Place, made by the game's own photo
 * pipeline: a room decorated by the bot, golden hour, the miniature blur, no frame.
 *
 *   node game-136/dev/preview.mjs [room] [time]     # writes garden/img/games/game-136.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8136';
const [room = 'biscuit', time = 'golden'] = process.argv.slice(2);
const OUT = path.join(HERE, '../../garden/img/games/game-136.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() !== 'debug') console.log('[page]', m.text()); });
await page.goto(`${BASE}/game-136/index.html?debug=1`);
await page.waitForFunction(() => window.__pp && __pp.mode === 'title', null, { timeout: 90000 });
const data = await page.evaluate(async ([room, time]) => {
    __pp.start(room);
    if (room === 'biscuit') {
        // a hand-arranged living room (the bot decorates for points, not for looks)
        __pp.G.clay = 300;
        const put = (kind, size, variant, colors, motif, spec) => {
            const r = __pp.act({ t: 'craft', recipe: { kind, size, variant, colors, motif } });
            const p = __pp.act({ t: 'place', id: r.id, ...spec });
            if (!p.ok) console.log('could not place', kind, p.why);
        };
        put('rug', 2, 1, ['blush', 'cream'], 1, { x: 2, y: 2, rot: 0 });
        put('sofa', 1, 0, ['teal', 'butter'], 0, { x: 2, y: 0, rot: 0 });
        put('table', 0, 1, ['oat', 'cocoa'], 0, { x: 3, y: 3, rot: 0 });
        put('armchair', 1, 0, ['tomato', 'cream'], 0, { x: 5, y: 3, rot: 3 });
        put('armchair', 1, 1, ['butter', 'tomato'], 0, { x: 1, y: 3, rot: 1 });
        put('floorlamp', 1, 0, ['charcoal', 'butter'], 0, { x: 1, y: 0, rot: 0 });
        put('floorlamp', 1, 2, ['cocoa', 'blush'], 0, { x: 5, y: 0, rot: 0 });
        put('bookshelf', 1, 0, ['cocoa', 'tomato'], 0, { x: 0, y: 1, rot: 1 });
        put('plant', 2, 0, ['tomato', 'moss'], 0, { x: 6, y: 0, rot: 0 });
        put('nightstand', 1, 0, ['cream', 'cocoa'], 0, { x: 6, y: 5, rot: 3 });
        put('tablelamp', 1, 0, ['teal', 'cream'], 0, { x: 6, y: 5, rot: 0 });
        put('plant', 0, 2, ['sky', 'moss'], 0, { x: 3, y: 3, rot: 0 });
        put('toy', 1, 0, ['cocoa', 'blush'], 0, { x: 4, y: 4, rot: 0 });
        put('toy', 0, 4, ['sky', 'tomato'], 0, { x: 2, y: 4, rot: 0 });
        put('picture', 1, 0, ['butter', 'sky'], 3, { wall: 'L', u: 5, v: 1 });
        put('picture', 0, 1, ['tomato', 'cream'], 2, { wall: 'L', u: 0, v: 1 });
        put('picture', 1, 0, ['cocoa', 'cream'], 1, { wall: 'R', u: 1, v: 1 });
        put('clock', 1, 0, ['cream', 'charcoal'], 0, { wall: 'R', u: 3, v: 2 });
        put('chair', 0, 1, ['oat', 'teal'], 0, { x: 4, y: 5, rot: 2 });
    } else __pp.ff();
    __pp.enterPhoto('build');
    __pp.view.setTime(time);
    __pp.view.post.setFilter('warm');
    __pp.view.post.setTilt(0.7);
    __pp.view.orbit(-0.12, -0.08);
    __pp.view.zoomBy(+(new URLSearchParams(location.search).get('z') || 1));
    await new Promise((r) => setTimeout(r, 1500));
    const c = __pp.view.capture(1200, 630);
    return c.toDataURL('image/jpeg', 0.88);
}, [room, time]);
fs.writeFileSync(OUT, Buffer.from(data.split(',')[1], 'base64'));
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();
