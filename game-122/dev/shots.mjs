/**
 * shots.mjs — a tour of the island in screenshots, one browser, many scenes.
 *   node game-122/dev/shots.mjs              # all scenes
 *   ONLY=hut,castle node game-122/dev/shots.mjs
 * Writes game-122/dev/shots/tour-<name>.png. Needs the static server on port 8122.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8122';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

// [name, tod, x, z, yaw, pitch, extra js]
const SCENES = [
    ['beach', 0.18, 10, 186, 0.15, 0.02, ''],
    ['dusk', 0.54, 20, 186, -0.5, 0.06, ''],
    ['hut-out', 0.3, 43, 132, 3.14, 0.02, ''],
    ['hut-in', 0.3, 43, 143.6, 3.14, -0.12, 'G.flags.hearth = true; G.flags.hutFound = true;'],
    ['hut-lab', 0.7, 43, 147.5, -0.9, -0.15, 'G.flags.hearth = true;'],
    ['circle', 0.3, 43, 144.5, 3.14, -0.3, 'G.flags.hearth = true;'],
    ['wood', 0.25, -100, 36, -1.6, 0.0, ''],
    ['mere', 0.3, -116, 36, -1.57, 0.0, 'G.flags.bridge = true;'],
    ['fen', 0.32, 96, 8, -1.57, 0.0, 'G.flags.iceWall = true;'],
    ['gorge', 0.3, 70, 9, 1.57, 0.05, ''],
    ['moor', 0.22, 6, -112, 0.0, 0.02, ''],
    ['castle', 0.42, 0, 76, 0, 0.12, ''],
    ['night', 0.75, 0, 120, 0, 0.1, ''],
    ['court', 0.3, 0, 12, 0, 0.1, 'Object.assign(G.flags,{thornGap:1,gate:1,stoneWood:1,stoneFen:1,stoneMoor:1,crossedMoat:1,inCastle:1});'],
    ['keep', 0.3, 0, 1.5, 0, 0.35, 'Object.assign(G.flags,{thornGap:1,gate:1,door:1,stoneWood:1,stoneFen:1,stoneMoor:1});'],
    ['gallery', 0.3, 0, -2.8, 0, 0.0, 'Object.assign(G.flags,{thornGap:1,gate:1,door:1,gallery:1}); G.p.y = 36;'],
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 760) }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
await page.goto(`${BASE}/game-122/index.html?debug=1${process.env.Q || ''}`);
await page.waitForFunction(() => window.__ww, null, { timeout: 90000 });
await page.evaluate(() => { __ww.start(+(new URLSearchParams(location.search).get('seed') || 5)); document.getElementById('hud').hidden = !!window.NOHUD; });
for (const [name, tod, x, z, yaw, pitch, js] of SCENES) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    await page.evaluate(([tod, x, z, yaw, pitch, js]) => {
        const G = __ww.G; G.tod = tod; G.p.wards = {};
        __ww.put(x, z, yaw, pitch);
        if (js) new Function('G', js)(G);
        G.nib.mode = 'follow'; G.nib.x = x + 1.5; G.nib.z = z + 1; G.nib.y = __ww.view.W.height(G.nib.x, G.nib.z);
    }, [tod, x, z, yaw, pitch, js]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(HERE, 'shots', `tour-${name}.png`) });
    console.log('shot', name);
}
await browser.close();
