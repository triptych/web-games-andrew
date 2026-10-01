/** perf.mjs — draw calls / triangles / programs per 3D stage (dev aid). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, 'package');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 390, height: 844 } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto('http://127.0.0.1:8050/game-051/index.html?debug=1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await page.evaluate(() => { __sb.newGame(); __sb.G.S.story.tips = { mine: 1, farm: 1 }; __sb.G.S.res.sigils.mystic = 5; __sb.summon(__sb.G.S, 'mystic', 5); });
for (const [s, p] of [['citadel', {}], ['summon', {}], ['hero', { id: 3 }], ['mine', {}], ['farm', {}], ['spire', {}], ['battle', { mode: 'campaign', idx: 30, team: [1, 2, 3, 4, 5] }]]) {
    await page.evaluate(([s, p]) => __sb.go(s, p), [s, p]);
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => __sb.renderInfo());
    console.log(s.padEnd(8), JSON.stringify(info));
}
await b.close();
