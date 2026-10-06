// Opens the real game with ?debug=1 and runs snippets (S = window.__ts) with pauses between them,
// taking "SHOT:name" screenshots along the way and a final one.
//   node game-063/dev/play.mjs name "js;;SHOT:a;;js" [waitMs] [w h] [touch] [query]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8063/game-063/';
const [name = 'play', script = '', wait = 1500, w = 1280, h = 760, touch = '', query = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!touch, isMobile: !!touch, deviceScaleFactor: touch ? 2 : 1 });
const page = await ctx.newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => { const rel = new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); const f = path.join(PKG, rel); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort(); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
let nlog = 0;
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && nlog++ < 15) console.log(m.type(), m.text().slice(0, 500)); });
page.on('pageerror', (e) => console.log('pageerror', e.message, (e.stack ?? '').split('\n').slice(1, 4).join(' | ')));
await page.goto(BASE + 'index.html?debug=1' + (query ? '&' + query : ''));
await page.waitForFunction('window.__ts !== undefined', null, { timeout: 60000 });
await page.waitForTimeout(1500);
for (const step of script.split(';;').filter(Boolean)) {
    if (step.startsWith('SHOT:')) { await page.screenshot({ path: path.join(HERE, 'shots', step.slice(5) + '.png') }); console.log('shot', step.slice(5)); continue; }
    if (step.startsWith('KEY:')) { await page.keyboard.press(step.slice(4)); await page.waitForTimeout(150); continue; }
    if (step.startsWith('WAIT:')) { await page.waitForTimeout(+step.slice(5)); continue; }
    if (step.startsWith('CLICK:')) { await page.click(step.slice(6)); await page.waitForTimeout(200); continue; }
    try { const r = await page.evaluate(`(() => { const S = window.__ts; ${step} })()`); if (r !== undefined) console.log('=>', JSON.stringify(r).slice(0, 400)); } catch (e) { console.log('step error', e.message.slice(0, 300)); }
    await page.waitForTimeout(+wait);
}
await page.screenshot({ path: path.join(HERE, 'shots', name + '.png') });
await browser.close();
