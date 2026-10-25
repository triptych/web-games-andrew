/**
 * preview.mjs — the 1200×630 share and Garden Library picture: a close-up fight, mid-breath.
 *
 * The generic dev/screenshots.mjs pokes a game past its title screen, but Wyrmbond's title has a menu
 * and a story before the first battle, so that script photographs the title. This one sets up the
 * picture through the debug hooks instead: a grown flock in Grisk's Den, an adult Pyrewyrm breathing
 * fire on a collared Thornback (made sturdy enough to survive the first blow, so the counter-breath
 * happens too), the fight slowed to a quarter speed, and a frame every 0.4 s. It writes the frames to
 * dev/shots/preview-<n>.jpg; copy the best one to garden/img/games/game-098.jpg.
 *
 *   python3 -m http.server 8098          # from the REPO ROOT
 *   node game-098/dev/preview.mjs
 *   cp game-098/dev/shots/preview-5.jpg garden/img/games/game-098.jpg
 *
 * Env: BASE (default http://127.0.0.1:8098), FRAMES (default 16), THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8098';
const FRAMES = +(process.env.FRAMES || 16);
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (r) => {
        const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort();
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-098/index.html?debug=1&fast=2`);
await page.waitForFunction(() => window.__wb, null, { timeout: 60000 });
// the "← Games" link is page chrome, not part of the picture; so is the Skip button
await page.addStyleTag({ content: '#back-link{visibility:hidden!important} #btn-skipfight{display:none!important}' });
await page.evaluate(async () => {
    const wait = (f) => new Promise((r) => { const t = setInterval(() => { if (f()) { clearInterval(t); r(); } }, 50); });
    const { makeDragon } = await import('./js/sim/dragons.js');
    const { act } = await import('./js/sim/game.js');
    __wb.start(11, 'cinderwing');
    const G = __wb.G;
    for (const [sp, lv] of [['pyrewyrm', 22], ['tempestra', 20], ['frostmaw', 19], ['pebblescale', 20], ['zephyrling', 21]]) {
        G.meta.dragons.push(makeDragon(G, sp, { lv, genes: { hp: 12, atk: 13, def: 11, spd: 12 } }));
    }
    G.meta.party = G.meta.dragons.slice(1).map((d) => d.rid);
    __wb.battle(2);
    await wait(() => __wb.mode === 'battle');
    __wb.skipTalk();
    await wait(() => !__wb.play.busy && __wb.G.battle.phase === 'p');
    const B = G.battle;
    const me = B.units.find((u) => u.key === 'pyrewyrm');
    const foe = B.units.find((u) => u.chained);
    me.x = foe.x - 1; me.y = foe.y;
    Object.assign(foe, { lv: 21, hpMax: 120, hp: 120, def: 34, atk: 40, stage: 'adult' });
    act(G, { t: 'act', id: me.id, to: [me.x, me.y], do: 'attack', target: [foe.x, foe.y] });
    __wb.view.speed = 0.25;          // slow the fight so the frames land mid-breath
    await wait(() => __wb.view.stage.mode === 'arena');
});
for (let i = 0; i < FRAMES; i++) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `preview-${i}.jpg`), type: 'jpeg', quality: 82 });
}
await browser.close();
console.log(`${FRAMES} frames in ${path.relative(process.cwd(), OUT)}/preview-*.jpg`);
