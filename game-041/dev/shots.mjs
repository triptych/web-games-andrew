// Quick visual pass: title + gameplay screenshots at phone portrait, phone landscape and desktop.
//   node dev/shots.mjs            (needs a static server at BASE serving the repo root)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const BASE = process.env.BASE ?? 'http://127.0.0.1:8041';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const sizes = [
    { name: 'portrait', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    { name: 'landscape', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    { name: 'desktop', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let bad = 0;
for (const s of sizes) {
    const ctx = await browser.newContext(s);
    // Pin FX to HIGH: SwiftShader is slow enough that auto-quality would drop to LOW
    // and the bloom/scanline pass would never be seen.
    await ctx.addInitScript(() => { try { localStorage.setItem('burrowguard.fx', 'high'); } catch {} });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${BASE}/game-041/index.html`);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, `${s.name}-title.png`) });
    await page.evaluate(() => {
        const bg = window.__burrowguard;
        bg.view.screen = 'game'; bg.game.newGame();
    });
    await page.waitForTimeout(2800);
    // Stage a busy scene: towers, a wave in flight, a pumped enemy.
    await page.evaluate(() => {
        const { game: g } = window.__burrowguard;
        g.gold = 500;
        const w = g.world;
        let n = 0;
        for (let r = 2; r < 17 && n < 6; r++) for (let c = 0; c < 13 && n < 6; c++) {
            const near = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => w.isTunnel(c+dx, r+dy) && r+dy > 0);
            if (near && w.buildable(c, r) && (c + r) % 3 === 0) { g.build(c, r, ['blaster','frost','arc','boomer'][n % 4]); n++; }
        }
        g.countdown = 0;
    });
    await page.waitForTimeout(6000);
    await page.evaluate(() => { const { game: g } = window.__burrowguard; g.selected = g.towers[0]; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${s.name}-play.png`) });
    // Power gem: everyone turns blue and runs.
    await page.evaluate(() => { const { game: g } = window.__burrowguard; g.selected = null; g.startFright(); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `${s.name}-fright.png`) });
    // Pump a grub, and have a drake breathe fire.
    await page.evaluate(() => {
        const { game: g } = window.__burrowguard;
        g.fright = 0.01;
        const p = g.player; p.inv = 1e9; p.fx = p.tx = 2; p.fy = p.ty = 0; p.x = 2; p.y = 0; p.dir = 0; p.t = 0;
        for (let c = 0; c < 13; c++) g.world.dig(c, 0);
        const e = g.spawnEnemy('grub', 0); e.fx = e.tx = 4; e.fy = e.ty = 0; e.x = 4; e.y = 0; e.inflate = 2.4; e.pumpT = 0;
        p.harpoon = { state: 'attached', len: 1.6, target: e };
        const d = g.spawnEnemy('drake', 1); d.fx = d.tx = 11; d.fy = d.ty = 0; d.x = 11; d.y = 0; d.face = 2; d.state = 'fire'; d.stateT = 5;
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${s.name}-pump.png`) });
    await page.evaluate(() => { const { game: g } = window.__burrowguard; g.gameOver('core'); });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(OUT, `${s.name}-gameover.png`) });
    const info = await page.evaluate(() => {
        const { game: g, renderer: R, view } = window.__burrowguard;
        return { phase: g.phase, enemies: g.enemies.length, towers: g.towers.length, post: R.post, deriv: R.deriv, w: R.w, h: R.h, fps: view.fps };
    });
    console.log(s.name, JSON.stringify(info), errors.length ? 'ERRORS(' + errors.length + '): ' + [...new Set(errors)].slice(0, 5).join(' | ') : 'no errors');
    if (errors.length) bad++;
    await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
