/**
 * smoke.mjs — visits every screen once (desktop + phone), screenshots each,
 * and fails on any console error or page error.  BASE / OUT env vars as in shots.mjs.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8050';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const SCREENS = (process.env.ONLY || 'citadel,heroes,hero,summon,adventure,quests,creator,treasury,training,market,bag,forge,tavern,overlord,settings,arena,mine,farm,spire,team').split(',');
const sizes = process.env.SIZES ? JSON.parse(process.env.SIZES) : [[390, 844, 'phone'], [1280, 760, 'desk']];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
for (const [w, hgt, tag] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('https://unpkg.com/**', (route) => {
        const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
        const file = path.join(PKG, rel);
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}\n${e.stack}`));
    await page.goto(`${BASE}/game-050/index.html?debug=1`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    await page.evaluate(() => { __sb.newGame(); __sb.G.S.story.tips = { mine: 1, farm: 1 }; __sb.summon(__sb.G.S, 'mystic', 3); __sb.grant({ gold: 50000, items: { xpM: 3, chest: 2, seedPack: 2 }, ores: { copper: 40 } }); });
    for (const s of SCREENS) {
        const params = s === 'hero' ? { id: 3 } : s === 'team' ? { mode: 'campaign', idx: 0 } : s === 'creator' ? { mode: 'overlord' } : {};
        await page.evaluate(([s, p]) => __sb.go(s, p), [s, params]);
        await page.waitForTimeout(+(process.env.WAIT || 900));
        await page.screenshot({ path: path.join(OUT, `${tag}-${s}.png`) });
        process.stdout.write(`${tag}:${s} `);
    }
    await ctx.close();
}
await browser.close();
console.log('\n' + (errors.length ? errors.join('\n') : 'no errors'));
process.exit(errors.length ? 1 : 0);
