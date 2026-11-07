/**
 * shots.mjs — a gallery run: boots the game once and takes a screenshot per scene.
 *
 *   node game-120/dev/shots.mjs                       # every scene
 *   ONLY=boss0,boss4 node game-120/dev/shots.mjs      # some scenes
 *   Q='&q=med' W=1280 H=760 node game-120/dev/shots.mjs
 *
 * Scenes use the debug hooks in js/main.js (see dev/README.md). Output: dev/shots/s-<name>.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8120';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

// A boss fight set-up: a walker sized for the level, parked in front of the arena with the boss awake.
const boss = (seed, level, upg, back, extra = '', a = 0.6) => `__hr.start(${seed}, ${level}, ${JSON.stringify(upg)}); __hr.god(); const w = __hr.G.world; __hr.warp(w.arena.z + ${back}); __hr.view.focus = { a: ${a}, k: 3 }; ${extra} __hr.G.enemies.forEach((e) => { e.flash = 0; });`;
const SCENES = [
    ['title', '', 2500],
    ['play0', `__hr.start(3, 0); __hr.god(); __hr.ff(10);`, 2500],
    ['boss0', boss(2, 0, { guns: 1, armor: 1 }, 52, '__hr.ff(6);'), 3000],
    ['boss0b', boss(2, 0, { guns: 1, armor: 1 }, 40, '__hr.G.enemies.find(e=>e.b).hp *= 0.45; __hr.ff(9);'), 3000],
    ['boss2', boss(4, 2, { guns: 3, missiles: 2, armor: 3, fuel: 2, legs: 3 }, 50, '__hr.ff(6);'), 3000],
    ['boss3', boss(5, 3, { guns: 3, missiles: 3, armor: 3, fuel: 3, legs: 3 }, 50, '__hr.ff(6);'), 3000],
    ['boss4', boss(6, 4, { guns: 4, missiles: 3, armor: 4, fuel: 3, legs: 4 }, 50, '__hr.ff(5); __hr.G.enemies.find(e=>e.b).hp *= 0.6; __hr.ff(6);'), 3000],
    ['boss5', boss(7, 5, { guns: 5, missiles: 5, armor: 5, fuel: 4, legs: 5 }, 50, '__hr.ff(6);'), 3000],
    ['hangar', `__hr.start(3, 1, {guns:2,missiles:1,armor:3,fuel:2,legs:2}); __hr.hangar();`, 3500],
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
for (const [name, code, wait] of SCENES) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const page = await (await browser.newContext({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 760) }, deviceScaleFactor: 1 })).newPage();
    if (PKG) await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] console:`, m.text().slice(0, 300)); });
    page.on('pageerror', (e) => console.log(`[${name}] pageerror:`, e.message));
    await page.goto(`${BASE}/game-120/index.html?debug=1${process.env.Q || '&q=med'}`);
    await page.waitForFunction(() => window.__hr, null, { timeout: 90000 });
    if (code) { try { await page.evaluate(`(async () => { ${code} })()`); } catch (e) { console.log(`[${name}] snippet failed:`, e.message.slice(0, 200)); } }
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(HERE, 'shots', `s-${name}.png`), timeout: 120000 });
    console.log('shot', name);
    await page.close();
}
await browser.close();
