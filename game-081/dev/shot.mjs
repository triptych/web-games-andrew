/**
 * shot.mjs — screenshot a dev page (the model gallery) in Chromium.
 *
 *   node game-081/dev/shot.mjs models.html?row=bosses out-name [w h] [waitMs]
 *
 * Needs a static server on port 8081 at the repo root. Writes game-081/dev/shots/<out-name>.png.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8081';
const [page = 'models.html', name = 'gallery', w = '1400', h = '700', wait = '1500'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const p = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await p.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`${BASE}/game-081/dev/${page}`);
await p.waitForFunction(() => window.__gallery?.ready, null, { timeout: 90000 });
await p.waitForTimeout(+wait);
await p.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', `dev/shots/${name}.png`);
await browser.close();
