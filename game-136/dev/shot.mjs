/**
 * shot.mjs — screenshot a dev page (the model gallery) once it sets window.READY.
 *   node game-136/dev/shot.mjs gallery.html?size=1 gallery [w h]
 * Output: game-136/dev/shots/<name>.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8136';
const [page = 'gallery.html', name = 'gallery', w = '1600', h = '1300'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(`${BASE}/game-136/dev/${page}`);
await p.waitForFunction(() => window.READY, null, { timeout: 120000 });
await p.screenshot({ path: path.join(HERE, 'shots', name + '.png') });
console.log('shot', path.join('dev/shots', name + '.png'));
await browser.close();
