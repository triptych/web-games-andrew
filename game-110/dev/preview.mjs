/**
 * preview.mjs — the 1200×630 share and Garden Library picture: a busy kitchen with the Overlord at work, minions,
 * décor and a flurry of hearts, with the logo over it. The generic dev/screenshots.mjs would photograph an empty
 * castle a moment after New Game; this sets the scene up through the debug hooks.
 *
 *   python3 -m http.server 8110          # from the REPO ROOT
 *   node game-110/dev/preview.mjs [room: cook|sew|deco|party]
 *   cp game-110/dev/shots/preview.jpg garden/img/games/game-110.jpg
 *   ONLY=game-110 node dev/add-meta.mjs
 *
 * Env: BASE (default http://127.0.0.1:8110), THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8110';
const [room = 'cook'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-110/index.html?debug=1`);
await page.waitForFunction(() => window.__dd);
await page.evaluate(async (r) => {
    __dd.start(7);
    __dd.give(1e15, 1e5);
    for (const [id, n] of [['imp', 6], ['cauldron', 5], ['golem', 4], ['spider', 6], ['loom', 3], ['bat', 5], ['gargoyle', 5], ['wraith', 4], ['portrait', 6], ['skeleton', 5], ['mimic', 4], ['lich', 3]]) __dd.send({ t: 'buy', id, n });
    for (const id of ['banners', 'oven', 'cakestand', 'roses', 'chandelier', 'organ', 'mirrorball', 'wheel', 'mannequins', 'throne']) __dd.send({ t: 'decor', id });
    __dd.send({ t: 'room', id: r });
    await new Promise((res) => setTimeout(res, 600));
    __dd.G.mastery[r] = 1e9;
    __dd.G.dread = 66;
    // the whole frame is the castle: no panels
    // (hidden, not display: none, so ui.layout() knows the panel is gone and frames the whole window)
    for (const id of ['panel', 'dock', 'abilities', 'hud', 'buffs', 'btn-visitor']) document.getElementById(id).hidden = true;
    for (const id of ['toasts', 'back-link', 'floaters']) document.getElementById(id).style.display = 'none';
    const css = document.createElement('style');
    css.textContent = `.poster { position: fixed; left: 34px; top: 26px; z-index: 30; pointer-events: none; }
      .poster h1 { font-family: 'Pirata One', Georgia, serif; font-weight: 400; font-size: 76px; margin: 0; line-height: 1; color: #fff;
        text-shadow: 4px 0 #2a1238, -4px 0 #2a1238, 0 4px #2a1238, 0 -4px #2a1238, 3px 3px #2a1238, -3px -3px #2a1238, 3px -3px #2a1238, -3px 3px #2a1238, 0 8px 0 #ff4f86; }
      .poster h1 span { color: #ff8fc2; }
      .poster p { margin: 12px 0 0 4px; font: 800 19px Nunito, system-ui, sans-serif; color: #fff; text-shadow: 0 2px 4px #000, 0 0 2px #2a1238; max-width: 470px; }`;
    document.head.appendChild(css);
    const d = document.createElement('div');
    d.className = 'poster';
    d.innerHTML = '<h1>Doom <span>&amp;</span> Doilies</h1><p>A cute evil overlord who would much rather be baking. An HD-2D idle game.</p>';
    document.body.appendChild(d);
}, room);
await page.waitForTimeout(3500);
// a flurry of crafting, so hearts are in the air
await page.evaluate(() => { for (let i = 0; i < 14; i++) __dd.send({ t: 'craft' }); });
await page.waitForTimeout(450);
const out = path.join(HERE, 'shots', 'preview.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
console.log('wrote', path.relative(process.cwd(), out));
await browser.close();
