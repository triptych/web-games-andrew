/**
 * shot.mjs — screenshot a dev page (default: cards.html, every tarot card on a neutral background).
 *
 *   node game-111/dev/shot.mjs [page.html] [w] [h]
 *
 * Screenshot: game-111/dev/shots/<page>.png.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8111';
const [page0 = 'cards.html', w = '1400', h = '1300'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-111/dev/${page0}`);
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
await page.waitForTimeout(300);
const out = path.join(HERE, 'shots', page0.replace(/\.html$/, '.png'));
await page.screenshot({ path: out, fullPage: true });
console.log('shot', path.relative(process.cwd(), out));
await browser.close();
