/**
 * shots.mjs — real Chromium screenshots of every screen and every theme, at phone portrait,
 * phone landscape and desktop sizes, into dev/shots/ (git-ignored). Fails on any console error.
 *
 *   python3 -m http.server 8042      (from the repo root)
 *   node dev/shots.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8042';
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const sizes = (process.env.SIZES || 'portrait,landscape,desktop').split(',');
const SIZE = {
    portrait: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};
const errors = [];
for (const name of sizes) {
    const ctx = await browser.newContext(SIZE[name]);
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${name}: ${e}`));
    await page.goto(`${BASE}/game-042/index.html`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}${name}-title.png` });
    // new game -> map
    await page.evaluate(() => { localStorage.clear(); });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}${name}-map.png` });
    const worlds = (process.env.WORLDS || '1-1,2-2,3-3,4-1,5-2,1-5').split(',');
    for (const wl of worlds) {
        const [w, i] = wl.split('-').map(Number);
        await page.evaluate(([w, i]) => {
            const P = window.__pip;
            const s = P.save;
            // unlock everything up to here for screenshots
            for (let a = 1; a <= 5; a++) for (let b = 1; b <= 5; b++) if (a < w || (a === w && b < i)) if (!s.cleared.includes(`${a}-${b}`)) s.cleared.push(`${a}-${b}`);
            s.gadgets = ['boots', 'frost', 'mitts', 'rocket'].slice(0, w - 1);
            s.weapons = ['pea', ...s.gadgets.filter(g => g === 'frost' || g === 'rocket')];
            P.enterLevel(w, i);
        }, [w, i]);
        await page.waitForTimeout(2600);
        // walk right for a bit
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(900);
        await page.keyboard.down('KeyX');
        await page.keyboard.press('KeyZ');
        await page.waitForTimeout(500);
        await page.keyboard.up('ArrowRight'); await page.keyboard.up('KeyX');
        await page.screenshot({ path: `${OUT}${name}-play-${w}-${i}.png` });
        if (i === 5) {
            // jump to the arena
            await page.evaluate(() => { const g = window.__pip.game; const a = g.arenaPx; g.player.x = a.x0 + 60; g.player.y = a.floor - 30; });
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${OUT}${name}-boss-${w}.png` });
        }
    }
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}${name}-pause.png` });
    await ctx.close();
}
await browser.close();
if (errors.length) { console.log('CONSOLE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ok, shots in', OUT);
