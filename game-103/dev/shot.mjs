/**
 * shot.mjs — screenshot dev/gallery.html: every character on a flat green floor, plus the portraits.
 * Judge a silhouette here before it goes under the lights.
 *
 *   node game-103/dev/shot.mjs [name] [w h]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8103';
const [name = 'gallery', w = '1160', h = '620'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-103/dev/gallery.html`);
await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', path.join('game-103/dev/shots', `${name}.png`));
await browser.close();
