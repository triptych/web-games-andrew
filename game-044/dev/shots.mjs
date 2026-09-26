// Quick screenshots. Usage: node dev/shots.mjs [scene ...]   (needs a server on the repo root)
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8044';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}/game-044/index.html?debug=1`);
await page.waitForTimeout(800);
await page.screenshot({ path: 'game-044/dev/shots/title.png' });
const scenes = process.argv.slice(2);
await page.evaluate(() => { document.getElementById('title').hidden = true; });
for (const s of scenes) {
    await page.evaluate(async (s) => {
        const G = window.__game;
        G.E.running = true;
        await G.enterScene(s, { runEnter: false });
    }, s);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `game-044/dev/shots/${s}.png` });
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
