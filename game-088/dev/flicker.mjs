/**
 * flicker.mjs — how much does the still board flicker? Opens a dig, lets the board settle, then
 * reads ~40 frames back and reports the share of sample points whose luminance swung by more than
 * 0.25 (on 0..1) and the largest swing. Nobody touches the board while it measures, so any big
 * swing is a highlight or an effect blinking, not play.
 *
 *   node game-088/dev/flicker.mjs [level] [w h]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8088';
const [level = '1', w = '390', h = '844'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => { const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); if (!fs.existsSync(f)) return r.abort(); r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/${process.env.GAME || 'game-088'}/index.html?debug=1&fast=4`);
await page.waitForFunction(() => window.__cc);
await page.evaluate((n) => { __cc.start(3); __cc.G.level = Math.max(0, n - 1); __cc.dig(n); }, +level);
await page.waitForFunction(() => { if (__cc.ui.inScene()) __cc.ui.endScene(); return !__cc.busy && __cc.frames > 40; }, null, { timeout: 120000, polling: 200 });
await page.waitForTimeout(2500);
await page.evaluate((st) => { window.__still = st; }, process.env.STILL === '1');
await page.evaluate(() => { __cc.ui.inScene() && __cc.ui.endScene(); __cc.digView.idle = -1e9; __cc.digView.still = !!window.__still; __cc.stage.armSampler(); });
await page.waitForFunction(() => __cc.stage.sampler.frames >= 40, null, { timeout: 180000, polling: 200 });
const r = await page.evaluate(() => { const s = __cc.stage.swing(0.25); __cc.stage.sampler = null; return s; });
console.log(JSON.stringify({ level: +level, size: `${w}x${h}`, still: process.env.STILL === '1', frames: r.frames, swingShare: +(r.share * 100).toFixed(3) + '%', maxSwing: +r.max.toFixed(3) }));
if (process.env.WHERE) console.log(JSON.stringify(r.where.filter((p) => p[2] > 0.5)));
await browser.close();
