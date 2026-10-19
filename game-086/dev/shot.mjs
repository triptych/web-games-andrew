/**
 * shot.mjs — screenshot a dev page (dev/gallery.html by default).
 *
 *   node game-086/dev/shot.mjs [page] [name] [w h]
 *   node game-086/dev/shot.mjs "gallery.html?only=dragon,castle" art
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8086';
const [pg = 'gallery.html', name = 'gallery', w = '1400', h = '1500'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
let bad = 0;
page.on('pageerror', (e) => { bad++; console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { bad++; console.log('[error]', m.text()); } });
await page.goto(`${BASE}/game-086/dev/${pg}`);
await page.waitForFunction(() => document.title.endsWith('✓'), null, { timeout: 30000 });
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();
process.exit(bad ? 1 : 0);
