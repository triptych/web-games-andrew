/**
 * shot.mjs — screenshot a dev page (by default the art gallery) to dev/shots/.
 *
 *   node game-087/dev/shot.mjs [page] [name] [w h]
 *   node game-087/dev/shot.mjs gallery.html gallery 1300 1900
 *
 * Judge Thalion's moods, the foes, the sigils and the maps here, on a neutral background, before
 * judging them in the game.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8087';
const [pg = 'gallery.html', name = 'gallery', w = '1300', h = '1900'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-087/dev/${pg}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 20000 }).catch(() => {});
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();
