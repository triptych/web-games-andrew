/**
 * shot.mjs — screenshot a dev page (the sprite gallery by default).
 *
 *   node game-106/dev/shot.mjs                       # dev/gallery.html → dev/shots/gallery.png
 *   node game-106/dev/shot.mjs gallery.html?dark dark
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8106';
const [page_ = 'gallery.html', name = 'gallery'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-106/dev/${page_}`);
await page.waitForFunction(() => window.galleryReady, null, { timeout: 30000 });
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();
