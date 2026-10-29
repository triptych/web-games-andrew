/**
 * preview.mjs — the 1200×630 share and Garden Library picture: the monster mid-rampage in Neon Heights
 * at dusk, dust and rubble flying, the HUD tidied away.
 *
 * The generic dev/screenshots.mjs photographs the first seconds of play (a quiet plaza); this one
 * fast-forwards with the bot to a busy moment and lets the canvas warm up before shooting. It writes
 * dev/shots/preview.jpg; copy it to garden/img/games/game-107.jpg, then
 * `ONLY=game-107 node dev/add-meta.mjs`.
 *
 *   python3 -m http.server 8107          # from the REPO ROOT
 *   node game-107/dev/preview.mjs [seed] [city 0-4] [seconds]
 *   cp game-107/dev/shots/preview.jpg garden/img/games/game-107.jpg
 *
 * Env: BASE (default http://127.0.0.1:8107), THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8107';
const [seed = '5', city = '2', secs = '16'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-107/index.html?debug=1`);
await page.waitForFunction(() => window.__kr, null, { timeout: 60000 });
await page.evaluate(([s, c, t]) => {
    __kr.start(s, c);
    __kr.ff(t);
    document.getElementById('hud').hidden = true;
    document.getElementById('touch').hidden = true;
    document.getElementById('popups').innerHTML = '';
}, [+seed, +city, +secs]);
await page.waitForTimeout(+(process.env.WAIT || 1200));
await page.screenshot({ path: path.join(HERE, 'shots', 'preview.jpg'), type: 'jpeg', quality: 86 });
console.log('wrote game-107/dev/shots/preview.jpg');
await browser.close();
