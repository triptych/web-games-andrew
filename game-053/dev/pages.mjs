// Screenshots of a list of pages at one viewport: node pages.mjs WxH page1,page2,...
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.join(HERE, 'package');
const [size = '1280x800', list = 'weapons,bank,inn,hof,lodge,mail'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 760, isMobile: w < 760 });
await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('jadewyrm.prefs', JSON.stringify({ quality: 'low', motion: false })); } catch {} });
const page = await ctx.newPage();
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto('http://127.0.0.1:8053/game-053/index.html?debug=1&seed=pages');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.evaluate(() => { __jw.quickStart({ name: 'Elspeth' }); const p = __jw.p; p.gold = 2400; p.gems = 6; p.level = 4; p.weapon = 3; p.armor = 2; p.charm = 7; p.renown = 70; p.deeds = { firstblood: 1, chat: 1, lvl5: 1 }; for (let i = 0; i < 6; i++) __jw.game.newDay(); });
for (const id of list.split(',')) {
    await page.evaluate((id) => { const [pid, arg] = id.split(':'); if (pid === 'letter') __jw.game.goto('mail', { read: __jw.p.mail[0].id }); else __jw.game.goto(pid, arg); __jw.scene?.snapView(); }, id);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(HERE, 'shots', `page-${id.replace(':', '-')}-${size}.png`) });
}
await browser.close();
