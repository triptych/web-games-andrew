import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.stack || e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.goto('http://127.0.0.1:8076/game-076/index.html');
await p.evaluate(() => localStorage.clear()); await p.reload();
await p.waitForFunction(() => window.__tal);
await p.click('.modecard');
await p.waitForSelector('.scene');
await p.click('.scskip');
// paint a stroke of water and some trees
const box = await p.locator('.mapscroll').boundingBox();
const pal = await p.locator('canvas.palette').boundingBox();
const tile = async (n) => { const col = (n - 1) % 8, row = Math.floor((n - 1) / 8); const k = pal.width / 8; await p.mouse.click(pal.x + col * k + k / 2, pal.y + row * k + k / 2); };
await tile(7); // water
await p.mouse.move(box.x + 200, box.y + 300); await p.mouse.down();
for (let i = 0; i < 12; i++) await p.mouse.move(box.x + 200 + i * 30, box.y + 300 + (i % 3) * 10);
await p.mouse.up();
await tile(5); // path
await p.mouse.move(box.x + 120, box.y + 450); await p.mouse.down();
for (let i = 0; i < 16; i++) await p.mouse.move(box.x + 120 + i * 32, box.y + 450);
await p.mouse.up();
await tile(13); // oak (decor)
for (const [x, y] of [[150, 200], [500, 200], [600, 520], [250, 560]]) await p.mouse.click(box.x + x, box.y + y);
await p.click('#tool-start'); await p.mouse.click(box.x + 320, box.y + 420);
await p.waitForTimeout(800);
await p.screenshot({ path: 'game-076/dev/shots/editor.png' });
console.log(await p.evaluate(() => ({ painted: __tal.meta.data.stats.painted, ink: __tal.meta.data.ink, quests: Object.keys(__tal.meta.data.quests) })));
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await b.close();
