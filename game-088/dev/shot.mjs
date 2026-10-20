/**
 * shot.mjs — screenshot a dev page (the model gallery by default).
 *
 *   node game-088/dev/shot.mjs                         # dev/gallery.html → dev/shots/gallery.png
 *   node game-088/dev/shot.mjs gallery.html?only=art art
 *
 * Needs the static server on port 8088 (see dev/README.md).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8088';
const [page0 = 'gallery.html', name = 'gallery'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-088/dev/${page0}`);
if (process.env.VIEW) await page.setViewportSize({ width: +process.env.VIEW.split('x')[0], height: +process.env.VIEW.split('x')[1] });
await page.waitForFunction(() => window.__done, null, { timeout: 180000 });
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();
