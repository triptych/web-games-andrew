/**
 * fortuneclawtest.mjs — drives Madame Meridian and Plush Pier in the Lighthouse
 * Arcade in real Chromium: clicking the fortune teller wakes her and prints a
 * ticket whose card has a fortune and a lucky game (and that game's card opens
 * from it); clicking the claw machine steps you up to it, the keys move the
 * claw, a drop over a toy grabs at it, and a win puts the toy in the log with
 * its prize card. Every game has a toy. Screenshots along the way. Fails on any
 * console error or page error. Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/fortuneclawtest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), SHOTS=0 to skip screenshots,
 * PHONE=1 to run on a touch phone viewport instead.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const OUT = path.join(HERE, 'shots');
const SHOTS = process.env.SHOTS !== '0';
const PHONE = process.env.PHONE === '1';
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAILED: ' + msg + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
    console.log('  ok  ' + msg);
};
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.clear());
const page = await ctx.newPage();
if (fs.existsSync(PKG)) {
    await ctx.route('https://unpkg.com/**', (route) => {
        const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
        const file = path.join(PKG, rel);
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));

const G = (expr) => page.evaluate(`(() => { const g = window.__garden; return ${expr}; })()`);
const until = (expr, timeout = 600000) => page.waitForFunction(`(() => { const g = window.__garden; return ${expr}; })()`, null, { timeout, polling: 100 });
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = async (name) => {
    if (!SHOTS) return;
    await frames(4);
    await page.screenshot({ path: path.join(OUT, `fc-${PHONE ? 'phone-' : ''}${name}.png`), timeout: 180000 });
};
const project = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__garden, v = g.camera.position.clone().set(x, y, z).project(g.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z < 1 };
}, [x, y, z]);
const click = async (p) => (PHONE ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));

await page.goto(`${BASE}/index.html?debug&enter&pr=${process.env.PR ?? 0.6}&t=0.4${process.env.Q ? '&q=' + process.env.Q : ''}`);
await until('g?.entered', 240000);
await G('g.throughDoor(true, "arcade")');
await until("g.roomKind === 'arcade' && !!g.arcade", 120000);
check(errors.length === 0, 'the arcade builds with the fortune teller and the claw machine');

// every game has a toy, of a kind that fits its icon
const kinds = await page.evaluate(async () => {
    const m = await import('./garden/js/arcade-toys.js');
    const games = window.__garden.layout.games;
    const out = {};
    for (const g of games) out[m.toyKind(g)] = (out[m.toyKind(g)] || 0) + 1;
    // build every toy once, to be sure none of them throws
    for (const [i, g] of games.entries()) m.makeToy(g, i, null);
    return out;
});
console.log('      toy kinds:', JSON.stringify(kinds));
check(Object.keys(kinds).length >= 18, `the toys come in ${Object.keys(kinds).length} kinds`);

// ---- Madame Meridian
const f = await G('(() => { const m = g.arcade.plan.fortune; return { x: m.x, z: m.z, sx: m.stand.x, sz: m.stand.z }; })()');
await G(`(g.controls.teleport(${f.sx}, ${f.sz + 1.2}, 0), g.controls.pitch = -0.05)`);
await frames(10);
await shot('0-fortune');
const fp = await project(f.x, 1.5, f.z);
check(fp.front, 'the fortune teller is in view');
await click(fp);
await until("g.arcade.fortune.state === 'telling'", 20000);
check(true, 'clicking her walks you up and wakes her');
await page.waitForTimeout(2200);
await shot('1-telling');
await until("g.arcade.fortune.state === 'done'", 20000);
check(await page.isVisible('#fortune-card'), 'a ticket comes out and its card is shown');
const ft = await page.evaluate(() => ({ text: document.getElementById('fortune-text').textContent, game: document.getElementById('fortune-game').textContent, log: document.getElementById('fortune-log').textContent }));
check(ft.text.length > 10 && /lucky game/i.test(ft.game), `the fortune reads: "${ft.text}"`);
check(/1 of \d+ fortunes read/.test(ft.log), `the log counts it (${ft.log})`);
await shot('2-ticket');
await page.click('#fortune-game');
await frames(3);
check(await G('!!g.ui.cardGame'), 'the lucky game opens its game card');
await G('g.ui.closeAll()');
check(await G("g.arcade.fortune.state === 'taking' || g.arcade.fortune.state === 'idle'"), 'and the ticket is taken');

// ---- Plush Pier
const c = await G('(() => { const m = g.arcade.plan.claw; return { x: m.x, z: m.z, sx: m.stand.x, sz: m.stand.z }; })()');
await G(`(g.controls.teleport(${c.sx}, ${c.sz + 0.8}, 0), g.controls.pitch = -0.05)`);
await frames(10);
await shot('3-claw');
const cp = await project(c.x, 1.4, c.z);
await click(cp);
await until('g.arcade.claw.active', 20000);
check(true, 'clicking the claw machine steps you up to it');
check(await page.isVisible('#claw-hud'), 'the claw controls are shown');
const toys = await G('g.arcade.claw.toys.length');
check(toys >= 20, `the case holds ${toys} plush`);
await page.waitForTimeout(1200);
await shot('4-case');
// steer by keys: hold D and see the claw move right
const x0 = await G('g.arcade.claw.claw.x');
await page.keyboard.down('d');
await page.waitForTimeout(600);
await page.keyboard.up('d');
const x1 = await G('g.arcade.claw.claw.x');
check(x1 > x0 + 0.05, `D moves the claw right (${x0.toFixed(2)} → ${x1.toFixed(2)})`);
// line up exactly over a top-layer toy and drop (several goes if need be)
let wins = 0;
for (let go = 0; go < 8 && !wins; go++) {
    await until("g.arcade.claw.state === 'play'", 60000);
    await G(`(() => { const C = g.arcade.claw; const t = C.toys.filter((t) => !C.falling.includes(t)).sort((a, b) => b.position.y - a.position.y)[0]; C.claw.x = t.position.x; C.claw.z = t.position.z; })()`);
    await frames(2);
    await page.keyboard.press('Space');
    await until("g.arcade.claw.state === 'drop'", 5000);
    if (go === 0) {
        await until("g.arcade.claw.state === 'grab'", 20000);
        await shot('5-grab');
    }
    await until("['play', 'won'].includes(g.arcade.claw.state)", 60000);
    if ((await G('g.arcade.claw.state')) === 'won') wins++;
}
check(wins === 1, 'a well-aimed drop wins a plush within a few goes');
await until("!document.getElementById('claw-card').hidden", 10000);
const prize = await page.evaluate(() => ({ name: document.getElementById('claw-name').textContent, from: document.getElementById('claw-from').textContent, log: document.getElementById('claw-log').textContent }));
check(/plush/.test(prize.name) && /^from /.test(prize.from), `the prize card: ${prize.name} ${prize.from}`);
check(/^1 of \d+ plush won/.test(prize.log), `the shelf counts it (${prize.log})`);
check((await G("JSON.parse(localStorage.getItem('garden.clawWon')).length")) === 1, 'the win is remembered');
await shot('6-won');
await page.click('#claw-again');
await until("g.arcade.claw.state === 'play'", 10000);
check((await G('g.arcade.claw.toys.length')) === toys, 'a new plush drops in to fill the gap');
await page.waitForTimeout(1200);
await page.keyboard.press('Escape');
await until('!g.arcade.claw.active', 5000);
check(await G('g.controls.enabled'), 'Esc steps back and hands the walking back');

check(errors.length === 0, 'no console errors' + (errors.length ? ':\n' + errors.join('\n') : ''));
await browser.close();
console.log('fortuneclawtest: all good');
