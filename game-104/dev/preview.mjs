/**
 * preview.mjs: write the Library preview, garden/img/games/game-104.jpg (1200×630), from a moment
 * set up through the debug hooks: the Hanged Oak, Mother Gammer called up, Bryony at your side.
 *   node game-104/dev/preview.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8104';
const OUT = path.join(HERE, '../../garden/img/games/game-104.jpg');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-104/index.html?debug=1&fast=1`);
await page.waitForFunction(() => window.__hh);
await page.evaluate(() => {
    __hh.start(3);
    __hh.walk(79); // to the oak: Bryony, Sight not yet; stop after calling Gammer
    const G = __hh.G;
    G.room = 'oak'; G.party.includes('bryony') || G.party.push('bryony');
    G.npcLoc.bryony = 'oak';
    __hh.run('use rue on roots'); __hh.run('say gammer'); __hh.run('look');
    __hh.ui.roomName('The Hanged Oak');
    document.getElementById('stage').style.width = '880px';
    document.getElementById('quick').style.display = 'none';
});
await page.waitForTimeout(1500);
await page.waitForFunction(() => document.getElementById('card').hidden, null, { timeout: 6000 }).catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();
