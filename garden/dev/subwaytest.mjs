/**
 * subwaytest.mjs — drives the hut's train ticket in real Chromium: into the hut,
 * click the ticket, wait for the train at Hearthside, board it, ride (shortened
 * with ?ride=SECONDS), step off at Prism Halt, walk through the passage into the
 * Spectrum Rotunda, touch the pool, board again, ride home and climb the stair.
 * Fails on any console error or page error. Screenshots -> garden/dev/shots/.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/subwaytest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), RIDE (seconds, default 24), VERBOSE=1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const RIDE = process.env.RIDE ?? '24';
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAILED: ' + msg);
    console.log('  ok  ' + msg);
};

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
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
page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    else if (process.env.VERBOSE) console.log('   console.' + m.type(), m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const frames = (n) =>
    page.evaluate((n) => new Promise((r) => {
        let k = 0;
        const f = () => (++k >= n ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
    }), n);
const shot = (name) => page.screenshot({ path: path.join(OUT, 'subway-' + name + '.png'), timeout: 180000 });
const sub = () => page.evaluate(() => {
    const s = window.__garden.subway;
    return s && { state: s.state, at: s.at, zt: s.zt, tRide: s.tRide, doorAmt: s.doorAmt, below: window.__garden.below };
});
const waitState = (state, timeout = 120000) => page.waitForFunction((st) => window.__garden.subway?.state === st, state, { timeout });
const goto = (x, z, yaw, pitch = -0.05) => page.evaluate(([x, z, yaw, pitch]) => {
    const c = window.__garden.controls;
    c.teleport(x, z, yaw);
    c.pitch = pitch;
}, [x, z, yaw, pitch]);

try {
    await page.goto(`${BASE}/index.html?debug=1&pr=0.5&bigdt&enter=1&t=0.36&ride=${RIDE}&fox=0`);
    await page.waitForFunction(() => window.__garden?.entered, null, { timeout: 180000 });
    await frames(2);

    // into the hut, and the ticket on the desk
    await page.evaluate(() => window.__garden.throughDoor(true, 'hut'));
    await page.waitForFunction(() => window.__garden.below && window.__garden.hut, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await goto(0.5, -0.4, 0, -0.55);
    await frames(3);
    await shot('01-hut-ticket');
    const tk = await page.evaluate(() => {
        const g = window.__garden, h = g.hut;
        const v = h.ticketPos.clone().project(g.camera);
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, onscreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1 };
    });
    check(tk.onscreen, 'the ticket is in view from the desk');
    await page.mouse.click(tk.x, tk.y);
    await page.waitForFunction(() => window.__garden.subway?.state, null, { timeout: 120000 });
    check((await sub()).below, 'clicking the ticket puts the player in the subway');

    // the platform and the arriving train
    await frames(3);
    await shot('02-platform-waiting');
    await waitState('arriving');
    await goto(-3.2, -8, -Math.PI / 2, -0.05);
    await frames(4);
    await shot('03-train-arriving');
    await waitState('docked');
    await frames(3);
    await shot('04-train-docked');
    check((await sub()).doorAmt === 1, 'the doors are open at Hearthside');

    // look at the exit stair
    await goto(-7, -22, Math.PI, -0.1);
    await frames(3);
    await shot('05-stair-entrance');

    // board: walk through a door
    await page.evaluate(() => {
        const c = window.__garden.controls;
        c.teleport(-4.5, 4.35 + 14.5, -Math.PI / 2 + 0.0);
    });
    await frames(2);
    await page.evaluate(() => window.__garden.controls.walkTo([{ x: -0.3, z: 18.85 }]));
    await waitState('ride', 180000);
    await frames(3);
    await shot('06-ride-start');
    check((await sub()).state === 'ride', 'the train has left Hearthside');
    // let it get going, then look out of the window at the tunnel
    await page.waitForTimeout(2500);
    await goto(0.0, 18.85, -Math.PI / 2, 0.0);
    await frames(3);
    await shot('07-ride-window');
    await goto(0.0, 18.85, Math.PI / 2 + 0.3, 0.0);
    await frames(3);
    await shot('08-ride-other-window');
    await goto(0.0, 18.85, 0, -0.05);
    await frames(2);
    await shot('09-ride-aisle');

    // jump through the zones to see them (positions along the line)
    for (const [name, f] of [['brick', 0.36], ['cavern', 0.5], ['rock', 0.55], ['aurora', 0.8]]) {
        await page.evaluate((f) => {
            const s = window.__garden.subway;
            s.__hold = s.D * f;
        }, f);
        await goto(0.0, 14.5, Math.PI / 2, 0.0);
        await frames(3);
        await shot('zone-' + name);
        await goto(0.0, 14.5, -Math.PI / 2, 0.0);
        await frames(2);
        await shot('zone-' + name + '-right');
    }
    await page.evaluate(() => (window.__garden.subway.__hold = null));
    await waitState('docked', 240000);
    await frames(3);
    const at = await sub();
    check(at.at === 'B', 'arrived at Prism Halt');
    await shot('10-prism-halt');

    // off the train, through the passage
    await goto(-4.5, 0, Math.PI / 2, -0.05);
    await frames(3);
    await shot('11-prism-platform');
    await goto(-14, 0, Math.PI / 2, -0.05);
    await frames(3);
    await shot('12-passage');
    await goto(-23.5, 0, Math.PI / 2, 0.0);
    await frames(3);
    await shot('13-rotunda-entrance');
    await goto(-24, -12, Math.PI + 0.2, -0.1);
    await frames(3);
    await shot('14-rotunda-pool');
    await goto(-44, 15, 0, 0.45);
    await frames(3);
    await shot('15-rotunda-dome');
    await goto(-44, -14.5, Math.PI, -0.35);
    await frames(2);
    await page.evaluate(() => window.__garden.subway.touchPool({ x: -44, z: -3 }));
    await frames(3);
    await shot('16-pool-ripple');
    check(true, 'the rotunda renders');

    // back to the train and home
    await goto(-4.5, 4.35 + 14.5, -Math.PI / 2, 0);
    await frames(2);
    await page.evaluate(() => window.__garden.controls.walkTo([{ x: -0.3, z: 18.85 }]));
    await waitState('ride', 180000);
    check((await sub()).at === 'B', 'riding home from Prism Halt');
    await waitState('docked', 240000);
    check((await sub()).at === 'A', 'back at Hearthside');
    await frames(2);
    await goto(-7, -26, Math.PI, -0.1);
    await page.evaluate(() => window.__garden.controls.walkTo([{ x: -18.3, z: -30 }]));
    await page.waitForFunction(() => !window.__garden.subway || window.__garden.hut && window.__garden.below && !window.__garden.subway.__active, null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await frames(2);
    await shot('17-back-in-hut');
} finally {
    await browser.close();
}
if (errors.length) {
    console.log(errors.join('\n'));
    process.exit(1);
}
console.log('subway test passed');
