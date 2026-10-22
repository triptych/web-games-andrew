/**
 * play.mjs — open the real game, run a snippet, take a screenshot. For iterating on visuals.
 *   node game-093/dev/play.mjs <name> "<js run after boot>" [waitMs] [w h] [touch]
 * Snippet runs with ?debug=1 so window.__ds is there. `return` prints a value. Q='&seed=5&q=low' adds URL params.
 */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8093';
const [name = 'shot', code = '', wait = '1200', w = '1280', h = '720', touch = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const isTouch = touch === 'touch';
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => { const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); if (!fs.existsSync(file)) return route.abort(); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400), (e.stack || '').split('\n').slice(1, 4).join(' | ')));
await page.goto(`${BASE}/game-093/index.html?debug=1&q=low${process.env.Q || ''}`);
await page.waitForFunction(() => window.__ds, null, { timeout: 60000 });
if (code) { const out = await page.evaluate(`(async () => { ${code} })()`); if (out !== undefined) console.log(JSON.stringify(out, null, 1)); }
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', name);
await browser.close();
