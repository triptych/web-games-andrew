/**
 * preview.mjs — the 1200×630 share and Garden Library picture: a busy room late in sector 2, with
 * the Grinner bouncing in, gunners, a brute and a trail of chips.
 *
 * The generic dev/screenshots.mjs photographs the first second of play (an empty maze); this one
 * fast-forwards with the bot and lets the canvas warm up before shooting. It writes
 * dev/shots/preview.jpg; copy it to garden/img/games/game-106.jpg, then
 * `ONLY=game-106 node dev/add-meta.mjs`.
 *
 *   python3 -m http.server 8106          # from the REPO ROOT
 *   node game-106/dev/preview.mjs [seed] [seconds]
 *   cp game-106/dev/shots/preview.jpg garden/img/games/game-106.jpg
 *
 * Env: BASE (default http://127.0.0.1:8106), PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8106';
const [seed = '11', secs = '100'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-106/index.html?debug=1`);
await page.waitForFunction(() => window.__ia);
await page.evaluate(([s, t]) => {
    __ia.start(s);
    __ia.autoplay(true);
    __ia.ff(t);
    for (const id of [...__ia.ui.stack]) __ia.ui.closeScreen(id);
    document.getElementById('banner').hidden = true;
}, [+seed, +secs]);
await page.waitForTimeout(3000);                 // past the canvas warm-up, with the bot still playing
await page.screenshot({ path: path.join(HERE, 'shots', 'preview.jpg'), type: 'jpeg', quality: 85 });
console.log('wrote dev/shots/preview.jpg');
await browser.close();
