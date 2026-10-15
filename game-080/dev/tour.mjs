/**
 * tour.mjs — screenshot a list of places in one browser, for judging the art.
 *
 *   node game-080/dev/tour.mjs                 # every stop
 *   ONLY=castle,undercroft node game-080/dev/tour.mjs
 *   W=390 H=844 node game-080/dev/tour.mjs     # on a phone-sized window
 *
 * Shots: game-080/dev/shots/tour-<name>.png. Needs the static server (see dev/README.md).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8080';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

// [name, map, x, y, setup js]
const Z = (c, r, x = 12, y = 9) => [c * 24 + x, r * 16 + y];
const STOPS = [
    ['quillford', 'world', ...Z(4, 3, 12, 8)],
    ['castle', 'world', ...Z(4, 1, 13, 10)],
    ['gardens', 'world', ...Z(5, 1, 11, 7)],
    ['market', 'world', ...Z(5, 2, 10, 8)],
    ['saltmere', 'world', ...Z(7, 3, 12, 8)],
    ['docks', 'world', ...Z(8, 3, 12, 8)],
    ['mousehold', 'world', ...Z(3, 6, 12, 7)],
    ['mill', 'world', ...Z(2, 3, 11, 9)],
    ['hills', 'world', ...Z(2, 2)],
    ['moor', 'world', ...Z(1, 1, 11, 9), "__el.grant(['lumen','gust'])"],
    ['abbey', 'world', ...Z(0, 0, 11, 7)],
    ['peak', 'world', ...Z(4, 0, 10, 7)],
    ['lodge', 'world', ...Z(3, 1, 11, 9)],
    ['sky', 'world', ...Z(7, 0, 12, 8), "__el.grant(['feather'])"],
    ['lake', 'world', ...Z(7, 5, 12, 11), "__el.grant(['tide'])"],
    ['thorn', 'world', ...Z(0, 5, 11, 10)],
    ['quarry', 'world', ...Z(0, 6, 11, 6)],
    ['coast', 'world', ...Z(8, 2, 9, 6)],
    ['locks', 'world', ...Z(2, 2, 12, 2)],
    ['night', 'world', ...Z(4, 4, 12, 9), '__el.G.clock = 560'],
    ['dusk', 'world', ...Z(4, 3, 12, 8), '__el.G.clock = 470'],
    ['pips', 'pips', 6, 5],
    ['throne', 'throne', 9, 7],
    ['inn', 'sleepyowl', 7, 5],
    ['library0', 'library', 17, 15],
    ['library6', 'library', 17, 8, "__el.G.placed = ['lumen','gust','ember','stone','frost','tide']; __el.G.books = [...__el.G.placed]; for (let i = 0; i < 20; i++) __el.G.common['b' + i] = 2"],
    ['reading', 'library', 4, 12, "for (let i = 0; i < 48; i += 2) __el.G.common['b' + i] = 2"],
    ['hollowoak', 'hollowoak', 14, 12],
    ['glimmer', 'glimmer', 13, 14, "__el.grant(['lumen'])"],
    ['glimmerdark', 'glimmer', 13, 14, ''],
    ['kiln', 'kiln', 15, 13],
    ['rime', 'rime', 16, 12],
    ['archive', 'archive', 16, 12, "__el.grant(['tide'])"],
    ['keep', 'keep', 17, 11],
    ['observatory', 'observatory', 17, 10],
    ['undercroft', 'undercroft', 19, 13, "__el.grant(['lumen'])"],
];

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const w = +(process.env.W || 1280), h = +(process.env.H || 760);
const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-080/index.html?debug=1`);
await page.waitForFunction(() => window.__el, null, { timeout: 60000 });
await page.evaluate(() => { __el.start(9, { skipIntro: true }); __el.G.flags.metWick = 1; });
for (const [name, map, x, y, setup] of STOPS) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    await page.evaluate(([m, x, y, s]) => {
        __el.G.books = []; __el.G.placed = []; __el.G.common = {}; __el.G.clock = 180;
        if (s) eval(s);
        __el.warp(m, x, y);
        __el.G.grace = 30;
        for (const e of __el.G.ents) e.state = 'wander';
    }, [map, x, y, setup || '']);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(HERE, 'shots', `tour-${name}.png`) });
    console.log('shot', name);
}
await browser.close();
