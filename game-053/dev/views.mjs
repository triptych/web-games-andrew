// Renders every page's 3D view into a contact sheet: node views.mjs out.png [minutes]
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.join(HERE, 'package');
const out = process.argv[2] || path.join(HERE, 'shots', 'views.png');
const minutes = +(process.argv[3] || 720);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('jadewyrm.prefs', JSON.stringify({ quality: process.env?.Q || 'high', motion: false })); } catch {} });
const page = await ctx.newPage();
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('http://127.0.0.1:8053/game-053/index.html?debug=1&seed=views');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.evaluate(() => __jw.quickStart({ name: 'Views' }));
const views = (process.env.VIEWS || 'village,inn,weapons,armor,bank,training,stables,gypsy,gardens,stone,notice,guilds,lodge,fields,forest,healer,shades,mausoleum,lair,dawn').split(',');
const tiles = [];
for (const v of views) {
    await page.evaluate(([v, m]) => { __jw.scene.setView(v); __jw.scene.snapView(); __jw.scene.setTime(m, v !== 'shades' && v !== 'mausoleum'); }, [v, minutes]);
    await page.waitForTimeout(900);
    const file = path.join(HERE, 'shots', `view-${v}.png`);
    const r = await page.evaluate(() => { const b = document.getElementById('scenewin').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
    await page.screenshot({ path: file, clip: r });
    tiles.push([v, file]);
}
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1320, height: 900 });
await sheet.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,1fr);gap:3px">${tiles.map(([v, f]) => `<div style="position:relative"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:100%;display:block"><span style="position:absolute;right:6px;top:4px;color:#fff;font:13px sans-serif;text-shadow:0 1px 2px #000">${v}</span></div>`).join('')}</body>`);
await sheet.screenshot({ path: out, fullPage: true });
await browser.close();
