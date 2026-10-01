/**
 * probe.mjs — quick look at one screen: loads the game, runs an optional script of
 * debug-hook calls, and saves a screenshot. Handy while iterating on visuals.
 *
 *   node game-050/dev/probe.mjs [title|town|battle] [WxH]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8050';
const what = process.argv[2] || 'title';
const [vw, vh] = (process.argv[3] || '1280x800').split('x').map(Number);
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
const page = await ctx.newPage();
await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`${BASE}/game-050/index.html?debug=1`);
await page.waitForFunction(() => window.__tb, null, { timeout: 60000 });
await page.waitForTimeout(1500);
if (what !== 'title') {
    await page.evaluate(() => __tb.newGame('mage', 'Wren'));
    await page.waitForTimeout(800);
    await page.evaluate(() => __tb.skipStory());
    await page.evaluate(() => { __tb.give({ gold: 5000, wood: 5000, stone: 5000 }); __tb.xp(3000); });
    await page.evaluate(() => { const G = __tb.G; for (const id of ['lumber', 'market', 'quarry', 'guild', 'training']) { G.placing = id; G.placeAt(undefined); } });
    await page.waitForTimeout(500);
    await page.evaluate(() => __tb.skipStory());
}
if (what === 'battle') {
    await page.evaluate(() => __tb.fight({ type: 'node', wing: 0, node: 0 }));
    await page.waitForTimeout(800);
    await page.evaluate(() => __tb.skipStory());
    await page.waitForTimeout(2500);
    for (let i = 0; i < 3; i++) { await page.evaluate(() => __tb.botMove()); await page.waitForTimeout(2500); }
}
await page.waitForTimeout(1200);
const file = path.join(OUT, `probe-${what}-${vw}x${vh}.png`);
await page.screenshot({ path: file });
console.log(logs.filter((l) => !l.startsWith('debug') && !l.includes('GPU stall')).slice(0, 40).join('\n'));
if (process.env.EVAL) console.log('eval', JSON.stringify(await page.evaluate(process.env.EVAL)));
console.log('state', JSON.stringify(await page.evaluate(() => __tb.state())));
console.log('saved', file);
await browser.close();
