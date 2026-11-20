// The Garden preview (1200×630): Lyra's vow in the prologue, over the painted village.
//   node game-028/dev/preview.mjs  → garden/img/games/game-028.jpg
import { launch, serve, BASE } from './serve.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await serve(page);
await page.goto(`${BASE}/game-028/index.html?debug=1`);
await page.waitForFunction(() => window.__ea && !document.getElementById('title').hidden, null, { timeout: 60000 });
await page.evaluate(() => { window.__ea.start(2); for (let i = 0; i < 6; i++) window.__ea.send({ t: 'next' }); });
await page.waitForTimeout(400);
await page.evaluate(() => { document.getElementById('card').hidden = true; window.__ea.vn.complete(); document.getElementById('back-link').style.display = 'none'; document.getElementById('toasts').innerHTML = ''; });
await page.waitForTimeout(600);
await page.screenshot({ path: 'garden/img/games/game-028.jpg', type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote garden/img/games/game-028.jpg');
