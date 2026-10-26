/**
 * gallery.mjs — one browser session, a screenshot of every screen. For judging the look.
 *
 *   node game-100/dev/gallery.mjs [w h] [touch]          → dev/shots/g-<name>.png
 *   ONLY=menu,hud node game-100/dev/gallery.mjs 390 844 touch
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8100';
const [w = '1280', h = '760', touch = ''] = process.argv.slice(2);
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const tag = `${w}x${h}`;
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const SHOTS = [
    ['power', `__gg.goto('power')`, 600],
    ['boot', `__gg.goto('boot'); __gg.stage.power = 1`, 4200],
    ['logo', `__gg.goto('attract'); __gg.ui.attractI = 0; __gg.ui.attractT = 0`, 2500],
    ['scores', `__gg.goto('attract'); __gg.ui.attractI = 2; __gg.ui.attractT = 0`, 3500],
    ['how', `__gg.goto('attract'); __gg.ui.attractI = 3; __gg.ui.attractT = 0`, 1500],
    ['menu', `__gg.toMenu()`, 1500],
    ['modes', `__gg.goto('modes')`, 800],
    ['settings', `__gg.goto('settings')`, 800],
    ['howto1', `__gg.goto('howto'); __gg.ui.howPage = 1`, 800],
    ['halls', `__gg.ui.scoreMode = 'dance'; __gg.goto('scores', {})`, 800],
    ['ready', `__gg.start('dance', 5); __gg.goto('ready', { countdown: 2 }); __gg.ui.data.countdown = 2`, 1200],
    ['hud', `__gg.start('dance', 5); __gg.autoplay(true, 0.8)`, 7000],
    ['fever', `__gg.G.meter = 100`, 5000],
    ['pause', `__gg.autoplay(false); __gg.goto('pause')`, 800],
    ['over', `__gg.G.time = 0.1; __gg.autoplay(true, 0.8)`, 7000],
    ['entry', `__gg.goto('entry', { rank: 2, score: __gg.G.score })`, 800],
];

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const isTouch = touch === 'touch';
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-100/index.html?debug=1${process.env.Q ?? '&fast=4'}`);
await page.waitForFunction(() => window.__gg, null, { timeout: 60000 });
for (const [name, code, wait] of SHOTS) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    await page.evaluate(`(async () => { ${code} })()`);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(HERE, 'shots', `g-${name}-${tag}.png`) });
    console.log('shot', name);
}
await browser.close();
