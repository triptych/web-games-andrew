/** shot.mjs — screenshot a dev page. node game-099/dev/shot.mjs stickers.html [name] [w h] */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [page_ = 'stickers.html', name = 'gallery', w = '1100', h = '700'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8099'}/game-099/dev/${page_}`);
await page.waitForFunction(() => document.title === 'ready', null, { timeout: 15000 });
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
await browser.close();
console.log('shot dev/shots/' + name + '.png');
