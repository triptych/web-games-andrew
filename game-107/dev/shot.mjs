/**
 * shot.mjs — screenshot the model gallery (dev/gallery.html) on a neutral background.
 *
 *   node game-107/dev/shot.mjs [row] [theme]        # row: kaiju | props | army | roofs | land
 *
 * Output: game-107/dev/shots/gallery-<row>.png. Needs the static server on port 8107.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8107';
const [row = 'props', theme = '0'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 640 }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-107/dev/gallery.html?row=${row}&theme=${theme}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
await page.waitForTimeout(300);
const out = path.join(HERE, 'shots', `gallery-${row}.png`);
await page.screenshot({ path: out });
console.log('shot', path.relative(process.cwd(), out));
await browser.close();
