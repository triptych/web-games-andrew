/**
 * huttvtest.mjs — drives the television in the Hut in real Chromium: the set
 * stands by the desk, clicking it turns the dial, every channel either shows a
 * live picture (the fishing hole, the galaxy, the Violet Line, the Moon
 * Fountain) or NO SIGNAL until its place has been found (the arcade, the
 * Works), and visiting the arcade brings its channel in. Screenshots of every
 * channel. Fails on any console error or page error. Needs ?debug.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/huttvtest.mjs
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
const until = (expr, timeout = 600000) => page.waitForFunction(`(() => { const g = window.__garden; return ${expr}; })()`, null, { timeout, polling: 100 }).catch((e) => {
    throw new Error(`timed out waiting for ${expr}` + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''), { cause: e });
});
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = async (name) => {
    if (!SHOTS) return;
    await frames(4);
    await page.screenshot({ path: path.join(OUT, `tv-${PHONE ? 'phone-' : ''}${name}.png`), timeout: 180000 });
};
const project = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__garden, v = g.camera.position.clone().set(x, y, z).project(g.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z < 1 };
}, [x, y, z]);
const click = async (p) => (PHONE ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));

await page.goto(`${BASE}/index.html?debug&enter&pr=${process.env.PR ?? 0.6}&t=0.4${process.env.Q ? '&q=' + process.env.Q : ''}`);
await until('g?.entered', 900000);
await G('g.throughDoor(true, "hut")');
await until("g.roomKind === 'hut' && !!g.hut", 120000);
check(errors.length === 0, 'the hut builds with its television');
const tv = await G('(() => { const p = g.hut.tv.screenWorld; return { x: p.x, y: p.y, z: p.z, n: g.hut.tv.channels.length, names: g.hut.tv.channels.map((c) => c.name) }; })()');
check(tv.n >= 5, `the set gets ${tv.n} channels: ${tv.names.join(', ')}`);
// stand back from the set and look at it
await G(`(() => { g.controls.teleport(${tv.x - 0.3}, ${tv.z + 2.2}, Math.atan2(${-(0.3)}, 2.2) ); g.controls.pitch = -0.18; })()`);
await frames(6);
await until('g.hut.tv.lastDraw >= 0', 120000);
check(true, 'the set draws a live picture when it is in view');
const shotName = (i, name) => `${i}-${name.toLowerCase().replace(/[^a-z]+/g, '-')}`;
await shot(shotName(0, tv.names[0]));
// click the set: the dial turns
const sp = await project(tv.x, tv.y, tv.z);
check(sp.front, 'the set is on screen');
await click(sp);
await until('g.hut.tv.index === 1', 20000);
check(true, 'clicking the set turns to the next channel');
for (let i = 1; i < tv.n; i++) {
    if (i > 1) {
        await G('g.hut.tv.next()');
        await until(`g.hut.tv.index === ${i}`, 5000);
    }
    const live = await G(`g.hut.tv.channel.ready()`);
    if (live) {
        await G('g.hut.tv.lastDraw = -1');
        await until(`g.hut.tv.lastDraw >= 0`, 240000);
    }
    await page.waitForTimeout(800);
    await shot(shotName(i, tv.names[i]));
    console.log(`      ch ${i + 2}: ${tv.names[i]} · ${live ? 'live' : 'no signal'}`);
    if (/Arcade|Works/.test(tv.names[i])) check(!live, `${tv.names[i]} has no signal before it is found`);
    else check(live, `${tv.names[i]} is live`);
}
check(errors.length === 0, 'every channel draws without errors' + (errors.length ? ':\n' + errors.join('\n') : ''));
await browser.close();
console.log('huttvtest: all good');
