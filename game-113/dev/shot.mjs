/**
 * shot.mjs — screenshot a dev page (default: the sprite gallery) for checking art on a neutral background.
 *
 *   node game-113/dev/shot.mjs [page=gallery.html] [name=gallery] [w=1400] [h=2400]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8113';
const [page = 'gallery.html', name = 'gallery', w = '1400', h = '2400'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const p = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`${BASE}/game-113/dev/${page}`);
await p.waitForFunction(() => window.galleryReady, null, { timeout: 30000 });
await p.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
console.log('shot', `dev/shots/${name}.png`);
await browser.close();
