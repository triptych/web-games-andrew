// preview.mjs — the 1200×630 picture the Garden's Library and share links use: a mid-game floor with runes,
// rooms, a monster and the HUD, set up through the debug hooks. Writes garden/img/games/game-141.jpg.
//   python3 -m http.server 8141   (repo root)  ·  node game-141/dev/preview.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const OUT = path.join(HERE, '../../garden/img/games/game-141.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => { const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort(); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto('http://127.0.0.1:8141/game-141/index.html?debug=1');
await page.waitForFunction(() => window.__ss, null, { timeout: 60000 });
await page.evaluate(async () => {
    __ss.start(2024);
    await new Promise((r) => setTimeout(r, 800));
    __ss.bot(4000, 0.9, (g) => g.n >= 7 && g.F.cells.filter((c) => c.k === 'o').length > 26);
    __ss.ui.closeAll();
    __ss.ui.talkQ.length = 0; __ss.ui.nextTalk();
    // wake a monster on an open tile for the picture, if none is up
    const F = __ss.G.F;
    if (!F.cells.some((c) => c.o?.t === 'mon')) {
        const i = F.cells.findIndex((c, k) => c.k === 'o' && !c.o && k !== F.start);
        if (i >= 0) F.cells[i].o = { t: 'mon', id: 'cobra', hp: 9, mx: 12, atk: 4, gold: 9, stun: 0 };
    }
    __ss.view.sync(__ss.G);
    document.getElementById('actions').hidden = true;
    document.getElementById('floorbar').hidden = true;
    __ss.ui.insets = () => ({ top: 64, bottom: 6, right: 0 });
});
await page.waitForTimeout(6000);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', OUT);
await browser.close();
