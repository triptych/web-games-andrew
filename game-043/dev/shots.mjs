/**
 * shots.mjs — screenshots of every screen at phone and desktop sizes into dev/shots/.
 * Fails (exit 1) on any console error or page error.
 *   node dev/shots.mjs            (needs `python3 -m http.server 8043` from the repo root)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8043';
mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
const out = n => new URL(`./shots/${n}.png`, import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const errors = [];
const sizes = (process.env.SIZES ?? '390x844,844x390,1280x800').split(',').map(s => s.split('x').map(Number));
for (const [w, hgt] of sizes) {
    const mobile = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${w}x${hgt}] ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${w}x${hgt}] ${e.stack || e}`));
    await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
    await page.goto(`${BASE}/game-043/index.html`);
    await page.waitForTimeout(1500);
    const tag = `${w}x${hgt}`;
    await page.screenshot({ path: out(`${tag}-01-title`) });
    await page.click('text=New Game');
    await page.waitForTimeout(400);
    await page.screenshot({ path: out(`${tag}-02-creator`), fullPage: false });
    await page.click('text=Begin your story');
    await page.waitForTimeout(400);
    await page.screenshot({ path: out(`${tag}-03-letter`) });
    await page.click('text=Travel to');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: out(`${tag}-04-arrive`) });
    // skip the intro dialog
    for (let k = 0; k < 6; k++) { await page.evaluate(() => window.__glim.ui.advanceDialog()); await page.waitForTimeout(60); }
    await page.evaluate(() => { const g = window.__glim.game; g.s.time.min = 12 * 60; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: out(`${tag}-05-glen`) });
    await page.evaluate(() => window.__glim.ui.panels.open('menu'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: out(`${tag}-06-bag`) });
    await page.evaluate(() => window.__glim.ui.panels.open('map'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: out(`${tag}-07-map`) });
    await page.evaluate(() => window.__glim.ui.panels.close());
    // a battle
    await page.evaluate(() => { const g = window.__glim.game; g.startBattle([{ sp: 'r1s0' }, { sp: 'r1s1' }], { region: 1, bg: 'forest' }); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: out(`${tag}-08-battle`) });
    await page.evaluate(() => window.__glim.ui.battle.act({ type: 'attack' }));
    await page.waitForTimeout(1600);
    await page.screenshot({ path: out(`${tag}-09-battle2`) });
    // night
    await page.evaluate(() => { const g = window.__glim.game; g.rt.battle = null; window.__glim.ui.endBattle(); g.s.time.min = 21 * 60; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: out(`${tag}-10-night`) });
    // a dungeon
    await page.evaluate(() => { const g = window.__glim.game; g.s.village.board = true; g.gotoFloor('d1', 1); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: out(`${tag}-11-dungeon`) });
    await ctx.close();
}
await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('shots ok');
