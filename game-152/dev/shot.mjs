/**
 * shot.mjs — screenshot a dev page (models.html) once window.__ready is true.
 *
 *   node game-152/dev/shot.mjs models [query] [w h]       # → dev/shots/models.png
 *   node game-152/dev/shot.mjs models "view=side"
 *
 * Needs the static server on PORT 8152 (repo root) and playwright linked (see dev/README.md).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8152';
const [page = 'models', query = '', w = '1500', h = '900'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await p.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
await p.goto(`${BASE}/game-152/dev/${page}.html?${query}`);
await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const out = path.join(HERE, 'shots', `${page}${query ? '-' + query.replace(/[^a-z0-9]+/gi, '_') : ''}.png`);
await p.screenshot({ path: out });
console.log('shot', path.relative(process.cwd(), out));
await browser.close();
