/**
 * shot.mjs — screenshot the model gallery (dev/models.html) on a neutral background.
 *
 *   node game-096/dev/shot.mjs                      # all sets
 *   SETS=pinch,enemies node game-096/dev/shot.mjs
 *   SET=pinch Q="&state=glide&shell=3" node game-096/dev/shot.mjs
 *
 * Writes game-096/dev/shots/models-<set>.png. Judge the characters here before they go under fog and light.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8096';
const SETS = (process.env.SETS || process.env.SET || 'pinch,shells,enemies,bosses,props,curios').split(',');
const W = +(process.env.W || 1400), H = +(process.env.H || 600);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const set of SETS) {
    await page.goto(`${BASE}/game-096/dev/models.html?set=${set}${process.env.Q || ''}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(HERE, 'shots', `models-${set}.png`) });
    console.log('shot', set);
}
await browser.close();
