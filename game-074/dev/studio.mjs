/**
 * studio.mjs — screenshot dev/models.html (neutral lighting, no bloom).
 *   node game-074/dev/studio.mjs name "m=cael,vesper&yaw=0.6&t=0.3" [w h]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const [name = 'studio', qs = '', w = '1600', h = '700'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await b.newContext({ viewport: { width: +w, height: +h } })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => { const rel = new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:8074/game-074/dev/models.html?${qs}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('saved', name);
await b.close();
