/**
 * preview.mjs — the 1200×630 picture the Garden's Library and share links use (garden/img/games/game-149.jpg).
 * Sets up a visual-novel moment through the debug hooks: the Starfall Festival, Hana, Pip and Lys on stage.
 *
 *   python3 -m http.server 8149    # repo root
 *   node game-149/dev/preview.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PKG = [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8149';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''))) }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-149/index.html?debug=1`);
await page.waitForFunction(() => window.__ea, null, { timeout: 60000 });
await page.evaluate(() => {
    __ea.start(7);
    const V = __ea.G.vn;
    V.wait = null; V.choices = null;
    V.bg = 'festival';
    V.show = { left: { who: 'pip', expr: 'happy' }, center: { who: 'hana', expr: 'happy' }, right: { who: 'lys', expr: 'blush' } };
    V.say = { who: 'hana', expr: 'happy', text: 'The Starfall Festival is starting, Echo Boy! So... who are you asking to the dance?', voice: null };
    __ea.vnv.settings.text = 'instant';
});
await page.waitForTimeout(2500);
await page.evaluate(() => { for (const id of ['back-link', 'vn-tools', 'toasts']) document.getElementById(id).style.visibility = 'hidden'; });
const out = path.join(ROOT, 'garden/img/games/game-149.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
console.log('wrote', path.relative(ROOT, out));
await browser.close();
