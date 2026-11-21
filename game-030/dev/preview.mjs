// The Garden preview (1200×630): the party facing Big Bertha in her lair.
//   node game-030/dev/preview.mjs  → garden/img/games/game-030.jpg
import { launch, serve, BASE } from './serve.mjs';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await serve(page);
await page.goto(`${BASE}/game-030/index.html?debug=1`);
await page.waitForFunction(() => window.__cl && !document.getElementById('title').hidden, null, { timeout: 60000 });
await page.evaluate(async () => {
    const { healAll } = await import('/game-030/js/sim/rules.js');
    const cl = window.__cl;
    cl.start(2);
    for (let i = 0; i < 6; i++) cl.send({ t: 'next' });
    const G = cl.G;
    for (const id of ['trina', 'mabel']) { G.party.push(id); G.equip[id] = { weapon: null, armor: null }; }
    G.level = 6; G.map = 'lair'; G.x = 8; G.y = 8;
    healAll(G);
    cl.warp('lair', 8, 8);
    cl.fight('bertha', true);
});
await page.waitForTimeout(3500);
await page.evaluate(() => { document.getElementById('back-link').style.display = 'none'; document.getElementById('toasts').innerHTML = ''; });
await page.waitForTimeout(600);
await page.screenshot({ path: 'garden/img/games/game-030.jpg', type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote garden/img/games/game-030.jpg');
