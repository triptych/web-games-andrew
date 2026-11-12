/**
 * preview.mjs — the 1200×630 preview for the Garden's Library and share links, from a real scene: day 1 in the
 * Docking Bay with Zorp, Kit and Orby. Writes garden/img/games/game-130.jpg (needs the static server on 8130).
 *
 *   node game-130/dev/preview.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8130';
const OUT = path.join(HERE, '../../garden/img/games/game-130.jpg');

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1260, height: 980 }, deviceScaleFactor: 1 })).newPage();
await page.goto(`${BASE}/game-130/index.html?debug=1`);
await page.waitForFunction(() => window.__ss);
await page.evaluate(async () => {
    __ss.start(11);
    while (__ss.G.queue.length) __ss.next();
    __ss.act({ t: 'go', room: 'dock' });
    __ss.G.kit.x = 300; __ss.G.kit.face = 1;
    await document.fonts.ready;
    for (const id of ['hud', 'talk', 'quiz', 'toasts', 'back-link']) document.getElementById(id).style.visibility = 'hidden';
});
await page.waitForTimeout(1200);
const box = await page.evaluate(() => { const r = document.getElementById('view').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
// the picture is 1260×709 here: crop 1200×630 from it, a little below the middle so the floor and feet stay in
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86, clip: { x: box.x + (box.width - 1200) / 2, y: box.y + (box.height - 630) * 0.7, width: 1200, height: 630 } });
console.log('wrote', path.relative(process.cwd(), OUT), Math.round(box.width), 'x', Math.round(box.height));
await browser.close();
