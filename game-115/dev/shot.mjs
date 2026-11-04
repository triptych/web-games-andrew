/**
 * shot.mjs — screenshot a dev page (default gallery.html) into dev/shots/.
 *   node game-115/dev/shot.mjs [page] [name] [w h]    e.g.  shot.mjs "gallery.html?only=tavern,hall" tav 1400 900
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8115';
const [page = 'gallery.html', name = 'gallery', w = '1500', h = '900'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const p = await browser.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`${BASE}/game-115/dev/${page}`);
await p.waitForFunction(() => window.__done, null, { timeout: 60000 });
await p.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();
