/**
 * shot.mjs — screenshot the scene gallery (dev/gallery.html): every station, early and late,
 * with the curios' spot circles outlined. `RINGS=0` hides the circles.
 *
 *   node game-122/dev/shot.mjs            # → game-122/dev/shots/gallery.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8122';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 2000, height: 1700 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-122/dev/gallery.html?rings=${process.env.RINGS ?? 1}`);
await page.waitForFunction(() => window.__galleryReady);
await page.screenshot({ path: path.join(HERE, 'shots', 'gallery.png'), fullPage: true });
console.log('shot dev/shots/gallery.png');
await browser.close();
