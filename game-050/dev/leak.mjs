/** leak.mjs — geometry/texture counts across repeated battles and scene visits (dev aid). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, 'package');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 800, height: 600 } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8050/game-050/index.html?debug=1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await page.evaluate(() => { __sb.newGame(); __sb.G.S.story.tips = { mine: 1, farm: 1 }; __sb.G.S.res.sigils.mystic = 5; __sb.summon(__sb.G.S, 'mystic', 5); });
for (let round = 0; round < 4; round++) {
    for (const [s, p] of [['citadel', {}], ['hero', { id: 3 }], ['battle', { mode: 'campaign', idx: 10, team: [1, 2, 3, 4, 5] }], ['summon', {}], ['farm', {}], ['mine', {}]]) {
        await page.evaluate(([s, p]) => __sb.go(s, p), [s, p]);
        await page.waitForTimeout(700);
    }
    console.log('round', round, JSON.stringify(await page.evaluate(() => __sb.renderInfo())));
}
await b.close();
