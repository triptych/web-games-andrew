/**
 * preview.mjs — the 1200×630 Library and share picture (garden/img/games/game-012.jpg): a battle in full swing at
 * the Falling Spire, a strong spread of Major Arcana against the Tower's Hollows.
 *
 *   node game-012/dev/preview.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, serve, BASE } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../garden/img/games/game-012.jpg');
const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await serve(page);
await page.goto(`${BASE}/game-012/index.html?debug=1`);
await page.waitForFunction(() => window.__ap && window.__ap.frames > 3);
await page.evaluate(() => {
    const ap = window.__ap;
    ap.start(4242);
    const G = ap.G;
    for (const id of ['m04', 'm16', 'm17', 'm01']) G.owned[id] = { star: 3, copies: 0 };
    G.party = ['m04', 'm16', 'm17', 'm01'];
    G.trial = 7;
    ap.settings.speed = 1;
    ap.act({ t: 'fight' });
    document.getElementById('subtitle').hidden = true;
});
// wait for the first skills to land, then catch a frame with numbers in the air
await page.waitForFunction(() => window.__ap.stage.t > 7, null, { timeout: 60000 });
await page.evaluate(() => { window.__ap.stage.speed = 0.0001; document.getElementById('subtitle').hidden = true; document.getElementById('toasts').innerHTML = ''; document.getElementById('back-link').hidden = true; });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote', path.relative(process.cwd(), OUT));
