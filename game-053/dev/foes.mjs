// Renders one foe of each kind in the clearing and tiles them: node foes.mjs out.png
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.join(HERE, 'package');
const out = process.argv[2] || path.join(HERE, 'shots', 'foes.png');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('jadewyrm.prefs', JSON.stringify({ quality: 'low', motion: false })); } catch {} });
const page = await ctx.newPage();
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('http://127.0.0.1:8053/game-053/index.html?debug=1&seed=foes');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.evaluate(() => __jw.quickStart({ name: 'Foes' }));
const kinds = [['beast', 0x4a4a52, 'Dire Wolf'], ['humanoid', 0x6f9a3b, 'Goblin'], ['brute', 0x4a6a4a, 'Forest Troll'], ['slime', 0x6fbf4a, 'Moss Slime'], ['flyer', 0x9a6a8a, 'Harpy'], ['spirit', 0xb0c8d8, 'Barrow Wight'], ['serpent', 0x3a6a5a, 'Hydra'], ['plant', 0x5a4a32, 'Treant'], ['insect', 0x8a3a1a, 'Centipede'], ['master', 0xc8a050, 'Master'], ['rival', 0x8a7a6a, 'Rival'], ['dragon', 0x1fae6a, 'The Jade Wyrm']];
const tiles = [];
for (const [kind, color, name] of kinds) {
    await page.evaluate(async ([kind, color, name]) => {
        const c = await import('./js/engine/combat.js');
        __jw.p.fight = null; __jw.scene.removeFoe();
        const f = { name, weapon: 'x', kind, color, level: 8, maxhp: 50, atk: 5, def: 5, gold: 1, exp: 1, death: '' };
        c.startFight(__jw.p, kind === 'dragon' ? 'wyrm' : 'forest', f, { mod: 0 });
        __jw.scene.showFoe(f); __jw.game.goto('fight'); __jw.scene.snapView();
        __jw.scene.foeState.mode = 'idle'; __jw.scene.foe.scale.setScalar(__jw.scene.foeState.scale);
    }, [kind, color, name]);
    await page.waitForTimeout(1500);
    const file = path.join(HERE, 'shots', `foe-${kind}.png`);
    const r = await page.evaluate(() => { const b = document.getElementById('scenewin').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
    await page.screenshot({ path: file, clip: r });
    tiles.push(file);
}
// contact sheet
const imgs = tiles.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1320, height: 900 });
await sheet.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${imgs.map((s, i) => `<div style="position:relative"><img src="${s}" style="width:100%;display:block"><span style="position:absolute;left:6px;top:4px;color:#fff;font:14px sans-serif;text-shadow:0 1px 2px #000">${kinds[i][0]}</span></div>`).join('')}</body>`);
await sheet.screenshot({ path: out, fullPage: true });
await browser.close();
