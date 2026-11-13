/**
 * models.mjs — screenshot dev/modelview.html: every Meshy prop from the front, the side and above, fitted the way
 * the game fits it (the red grid is one 2 × 2 cell, the green arrow is +Z, which should be each model's front).
 *
 *   python3 -m http.server 8129          # from the REPO ROOT
 *   node game-129/dev/models.mjs [only]  # → game-129/dev/shots/models.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8129';
const only = process.argv[2] ? `?only=${process.argv[2]}` : '';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 880, height: 1600 } });
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    return fs.existsSync(file) ? route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) }) : route.abort();
});
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await page.goto(`${BASE}/game-129/dev/modelview.html${only}`);
await page.waitForFunction(() => document.title === 'done', null, { timeout: 120000 });
await page.locator('#c').screenshot({ path: path.join(HERE, 'shots', 'models.png') });
console.log('wrote', path.join(HERE, 'shots', 'models.png'));
await browser.close();
