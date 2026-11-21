/**
 * preview.mjs — the 1200×630 picture the Garden's Library and share links show: a moment set up through the debug
 * hooks (the Azure Seraph with four options under the Bellwether's guns), not the title menu.
 *
 *   python3 -m http.server 8144 &        # repo root
 *   node game-144/dev/preview.mjs        # → garden/img/games/game-144.jpg
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../../garden/img/games/game-144.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8144'}/game-144/index.html?debug=1`);
await page.waitForFunction(() => window.__nr, null, { timeout: 60000 });
await page.evaluate(() => {
    __nr.start(21, { pilot: 'sora' });
    const G = __nr.G;
    G.god = true; G._script = { script: [], end: 0 }; G.scriptI = 0;
    Object.assign(G.player, { power: 6, options: 4, rockets: 2, halo: 1, shield: 2 });
    __nr.ff(13);
    // the core is open: break the engines so the fight is in its second phase
    for (const e of G.enemies) if (e.part === 'engine') e.hp = 1;
    __nr.ff(4);
    G.player.x = 9; G.player.y = 7;
    for (const id of ['banner', 'warning', 'radio', 'callout', 'back-link']) document.getElementById(id).style.display = 'none';
});
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();
