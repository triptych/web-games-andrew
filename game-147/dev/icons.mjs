/**
 * icons.mjs — render every item model (models/item-*.glb, Meshy) as a 128 px transparent icon: art/icons/<id>.webp.
 *
 *   python3 -m http.server 8147        # repo root
 *   node game-147/dev/icons.mjs
 *
 * The UI shows these in the bag, the shop, the kitchen and the loot list (an emoji stands in for a missing one).
 * Needs Pillow for the WebP conversion (python3 -I, run per file).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const OUT = path.join(HERE, '../art/icons');
fs.mkdirSync(OUT, { recursive: true });
const names = fs.readdirSync(path.join(HERE, '../models')).filter((f) => f.startsWith('item-') && f.endsWith('.glb')).map((f) => f.slice(0, -4));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 128, height: 128 } })).newPage();
await page.route('https://unpkg.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''))) }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:8147/game-147/dev/icons.html');
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
const tmp = path.join(HERE, 'shots', '_icon.png');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
for (const n of names) {
    const url = await page.evaluate((x) => window.renderIcon(x), n);
    fs.writeFileSync(tmp, Buffer.from(url.split(',')[1], 'base64'));
    const dst = path.join(OUT, n.slice(5) + '.webp');
    execFileSync('python3', ['-I', '-c', `from PIL import Image; Image.open(${JSON.stringify(tmp)}).save(${JSON.stringify(dst)}, 'WEBP', quality=88, method=6)`]);
}
fs.unlinkSync(tmp);
console.log('rendered', names.length, 'icons into art/icons/');
await browser.close();
