/**
 * shot.mjs — screenshot a dev page (default dev/gallery.html), full page.
 *   node game-080/dev/shot.mjs [page] [name]
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8080';
const [pg = 'gallery.html', name = 'gallery'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-080/dev/${pg}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
console.log('shot', `dev/shots/${name}.png`);
await browser.close();
