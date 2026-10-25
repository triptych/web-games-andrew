/**
 * shot.mjs — screenshot a dev page (the model gallery) for judging models on a neutral background.
 *
 *   node game-098/dev/shot.mjs "dev/models.html?set=dragons" dragons [w h]
 *   node game-098/dev/shot.mjs "dev/models.html?set=people" people
 *   node game-098/dev/shot.mjs "dev/models.html?set=eggs" eggs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8098';
const [page0 = 'dev/models.html', name = 'models', w = '1400', h = '900'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-098/${page0}`);
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', `dev/shots/${name}.png`);
await browser.close();
