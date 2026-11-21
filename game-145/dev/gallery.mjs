/**
 * gallery.mjs — screenshot dev/models.html: every vehicle model as the game fits it.
 *   node game-145/dev/gallery.mjs [top]   → dev/shots/gallery.png (or gallery-top.png)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const top = process.argv[2] === 'top';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8145'}/game-145/dev/models.html${top ? '?top=1' : ''}`);
await page.waitForFunction(() => window.done, null, { timeout: 120000 });
await page.screenshot({ path: path.join(HERE, 'shots', top ? 'gallery-top.png' : 'gallery.png') });
await browser.close();
console.log('shot');
