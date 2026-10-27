/**
 * shot.mjs: screenshot dev/gallery.html (every scene, with its people) into dev/shots/gallery.png.
 *   node game-104/dev/shot.mjs [scene] [dread]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8104';
const [scene = '', dread = '0'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1340, height: 900 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-104/dev/gallery.html?${scene ? 'scene=' + scene + '&' : ''}dread=${dread}`);
await page.waitForTimeout(600);
const out = path.join(HERE, 'shots', scene ? `gallery-${scene}.png` : 'gallery.png');
await page.screenshot({ path: out, fullPage: true });
console.log('shot', path.relative(process.cwd(), out));
await browser.close();
