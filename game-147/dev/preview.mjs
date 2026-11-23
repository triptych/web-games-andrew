/**
 * preview.mjs — the 1200×630 picture the Garden's Library and share links use (garden/img/games/game-147.jpg).
 * Sets up a moment through the debug hooks: the whole party facing the Grand Morel in the Mushroom Grove.
 *
 *   python3 -m http.server 8147    # repo root
 *   node game-147/dev/preview.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PKG = [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8147';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''))) }));
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-147/index.html?debug=1`);
await page.waitForFunction(() => window.__iomh, null, { timeout: 60000 });
await page.evaluate(() => {
    const I = __iomh;
    I.start(7);
    const G = I.G;
    for (const h of ['ember', 'kit', 'fern', 'bru']) { G.heroes[h].joined = true; G.heroes[h].lv = 9; G.recruits[h].stage = 'joined'; }
    G.heroes.maple.lv = 10;
    G.party = ['maple', 'ember', 'kit', 'bru'];
    G.debt.tier = 2; G.quest.chapter = 2;
    I.act({ t: 'depart', region: 'grove' });
    I.act({ t: 'fight', boss: true });
    G.battle.chain = 72;
});
// let the heroes run in and the models and clips load, then hide the command menu for a clean picture
await page.waitForFunction(() => !__iomh.busy() && __iomh.view.battle.units.maple?.actor.model && __iomh.view.battle.units.grandmorel?.actor?.model !== undefined, null, { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(4000);
await page.evaluate(() => { document.getElementById('commands').style.visibility = 'hidden'; document.getElementById('back-link').style.visibility = 'hidden'; });
const out = path.join(ROOT, 'garden/img/games/game-147.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 85 });
console.log('wrote', path.relative(ROOT, out));
await browser.close();
