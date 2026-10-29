/**
 * shot.mjs — screenshot the model gallery (dev/gallery.html) on a neutral background.
 *
 *   node game-108/dev/shot.mjs heroes|monsters|gems
 *
 * Writes game-108/dev/shots/gallery-<what>.png. Needs the static server on port 8108 (repo root).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8108';
const what = process.argv[2] || 'heroes';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: what === 'monsters' ? 900 : 760 } })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-108/dev/gallery.html?what=${what}`);
await page.waitForFunction(() => window.galleryReady, null, { timeout: 60000 });
await page.waitForTimeout(500);
const out = path.join(HERE, 'shots', `gallery-${what}.png`);
await page.screenshot({ path: out });
console.log('shot', path.relative(process.cwd(), out));
await browser.close();
