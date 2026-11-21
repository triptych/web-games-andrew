/**
 * gallery.mjs — screenshot dev/models.html (every Meshy model as the game fits it) to dev/shots/gallery.png.
 *   node game-144/dev/gallery.mjs [names] [0]     # e.g. ship-sora,mote; a trailing 0 shows models unturned
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8144'}/game-144/dev/models.html?names=${process.argv[2] || ''}&rot=${process.argv[3] ?? ''}`);
await page.waitForFunction(() => window.galleryDone, null, { timeout: 120000 });
await page.screenshot({ path: path.join(HERE, 'shots', 'gallery.png'), fullPage: true });
console.log(await page.title());
await b.close();
