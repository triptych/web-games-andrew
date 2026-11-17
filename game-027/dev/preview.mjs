/**
 * preview.mjs — the launcher picture: a mid-level moment on the lattice (an exploration with a deposit
 * half uncovered, tiles in hand), 1200×630, written to garden/img/games/game-027.jpg.
 *
 *   node game-027/dev/preview.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, serve, BASE } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../../garden/img/games/game-027.jpg');
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await serve(page);
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-027/index.html?debug=1`);
await page.waitForFunction(() => window.__al && window.__al.frames > 3, null, { timeout: 90000 });
await page.evaluate(async () => {
    const a = window.__al;
    a.start(20271);
    a.skipScenes();
    const G = a.G;
    G.chapter = 2; G.tier = 2;
    G.skills = ['sight', 'vein'];
    G.shapes = ['mono', 'domH', 'domV', 'triH', 'triV', 'bendA', 'bendB', 'square', 'tetH', 'tetT', 'tetL'];
    a.toMap();
    a.go('n0_0');
    a.skipScenes();
    a.ui.closeScreen('brief');
    a.ff(9);
    await new Promise((r) => setTimeout(r, 2500));
});
await page.evaluate(() => { document.getElementById('back-link').style.display = 'none'; });
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();
