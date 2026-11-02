/**
 * preview.mjs — the 1200×630 launcher picture: a duel in Frosthold with the full band mid-song.
 *
 *   python3 -m http.server 8113     # repo root
 *   node game-113/dev/preview.mjs   # → garden/img/games/game-113.jpg (and dev/shots/preview.png)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8113';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => { const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort(); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-113/index.html?debug=1&fast=2&q=2`);
await page.waitForFunction(() => window.__ccr && __ccr.mode === 'title', null, { timeout: 90000 });
await page.evaluate(() => { __ccr.chapter('frosthold', 9); __ccr.battle('rimefang'); __ccr.autoplay(true, 0.92); document.getElementById('back-link').style.display = 'none'; });
// past the swirl and the shader compile, into a PLAY phrase with notes on every lane
await page.waitForFunction(() => { const B = __ccr.G.battle; return B && !__ccr.view.busy && B.t > 8 && B.ph.kind === 'play' && B.t - B.ph.start > 1.2 && B.combo > 6; }, null, { timeout: 600000, polling: 100 });
await page.evaluate(() => __ccr.autoplay(false));
await page.waitForTimeout(400);
const png = path.join(HERE, 'shots', 'preview.png');
await page.screenshot({ path: png, timeout: 120000 });
const jpg = path.join(ROOT, 'garden/img/games/game-113.jpg');
await page.screenshot({ path: jpg, type: 'jpeg', quality: 86, timeout: 120000 });
console.log('wrote', path.relative(ROOT, jpg));
await browser.close();
